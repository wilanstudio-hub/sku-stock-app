import { INVENTORY_AGENT_TOOLS, ToolCall, validateToolCall } from "./inventoryAgentTools";
import { getPageContext } from "./pageContext";

export type AIProvider = "gemini" | "ollama" | "lmstudio" | "openai" | "custom";

export interface AISettings {
  provider: AIProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature: number;
}

export const DEFAULT_AI_SETTINGS: Record<AIProvider, AISettings> = {
  gemini: {
    provider: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-1.5-flash",
    temperature: 0.7,
  },
  ollama: {
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "llama3.2",
    temperature: 0.7,
  },
  lmstudio: {
    provider: "lmstudio",
    baseUrl: "http://localhost:1234/v1",
    model: "default",
    temperature: 0.7,
  },
  openai: {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    temperature: 0.7,
  },
  custom: {
    provider: "custom",
    baseUrl: "http://localhost:8000/v1",
    model: "default",
    temperature: 0.7,
  },
};

const SETTINGS_KEY = "filmflow_inventory_ai_settings";

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_AI_SETTINGS.gemini, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore malformed or unavailable local settings and use defaults.
  }
  return DEFAULT_AI_SETTINGS.gemini;
}

export function saveAISettings(settings: AISettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures; AI settings remain available for the current session.
  }
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  toolCall?: ToolCall;
  isMutating?: boolean;
}

export interface AgentContextProps {
  tenantName?: string;
  tenantSlug?: string;
  currentPath: string;
  activeDepartment?: string;
  departments?: Array<{ code: string; name_th: string }>;
  userRole?: string;
}

export function buildSystemPrompt(context: AgentContextProps): string {
  const pageCtx = getPageContext(context.currentPath);
  const deptList = (context.departments ?? []).map((d) => `${d.code} (${d.name_th})`).join(", ");

  const toolsSummary = INVENTORY_AGENT_TOOLS.map(
    (t) => `- ${t.name}: ${t.description} (Args: ${JSON.stringify(t.parameters)})`
  ).join("\n");

  return `You are Ctrl+ Production Agent, the intelligent AI copilot specialized in Film & Video Production Inventory, Equipment Tracking, and SKU Stock Management.
You communicate primarily in clear, polite, and helpful Thai (or match the user's language).

[STUDIO WORKSPACE CONTEXT]
- Studio / Tenant: ${context.tenantName || "FilmFlow Studio"} (${context.tenantSlug || "main"})
- Current Page: ${pageCtx.label} (${context.currentPath})
- Active Department: ${context.activeDepartment || "all"}
- Available Departments: ${deptList || "Art, Equipment, WD"}
- User Role: ${context.userRole || "crew/admin"}
- Relevant Tools for this page: ${pageCtx.relevantTools.join(", ") || "all"}

[AVAILABLE TOOLS]
${toolsSummary}

[STRICT RESPONSE FORMAT RULE]
You MUST respond with a single, valid JSON object and NOTHING else. No markdown fences around JSON, no commentary before or after.
Choose ONE of the two formats:

1. If you need to invoke a tool to answer or act:
{
  "tool": "tool_name",
  "args": { "arg_name": "value" }
}

2. If you are answering directly or greeting:
{
  "reply": "ข้อความคำตอบภาษาไทยของคุณ..."
}

[SAFETY & ACCURACY RULES]
1. Never hallucinate items or availability without searching. If unsure, call "search_sku_item".
2. Read-only queries ("search_sku_item", "check_item_availability", "recommend_equipment_kit", "generate_sku_report") execute immediately.
3. Mutating operations ("log_quick_transaction", "trigger_sheet_sync") will prompt the user with a confirmation card before executing.
4. Keep the scope strictly to Film & Video Production, camera equipment, sound, lighting, grip, wardrobe, props, and stock inventory.`;
}

/** Sends prompt to the configured AI provider with 25s timeout and JSON extraction */
export async function sendAgentMessage(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  settings: AISettings,
): Promise<{ toolCall?: ToolCall; isMutating?: boolean; reply?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    let rawText = "";

    if (settings.provider === "gemini") {
      const apiKey = settings.apiKey || "";
      if (!apiKey) {
        throw new Error("กรุณาระบุ Gemini API Key ในการตั้งค่า AI (กดปุ่มเฟือง)");
      }

      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model || "gemini-1.5-flash"}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: settings.temperature ?? 0.7,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Gemini API Error: ${res.status}`);
      }

      const json = await res.json();
      rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      // OpenAI-compatible / Ollama / LM Studio
      const endpoint = settings.provider === "ollama"
        ? `${settings.baseUrl.replace(/\/$/, "")}/v1/chat/completions`
        : `${settings.baseUrl.replace(/\/$/, "")}/chat/completions`;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (settings.apiKey) headers["Authorization"] = `Bearer ${settings.apiKey}`;

      const payload: any = {
        model: settings.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: settings.temperature ?? 0.7,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`AI Server Error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      rawText = json?.choices?.[0]?.message?.content || "";
    }

    clearTimeout(timeoutId);

    // Clean JSON response (handle potential markdown triple backticks from local models)
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
    else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // If parsing fails, treat as direct reply
      return { reply: rawText };
    }

    if (parsed.reply) {
      return { reply: parsed.reply };
    }

    if (parsed.tool) {
      const validation = validateToolCall(parsed);
      if (validation.valid && validation.toolCall) {
        const toolDef = INVENTORY_AGENT_TOOLS.find((t) => t.name === validation.toolCall!.tool);
        return {
          toolCall: validation.toolCall,
          isMutating: !!toolDef?.isMutating,
        };
      }
    }

    return { reply: rawText };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("คำขอหมดเวลา (Timeout 25s) กรุณาลองใหม่อีกครั้ง หรือตรวจสอบ Local AI Server");
    }
    throw err;
  }
}
