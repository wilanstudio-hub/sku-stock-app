import { supabase } from "@/integrations/supabase/client";
import { currentTranslations, displayItemName, displayPlain, displayUnit, readLang } from "@/lib/uiText";

export interface AgentToolParam {
  type: "string" | "number" | "array" | "boolean";
  description: string;
  required?: boolean;
}

export interface AgentToolDef {
  name: string;
  description: string;
  parameters: Record<string, AgentToolParam>;
  isMutating?: boolean;
}

export const INVENTORY_AGENT_TOOLS: AgentToolDef[] = [
  {
    name: "search_sku_item",
    description: "Search inventory items by name (Thai/English), SKU code, category, or location. Read-only.",
    parameters: {
      query: { type: "string", description: "Search query or keyword (e.g. 'Sony FX6', 'LENS-001', 'Aputure light', 'tripod')", required: true },
      department: { type: "string", description: "Department code (e.g. 'equipment', 'art', 'wd', optional)" },
    },
    isMutating: false,
  },
  {
    name: "check_item_availability",
    description: "Check the live availability status of an item (Available, Checked out by whom, On Event, or Unavailable). Read-only.",
    parameters: {
      sku_code: { type: "string", description: "Exact SKU code (e.g. 'EQ-CAM-001') or search keyword", required: true },
    },
    isMutating: false,
  },
  {
    name: "recommend_equipment_kit",
    description: "Recommend a standard equipment, lighting, sound, camera kit, props, or wardrobe checklist for film & video production shoots (e.g. TVC, Commercial, MV, Documentary, Night Outdoor, Interview). Read-only.",
    parameters: {
      shoot_type: { type: "string", description: "Type of shoot (e.g. 'Commercial', 'Music Video', 'Interview', 'Documentary', 'Studio Talk')", required: true },
      department: { type: "string", description: "Target department (e.g. 'equipment', 'art', 'wd', optional)" },
    },
    isMutating: false,
  },
  {
    name: "generate_sku_report",
    description: "Generate a summary audit report of the inventory (items currently checked out, total quantities, or status breakdown). Read-only.",
    parameters: {
      report_type: { type: "string", description: "Type of report: 'checked_out' (currently borrowed items), 'status_summary' (breakdown by availability), or 'departments'", required: true },
      department: { type: "string", description: "Optional department filter (e.g. 'equipment', 'art', 'wd')" },
    },
    isMutating: false,
  },
  {
    name: "log_quick_transaction",
    description: "Execute a check-out or check-in for a specific SKU code with the borrower's name. Mutates database — requires user confirmation.",
    parameters: {
      sku_code: { type: "string", description: "SKU code of the item (e.g. 'EQ-CAM-001')", required: true },
      action_type: { type: "string", description: "'check_out' or 'check_in'", required: true },
      person_name: { type: "string", description: "Name of the person borrowing or returning the item", required: true },
    },
    isMutating: true,
  },
  {
    name: "trigger_sheet_sync",
    description: "Trigger real-time Google Sheets resynchronization for a department. Mutates database — requires user confirmation.",
    parameters: {
      department: { type: "string", description: "Department code to sync ('equipment', 'art', 'wd')", required: true },
    },
    isMutating: true,
  },
];

export interface ToolCall {
  tool: string;
  args: Record<string, any>;
}

export function validateToolCall(parsed: any): { valid: boolean; error?: string; toolCall?: ToolCall } {
  if (!parsed || typeof parsed !== "object") {
    return { valid: false, error: "Invalid JSON response" };
  }

  const toolName = parsed.tool || parsed.name;
  if (!toolName || typeof toolName !== "string") {
    return { valid: false, error: "Missing tool name in tool call" };
  }

  const def = INVENTORY_AGENT_TOOLS.find((t) => t.name === toolName);
  if (!def) {
    return { valid: false, error: `Unknown tool: ${toolName}` };
  }

  const args = parsed.args || parsed.arguments || {};
  if (typeof args !== "object") {
    return { valid: false, error: "Tool args must be an object" };
  }

  for (const [paramName, paramDef] of Object.entries(def.parameters)) {
    if (paramDef.required && (args[paramName] === undefined || args[paramName] === null || args[paramName] === "")) {
      return { valid: false, error: `Missing required argument '${paramName}' for tool '${toolName}'` };
    }
  }

  return { valid: true, toolCall: { tool: toolName, args } };
}

export interface ToolExecutionContext {
  companyId?: string | null;
  userId?: string | null;
}

function sanitizeSearchValue(value: string): string {
  // PostgREST's .or() grammar uses commas and parentheses as control syntax.
  return value.replace(/[(),]/g, " ").replace(/\\/g, " ").trim();
}

/** Execute a tool and return a human-readable markdown response in the active language. */
export async function executeInventoryTool(
  toolCall: ToolCall,
  context: ToolExecutionContext,
): Promise<{ success: boolean; result: string }> {
  const { tool, args } = toolCall;
  const companyId = context.companyId;
  const lang = readLang();
  const t = currentTranslations();

  try {
    switch (tool) {
      case "search_sku_item": {
        const query = sanitizeSearchValue(String(args.query || ""));
        let q = supabase.from("skus").select("sku_code, name_th, name_en, category, department, quantity, unit, location, current_status, availability").limit(10);
        if (companyId) q = q.eq("company_id", companyId);
        if (args.department) q = q.eq("department", args.department.toLowerCase());

        q = q.or(`sku_code.ilike.%${query}%,name_th.ilike.%${query}%,name_en.ilike.%${query}%,category.ilike.%${query}%,location.ilike.%${query}%`);
        const { data, error } = await q;

        if (error) throw error;
        if (!data || data.length === 0) {
          return { success: true, result: t.toolNoMatch(query) };
        }

        const lines = data.map((item) => {
          const statusText = item.current_status === "check_out" ? t.toolCheckedOut : t.toolReady;
          const loc = displayPlain(item.location, lang);
          const locText = loc ? t.toolLocation(loc) : "";
          return `- **\`${item.sku_code}\`** ${displayItemName(item, lang)} (${item.quantity} ${displayUnit(item.unit, lang)}) — ${statusText}${locText}`;
        });

        return {
          success: true,
          result: `${t.toolSearchTitle(query, data.length)}\n\n${lines.join("\n")}`,
        };
      }

      case "check_item_availability": {
        const code = sanitizeSearchValue(String(args.sku_code || ""));
        let q = supabase.from("skus").select("sku_code, name_th, name_en, current_status, availability, last_handler, quantity, unit, location").limit(5);
        if (companyId) q = q.eq("company_id", companyId);
        q = q.or(`sku_code.ilike.%${code}%,name_th.ilike.%${code}%`);

        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) {
          return { success: true, result: t.toolMissing(code) };
        }

        const items = data.map((item) => {
          const isOut = item.current_status === "check_out";
          const statusBadge = isOut ? t.toolOutLong : t.toolInWarehouse;
          const handlerName = displayPlain(item.last_handler, lang);
          const handler = isOut && handlerName ? t.toolHandler(handlerName) : "";
          const loc = displayPlain(item.location, lang);
          const locText = loc ? t.toolPlace(loc) : "";
          return `**\`${item.sku_code}\` ${displayItemName(item, lang)}**\n  - ${t.toolStatusWord}: ${statusBadge}${handler}${locText}\n  - ${t.toolQtyWord}: ${item.quantity} ${displayUnit(item.unit, lang)}`;
        });

        return {
          success: true,
          result: `${t.toolStatusTitle}\n\n${items.join("\n\n")}`,
        };
      }

      case "recommend_equipment_kit": {
        const shootType = args.shoot_type || "Commercial";
        const kitPresets: Record<string, readonly string[]> = {
          commercial: t.kitCommercial,
          mv: t.kitMv,
          interview: t.kitInterview,
        };

        const key = Object.keys(kitPresets).find((k) => shootType.toLowerCase().includes(k)) || "commercial";
        const items = kitPresets[key];

        return {
          success: true,
          result: `${t.toolKitTitle(shootType)}\n\n${items.join("\n\n")}\n\n${t.toolKitHint}`,
        };
      }

      case "generate_sku_report": {
        const type = args.report_type || "checked_out";
        if (type === "checked_out") {
          let q = supabase.from("skus").select("sku_code, name_th, name_en, department, last_handler, updated_at").eq("current_status", "check_out").limit(20);
          if (companyId) q = q.eq("company_id", companyId);
          const { data, error } = await q;
          if (error) throw error;

          if (!data || data.length === 0) {
            return { success: true, result: t.toolNoneOut };
          }

          const rows = data.map((d) => `- **\`${d.sku_code}\`** ${displayItemName(d, lang)} (${d.department}) — ${t.toolBorrowedBy(displayPlain(d.last_handler, lang) || t.toolUnknownPerson)}`);
          return {
            success: true,
            result: `${t.toolOutList(data.length)}\n\n${rows.join("\n")}`,
          };
        } else {
          let q = supabase.from("skus").select("availability, current_status", { count: "exact" });
          if (companyId) q = q.eq("company_id", companyId);
          const { data, count, error } = await q;
          if (error) throw error;

          const total = count || (data?.length ?? 0);
          const checkedOut = (data ?? []).filter((x) => x.current_status === "check_out").length;
          const available = total - checkedOut;

          return {
            success: true,
            result: t.toolSummary(total, available, checkedOut),
          };
        }
      }

      case "log_quick_transaction": {
        const skuCode = (args.sku_code || "").trim();
        const actionType = (args.action_type || "check_out").toLowerCase();
        const personName = (args.person_name || "").trim();
        const nextStatus = actionType === "check_in" ? "available" : "check_out";

        let skuQuery = supabase.from("skus").select("id, sku_code, name_th, name_en, department, company_id").eq("sku_code", skuCode);
        if (companyId) skuQuery = skuQuery.eq("company_id", companyId);
        const { data: item, error: findErr } = await skuQuery.maybeSingle();

        if (findErr || !item) {
          return { success: false, result: t.toolSkuMissing(skuCode) };
        }

        const [{ error: txErr }, { error: updateErr }] = await Promise.all([
          supabase.from("sku_transactions").insert({
            sku_code: item.sku_code,
            sku_id: item.id,
            company_id: item.company_id || companyId,
            department: item.department,
            action_type: actionType,
            person_name: personName,
          }),
          supabase.from("skus").update({
            current_status: nextStatus,
            last_handler: personName,
          }).eq("id", item.id),
        ]);

        if (txErr || updateErr) {
          throw new Error((txErr || updateErr)?.message);
        }

        const actionText = actionType === "check_in" ? t.toolCheckedIn : t.toolCheckedOutSaved;
        const nextLabel = nextStatus === "available" ? t.toolNowAvailable : t.toolNowOut;
        return {
          success: true,
          result: `✅ **${actionText}**\n- **${t.toolCode}:** \`${item.sku_code}\`\n- **${t.toolName}:** ${displayItemName(item, lang)}\n- **${t.toolOperator}:** ${personName}\n- **${t.toolNewStatus}:** ${nextLabel}`,
        };
      }

      case "trigger_sheet_sync": {
        const dept = (args.department || "equipment").toLowerCase();
        const funcName = dept === "art" ? "sync-art-sheets" : dept === "wd" ? "sync-wd-sheets" : "sync-equipment-sheet";

        const { data, error } = await supabase.functions.invoke(funcName, {
          body: { department: dept },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        return {
          success: true,
          result: t.toolSyncOk(dept.toUpperCase(), data?.inserted ?? 0, data?.updated ?? 0, data?.deleted ?? 0),
        };
      }

      default:
        return { success: false, result: t.toolUnsupported(tool) };
    }
  } catch (err: any) {
    return { success: false, result: t.toolCallError(err?.message || String(err)) };
  }
}
