import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Layers,
  Search,
  Box,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CtrlPlusLogo } from "@/components/CtrlPlusLogo";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { getPageContext } from "@/lib/ai/pageContext";
import {
  ChatMessage,
  loadAISettings,
  saveAISettings,
  sendAgentMessage,
  buildSystemPrompt,
  AISettings,
  AIProvider,
  DEFAULT_AI_SETTINGS,
} from "@/lib/ai/agentService";
import {
  executeInventoryTool,
  ToolCall,
} from "@/lib/ai/inventoryAgentTools";

const QUICK_PROMPTS = [
  { label: "🔍 ค้นหากล้องว่าง", query: "มีกล้องอะไรว่างในคลังบ้าง" },
  { label: "📤 ของที่ถูกเบิกออก", query: "สรุปรายการอุปกรณ์ที่กำลังถูกเบิกออกอยู่ตอนนี้" },
  { label: "🎬 แนะนำ Kit โฆษณา", query: "แนะนำชุดอุปกรณ์สำหรับถ่ายทำโฆษณา (Commercial Shoot)" },
  { label: "📊 สรุปยอดสต๊อก", query: "สรุปภาพรวมจำนวนสต๊อกทั้งหมดในระบบ" },
];

export const GlobalAgentWidget: React.FC = () => {
  const location = useLocation();
  const { tenant } = useTenant();
  const { user, roles } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `👋 สวัสดีครับ! ผมคือ **Ctrl+ Production Agent** ผู้ช่วยจัดการสต๊อกและอุปกรณ์กองถ่ายสำหรับ **${tenant?.name || "สตูดิโอ"}**\n\nพิมพ์ถามสต๊อก, ตรวจสอบของว่าง, ทำเรื่องเบิก-คืน หรือให้แนะนำ Kit อุปกรณ์กองถ่ายได้เลยครับ!`,
      timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    messageId: string;
    toolCall: ToolCall;
  } | null>(null);

  // Settings Modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AISettings>(loadAISettings);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pageContext = getPageContext(location.pathname);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt({
        tenantName: tenant?.name,
        tenantSlug: tenant?.slug,
        currentPath: location.pathname,
        userRole: roles.join(", "),
      });

      const conversationHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendAgentMessage(conversationHistory, systemPrompt, settings);

      if (res.toolCall) {
        if (res.isMutating) {
          // Mutating: Require User Confirmation
          const confirmMsgId = `confirm-${Date.now()}`;
          const confirmMsg: ChatMessage = {
            id: confirmMsgId,
            role: "assistant",
            content: `⚠️ **คำขอยืนยันการเปลี่ยนแปลงข้อมูล**`,
            timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
            toolCall: res.toolCall,
            isMutating: true,
          };
          setMessages((prev) => [...prev, confirmMsg]);
          setPendingConfirmation({ messageId: confirmMsgId, toolCall: res.toolCall });
        } else {
          // Read-only: Execute immediately
          const execRes = await executeInventoryTool(res.toolCall, {
            companyId: tenant?.id,
            userId: user?.id,
          });

          const replyMsg: ChatMessage = {
            id: `reply-${Date.now()}`,
            role: "assistant",
            content: execRes.result,
            timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, replyMsg]);
        }
      } else if (res.reply) {
        const replyMsg: ChatMessage = {
          id: `reply-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, replyMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `❌ **เกิดข้อผิดพลาดในการเชื่อมต่อ AI:** ${err?.message || "ไม่สามารถติดต่อ AI Provider ได้"}\n\n💡 *กรุณาตรวจสอบ API Key หรือ Base URL โดยกดปุ่มเฟืองมุมขวาบน*`,
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (toolCall: ToolCall) => {
    setLoading(true);
    setPendingConfirmation(null);
    try {
      const execRes = await executeInventoryTool(toolCall, {
        companyId: tenant?.id,
        userId: user?.id,
      });

      const replyMsg: ChatMessage = {
        id: `reply-${Date.now()}`,
        role: "assistant",
        content: execRes.result,
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, replyMsg]);
    } catch (err: any) {
      toast.error(err.message || "Failed to execute tool");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAction = () => {
    setPendingConfirmation(null);
    const cancelMsg: ChatMessage = {
      id: `cancel-${Date.now()}`,
      role: "assistant",
      content: "🚫 ยกเลิกคำสั่งเรียบร้อยแล้ว ข้อมูลในระบบไม่มีการเปลี่ยนแปลงครับ",
      timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `👋 เริ่มต้นการสนทนาใหม่กับ **Ctrl+ Production Agent** สำหรับ **${tenant?.name || "สตูดิโอ"}**`,
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setPendingConfirmation(null);
  };

  const handleSaveSettings = () => {
    saveAISettings(settings);
    setSettingsOpen(false);
    toast.success("บันทึกการตั้งค่า AI สำเร็จ");
  };

  // Format simple markdown into clean HTML representation
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h4 key={idx} className="font-bold text-sm text-foreground mt-2 mb-1">{line.slice(4)}</h4>;
      }
      if (line.startsWith("- ")) {
        return (
          <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground my-0.5 pl-1">
            <span className="text-primary font-bold">•</span>
            <span>{parseInline(line.slice(2))}</span>
          </div>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-1.5" />;
      }
      return <p key={idx} className="text-xs leading-relaxed my-0.5">{parseInline(line)}</p>;
    });
  };

  const parseInline = (text: string) => {
    // Bold **text**
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="font-mono bg-muted px-1 py-0.5 rounded text-[11px] text-primary">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <>
      {/* ── Floating Launcher Button ──────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-2xl hover:scale-105 transition-all duration-200 border border-primary-foreground/20 group"
          title="เปิด Ctrl+ Production Agent"
        >
          <div className="relative flex items-center justify-center">
            <CtrlPlusLogo theme="dark" variant="icon" className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-primary animate-pulse" />
          </div>
          <span className="text-xs font-semibold tracking-wide">Ctrl+ Agent</span>
        </button>
      )}

      {/* ── Chat Window ───────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[420px] h-[580px] max-h-[85vh] rounded-2xl border bg-card/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <CtrlPlusLogo theme="auto" variant="icon" className="w-6 h-6 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">Ctrl+ Agent</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                    Inventory
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate max-w-[190px]">
                  {pageContext.label}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleClearHistory}
                title="ล้างประวัติแชต"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setSettingsOpen(true)}
                title="ตั้งค่าโมเดล AI"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
                title="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Message Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-th text-xs">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                        : "bg-muted/70 text-foreground rounded-tl-none border shadow-xs"
                    }`}
                  >
                    {renderMarkdown(m.content)}

                    {/* Mutating Tool Confirmation Card */}
                    {m.isMutating && m.toolCall && pendingConfirmation?.messageId === m.id && (
                      <div className="mt-2.5 p-3 rounded-xl bg-card border border-amber-500/30 text-card-foreground shadow-sm space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-xs">
                          <AlertTriangle className="w-4 h-4" />
                          <span>โปรดยืนยันการทำรายการ:</span>
                        </div>
                        <div className="font-mono text-[11px] bg-muted/60 p-2 rounded border">
                          <div className="text-primary font-bold">Tool: {m.toolCall.tool}</div>
                          {Object.entries(m.toolCall.args).map(([k, v]) => (
                            <div key={k} className="text-muted-foreground">
                              {k}: <span className="text-foreground font-semibold">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleConfirmAction(m.toolCall!)}
                            disabled={loading}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> ยืนยันดำเนินการ
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex-1"
                            onClick={handleCancelAction}
                            disabled={loading}
                          >
                            ยกเลิก
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1 mt-0.5">
                    {m.timestamp}
                  </span>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Ctrl+ Agent กำลังคิดและประมวลผล...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-1.5 border-t bg-muted/20 flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                onClick={() => handleSend(qp.query)}
                disabled={loading}
                className="whitespace-nowrap text-[10px] font-medium px-2.5 py-1 rounded-full border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t bg-card shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="ถามสต๊อก, ค้นหาของ, หรือสั่งงาน AI..."
                className="text-xs font-th h-9 rounded-full px-3.5"
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 rounded-full shrink-0"
                disabled={!inputValue.trim() || loading}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── AI Provider Settings Dialog ───────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Settings className="w-5 h-5 text-primary" />
              การตั้งค่า AI Provider
            </DialogTitle>
            <DialogDescription>
              เลือกระบบโมเดล AI ที่ต้องการใช้งานสำหรับ Ctrl+ Production Agent
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="provider">AI Provider</Label>
              <Select
                value={settings.provider}
                onValueChange={(val: AIProvider) => {
                  setSettings({
                    ...DEFAULT_AI_SETTINGS[val],
                    apiKey: settings.apiKey,
                  });
                }}
              >
                <SelectTrigger id="provider" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (คลาวด์แนะนำ - เร็วและแม่นยำ)</SelectItem>
                  <SelectItem value="ollama">Ollama (Local LLM บนเครื่อง)</SelectItem>
                  <SelectItem value="lmstudio">LM Studio (Local LLM บนเครื่อง)</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT-4o mini)</SelectItem>
                  <SelectItem value="custom">Custom Endpoint (vLLM / LocalAI)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.provider === "gemini" && (
              <div className="space-y-1.5">
                <Label htmlFor="apiKey">Gemini API Key *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="AIzaSy..."
                  value={settings.apiKey || ""}
                  onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                  className="font-mono text-xs h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  รับฟรีได้ที่ <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-primary underline">aistudio.google.com</a> (เก็บใน Browser ของคุณเท่านั้น)
                </p>
              </div>
            )}

            {(settings.provider === "ollama" || settings.provider === "lmstudio" || settings.provider === "custom") && (
              <div className="space-y-1.5">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  placeholder="http://localhost:11434"
                  value={settings.baseUrl}
                  onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                  className="font-mono text-xs h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="model">Model Name</Label>
              <Input
                id="model"
                placeholder="gemini-1.5-flash หรือ llama3.2"
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="font-mono text-xs h-9"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(false)}>
              ยกเลิก
            </Button>
            <Button size="sm" onClick={handleSaveSettings}>
              บันทึกการตั้งค่า
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
