import { supabase } from "@/integrations/supabase/client";

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
      query: { type: "string", description: "Search query or keyword (e.g. 'Sony FX6', 'LENS-001', 'ไฟ Aputure', 'ขาตั้ง')", required: true },
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
      shoot_type: { type: "string", description: "Type of shoot (e.g. 'Commercial / โฆษณา', 'Music Video', 'Interview', 'Documentary', 'Studio Talk')", required: true },
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
    description: "Execute a check-out (ยืม/เบิกออก) or check-in (นำคืน) for a specific SKU code with the borrower's name. Mutates database — requires user confirmation.",
    parameters: {
      sku_code: { type: "string", description: "SKU code of the item (e.g. 'EQ-CAM-001')", required: true },
      action_type: { type: "string", description: "'check_out' (เบิกออก) or 'check_in' (นำคืน)", required: true },
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

/** Execute a tool and return human-readable Thai markdown response */
export async function executeInventoryTool(
  toolCall: ToolCall,
  context: ToolExecutionContext,
): Promise<{ success: boolean; result: string }> {
  const { tool, args } = toolCall;
  const companyId = context.companyId;

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
          return { success: true, result: `🔍 ไม่พบรายการสินค้าที่ตรงกับคำค้นหา: "${query}"` };
        }

        const lines = data.map((item) => {
          const statusText = item.current_status === "check_out" ? "🔴 ถูกเบิกออก" : "🟢 พร้อมใช้งาน";
          const loc = item.location ? ` | ที่เก็บ: ${item.location}` : "";
          return `- **\`${item.sku_code}\`** ${item.name_th} (${item.quantity} ${item.unit || "ชิ้น"}) — ${statusText}${loc}`;
        });

        return {
          success: true,
          result: `### 📋 ผลการค้นหา "${query}" (${data.length} รายการ):\n\n${lines.join("\n")}`,
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
          return { success: true, result: `❓ ไม่พบอุปกรณ์รหัสหรือชื่อ: "${code}"` };
        }

        const items = data.map((item) => {
          const isOut = item.current_status === "check_out";
          const statusBadge = isOut ? "🔴 **ถูกเบิกออกแล้ว**" : "🟢 **พร้อมใช้งานในคลัง**";
          const handler = isOut && item.last_handler ? `\n  - 👤 **ผู้เบิก:** ${item.last_handler}` : "";
          const loc = item.location ? `\n  - 📍 **ตำแหน่ง:** ${item.location}` : "";
          return `**\`${item.sku_code}\` ${item.name_th}**\n  - สถานะ: ${statusBadge}${handler}${loc}\n  - จำนวน: ${item.quantity} ${item.unit || "ชิ้น"}`;
        });

        return {
          success: true,
          result: `### 🔍 ข้อมูลสถานะอุปกรณ์:\n\n${items.join("\n\n")}`,
        };
      }

      case "recommend_equipment_kit": {
        const shootType = args.shoot_type || "Commercial";
        const kitPresets: Record<string, string[]> = {
          commercial: [
            "🎥 **Camera A/B:** Sony FX6 / FX3 หรือ ARRI Alexa Mini LF พร้อม V-Mount Batteries x6",
            "🔍 **Lenses:** Cine Prime Set (24mm, 35mm, 50mm, 85mm T1.5) + Zoom 24-70mm F2.8",
            "💡 **Lighting:** Aputure 600d Pro x2, Nova P300c x2, Amaran T4c Tube x4 + C-Stands x6",
            "🎙️ **Sound:** Wireless Lavalier Mic Set (Sennheiser G4 / DJI Mic 2) + Shotgun Mic MKH416",
            "📐 **Grip & Monitor:** Wireless Video Transmitter (Hollyland / Teradek) + Director Monitor 7\" + Tripod Heavy Duty",
          ],
          mv: [
            "🎥 **Camera:** High frame rate camera (4K 120fps) + Gimbal DJI RS3 Pro / Steadicam",
            "🔍 **Lenses:** Fast Anamorphic Lens Set หรือ Ultra-Wide 16-35mm F2.8",
            "💡 **Lighting:** RGB Color Tubes x8, Aputure 300c RGB x2, Spotlight Mount + Smoke/Haze Machine",
            "🔋 **Power:** Heavy-duty Portable Battery Station + Multi-charger Dock",
          ],
          interview: [
            "🎥 **Camera:** 2-Camera Setup (Wide master + Tight interview angle) 4K 24/25fps",
            "🎙️ **Sound:** Dual Wireless Lapel Mics + Boom Pole + Sound Devices MixPre Recorder",
            "💡 **Lighting:** 3-Point Lighting Kit (Key: Softbox Dome 90cm, Fill: Lantern 300w, Rim/Hair light: 60w)",
            "📋 **Support:** Sound Blankets, Teleprompter (ถ้ามีสคริปต์ยาว), Comfortable Folding Chairs",
          ],
        };

        const key = Object.keys(kitPresets).find((k) => shootType.toLowerCase().includes(k)) || "commercial";
        const items = kitPresets[key];

        return {
          success: true,
          result: `### 🎬 แนะนำ Kit อุปกรณ์สำหรับ: **${shootType}**\n\n${items.join("\n\n")}\n\n💡 *คุณสามารถใช้คำสั่งค้นหา เช่น "มี Aputure ว่างไหม" เพื่อตรวจสอบของจริงในคลังได้ทันที*`,
        };
      }

      case "generate_sku_report": {
        const type = args.report_type || "checked_out";
        if (type === "checked_out") {
          let q = supabase.from("skus").select("sku_code, name_th, department, last_handler, updated_at").eq("current_status", "check_out").limit(20);
          if (companyId) q = q.eq("company_id", companyId);
          const { data, error } = await q;
          if (error) throw error;

          if (!data || data.length === 0) {
            return { success: true, result: "✅ **ยอดเยี่ยม!** ขณะนี้ไม่มีอุปกรณ์ชิ้นใดถูกเบิกค้างอยู่ ทุกชิ้นอยู่ในคลังพร้อมใช้งาน" };
          }

          const rows = data.map((d) => `- **\`${d.sku_code}\`** ${d.name_th} (${d.department}) — 👤 ผู้เบิก: ${d.last_handler || "ไม่ระบุชื่อ"}`);
          return {
            success: true,
            result: `### 📤 รายการอุปกรณ์ที่ถูกเบิกออกอยู่ (${data.length} รายการล่าสุด):\n\n${rows.join("\n")}`,
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
            result: `### 📊 สรุปยอดสต๊อกรวม:\n- **จำนวนทั้งหมด:** ${total} รายการ\n- 🟢 **พร้อมใช้งาน:** ${available} รายการ\n- 🔴 **ถูกเบิกออก:** ${checkedOut} รายการ`,
          };
        }
      }

      case "log_quick_transaction": {
        const skuCode = (args.sku_code || "").trim();
        const actionType = (args.action_type || "check_out").toLowerCase();
        const personName = (args.person_name || "").trim();
        const nextStatus = actionType === "check_in" ? "available" : "check_out";

        let skuQuery = supabase.from("skus").select("id, sku_code, name_th, department, company_id").eq("sku_code", skuCode);
        if (companyId) skuQuery = skuQuery.eq("company_id", companyId);
        const { data: item, error: findErr } = await skuQuery.maybeSingle();

        if (findErr || !item) {
          return { success: false, result: `❌ ไม่พบรหัสสินค้า "${skuCode}" ในระบบ` };
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

        const actionText = actionType === "check_in" ? "📥 นำคืนเรียบร้อยแล้ว" : "📤 บันทึกเบิกออกเรียบร้อยแล้ว";
        return {
          success: true,
          result: `✅ **${actionText}**\n- **รหัส:** \`${item.sku_code}\`\n- **ชื่อ:** ${item.name_th}\n- **ผู้ดำเนินการ:** ${personName}\n- **สถานะใหม่:** ${nextStatus === "available" ? "พร้อมใช้งาน (Available)" : "ถูกเบิกออก (Checked Out)"}`,
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
          result: `✅ **ซิงก์ Google Sheets แผนก ${dept.toUpperCase()} สำเร็จ!**\n- 📥 เพิ่มใหม่: ${data?.inserted ?? 0} รายการ\n- 🔄 อัปเดต: ${data?.updated ?? 0} รายการ\n- 🗑️ ลบออก: ${data?.deleted ?? 0} รายการ`,
        };
      }

      default:
        return { success: false, result: `⚠️ เครื่องมือ ${tool} ยังไม่รองรับการทำงาน` };
    }
  } catch (err: any) {
    return { success: false, result: `❌ เกิดข้อผิดพลาดในการเรียกคำสั่ง: ${err?.message || String(err)}` };
  }
}
