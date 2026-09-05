import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Send,
  Trash2,
  Settings,
  ArrowLeft,
  BookOpen,
  Paperclip,
  FileText,
  X,
  Plus,
  Loader2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Check,
  Zap,
  Building2,
  Box,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { CtrlPlusLogo } from "@/components/CtrlPlusLogo";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/hooks/useLang";
import {
  ChatMessage,
  AISettings,
  AIProvider,
  loadAISettings,
  saveAISettings,
  sendAgentMessage,
  DEFAULT_AI_SETTINGS,
} from "@/lib/ai/agentService";
import {
  executeInventoryTool,
  ToolCall,
} from "@/lib/ai/inventoryAgentTools";
import {
  KnowledgeSource,
  parseUploadedFile,
  createTextSource,
  formatBytes,
} from "@/lib/ai/sourceParser";

const QUICK_ACTIONS = [
  { label: "🔍 ค้นหากล้องว่าง", query: "มีกล้องอะไรว่างในคลังบ้าง" },
  { label: "💡 ค้นหาอุปกรณ์ไฟ", query: "มีไฟและอุปกรณ์จัดแสงอะไรพร้อมใช้งานบ้าง" },
  { label: "📤 ของที่ยังไม่คืน", query: "สรุปรายการอุปกรณ์ที่กำลังถูกเบิกออกอยู่ตอนนี้" },
  { label: "🎬 แนะนำ Kit โฆษณา", query: "แนะนำชุดอุปกรณ์สำหรับถ่ายทำโฆษณา (Commercial Shoot)" },
  { label: "🎬 แนะนำ Kit สัมภาษณ์", query: "แนะนำชุดอุปกรณ์สำหรับถ่ายทำสัมภาษณ์ (Interview 2-Cam Setup)" },
  { label: "📊 สรุปยอดสต๊อก", query: "สรุปภาพรวมจำนวนสต๊อกทั้งหมดในระบบ" },
];

export default function AIAgentPage() {
  const nav = useNavigate();
  const { tenant } = useTenant();
  const { user, roles } = useAuth();
  const { t } = useLang();

  // Settings State
  const [settings, setSettings] = useState<AISettings>(loadAISettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Department Mode
  const [selectedDept, setSelectedDept] = useState<string>("all");

  // Knowledge Base Sources
  const [sources, setSources] = useState<KnowledgeSource[]>(() => {
    try {
      const raw = localStorage.getItem("filmflow_inventory_ai_sources");
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore malformed local source data and start with an empty knowledge base.
    }
    return [];
  });
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("filmflow_inventory_ai_messages");
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore malformed local chat data and start a fresh conversation.
    }
    return [
      {
        id: "welcome",
        role: "assistant",
        content: `👋 สวัสดีครับ! ผมคือ **Ctrl+ Production Agent** ผู้ช่วยอัจฉริยะด้านการวางแผนอุปกรณ์และคลังสต๊อกสำหรับ **${tenant?.name || "สตูดิโอของคุณ"}**\n\n- ค้นหาอุปกรณ์ตามชื่อ/รหัส\n- เช็คสถานะพร้อมใช้หรือผู้ที่เบิกของไป\n- แนะนำ Kit อุปกรณ์ตามรูปแบบงานกองถ่าย\n- แนบเอกสารอ้างอิง (Call Sheet, PDF, CSV) เพื่อให้ตอบอิงข้อมูลจริงได้`,
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    messageId: string;
    toolCall: ToolCall;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Save messages to local storage
  useEffect(() => {
    try {
      localStorage.setItem("filmflow_inventory_ai_messages", JSON.stringify(messages));
    } catch {
      // Ignore browser storage quota/privacy errors.
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save sources to local storage
  useEffect(() => {
    try {
      localStorage.setItem("filmflow_inventory_ai_sources", JSON.stringify(sources));
    } catch {
      // Ignore browser storage quota/privacy errors.
    }
  }, [sources]);

  const handleSend = async (customQuery?: string) => {
    const text = (customQuery || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build Grounding Sources Context
      const activeSources = sources.filter((s) => s.enabled);
      let sourcesContext = "";
      if (activeSources.length > 0) {
        const sourceBlocks = activeSources.map(
          (s) => `[DOCUMENT: ${s.name} (${s.type})]\n${s.content.slice(0, 40000)}`
        );
        sourcesContext = `\n\n[ATTACHED REFERENCE DOCUMENTS / KNOWLEDGE BASE]\n${sourceBlocks.join("\n\n")}\nRule: When referencing facts from attached documents, mention the document name.`;
      }

      const systemPrompt = `You are Ctrl+ Production Agent on the dedicated Full AI Dashboard for Film & Video Production Inventory.
Studio: ${tenant?.name || "FilmFlow Studio"} (${tenant?.slug || "main"})
User: ${user?.email || "crew"} (Roles: ${roles.join(", ")})
Filter Department: ${selectedDept === "all" ? "All Departments (Art, Equipment, WD)" : selectedDept}
${sourcesContext}

Strict rule: Respond with a valid JSON object matching:
{"tool": "tool_name", "args": {...}} OR {"reply": "คำตอบภาษาไทย..."}`;

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendAgentMessage(history, systemPrompt, settings);

      if (res.toolCall) {
        if (res.isMutating) {
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
      const errReply: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `❌ **เกิดข้อผิดพลาดในการติดต่อ AI:** ${err?.message || String(err)}\n\n💡 *โปรดตรวจสอบ API Key หรือ Base URL โดยกดปุ่ม "ตั้งค่า AI"*`,
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errReply]);
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
      toast.error(err?.message || "Failed to execute tool");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const source = await parseUploadedFile(file);
        setSources((prev) => [source, ...prev]);
        toast.success(`เพิ่มเอกสาร "${file.name}" เข้าคลังความรู้แล้ว (${formatBytes(file.size)})`);
      } catch (err: any) {
        toast.error(`ไม่สามารถอ่านไฟล์ ${file.name}: ${err.message}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddTextSource = () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    const source = createTextSource(newNoteTitle, newNoteContent);
    setSources((prev) => [source, ...prev]);
    setNewNoteTitle("");
    setNewNoteContent("");
    setSourcesModalOpen(false);
    toast.success(`เพิ่มบันทึก "${source.name}" เรียบร้อยแล้ว`);
  };

  const toggleSource = (id: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const deleteSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    toast.info("ลบเอกสารอ้างอิงแล้ว");
  };

  const handleClearChat = () => {
    if (!window.confirm("ต้องการล้างประวัติการสนทนาทั้งหมดหรือไม่?")) return;
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `👋 เริ่มต้นการสนทนาใหม่กับ **Ctrl+ Production Agent** สำหรับ **${tenant?.name || "สตูดิโอของคุณ"}**`,
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setPendingConfirmation(null);
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h4 key={idx} className="font-bold text-sm text-foreground mt-3 mb-1.5">{line.slice(4)}</h4>;
      }
      if (line.startsWith("- ")) {
        return (
          <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground my-1 pl-1">
            <span className="text-primary font-bold">•</span>
            <span>{parseInline(line.slice(2))}</span>
          </div>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-2" />;
      }
      return <p key={idx} className="text-xs leading-relaxed my-1">{parseInline(line)}</p>;
    });
  };

  const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] text-primary">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => nav("/")} title="กลับหน้าคลัง">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <CtrlPlusLogo theme="auto" variant="icon" className="h-7 w-7" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-sm sm:text-base leading-tight">Ctrl+ AI Studio Agent</h1>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    Production Copilot
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tenant?.name ? `สตูดิโอ: ${tenant.name}` : "Film & Video Inventory"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="h-8 text-xs w-auto min-w-[130px] hidden sm:flex">
                <SelectValue placeholder="เลือกแผนก" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกแผนก (All)</SelectItem>
                <SelectItem value="equipment">Equipment / กล้อง</SelectItem>
                <SelectItem value="art">Art Department</SelectItem>
                <SelectItem value="wd">Wardrobe (WD)</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setSourcesModalOpen(true)}
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">เอกสารอ้างอิง</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
                {sources.filter((s) => s.enabled).length}
              </Badge>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSettingsOpen(true)}
              title="ตั้งค่าโมเดล AI"
            >
              <Settings className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleClearChat}
              title="ล้างประวัติการสนทนา"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Chat Layout */}
      <main className="flex-1 container mx-auto px-4 py-4 max-w-4xl flex flex-col justify-between">
        {/* Messages Scroll Area */}
        <div className="flex-1 space-y-4 pb-4 overflow-y-auto font-th">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                      : "bg-card border rounded-tl-none shadow-sm text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5 opacity-80 text-[11px]">
                    {isUser ? (
                      <span className="font-semibold">คุณ</span>
                    ) : (
                      <div className="flex items-center gap-1 font-semibold text-primary">
                        <Sparkles className="w-3 h-3" />
                        <span>Ctrl+ Production Agent</span>
                      </div>
                    )}
                    <span>•</span>
                    <span>{m.timestamp}</span>
                  </div>

                  <div className="text-xs leading-relaxed">
                    {renderMarkdown(m.content)}
                  </div>

                  {/* Mutating Action Confirmation Card */}
                  {m.isMutating && m.toolCall && pendingConfirmation?.messageId === m.id && (
                    <div className="mt-3 p-3.5 rounded-xl bg-muted/60 border border-amber-500/30 text-foreground space-y-2.5">
                      <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        <span>คำขอยืนยันการเปลี่ยนแปลงข้อมูลในคลัง:</span>
                      </div>
                      <div className="font-mono text-xs bg-background p-2.5 rounded-lg border">
                        <div className="text-primary font-bold mb-1">คำสั่ง: {m.toolCall.tool}</div>
                        {Object.entries(m.toolCall.args).map(([k, v]) => (
                          <div key={k} className="text-muted-foreground">
                            {k}: <span className="text-foreground font-semibold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="h-8 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          onClick={() => handleConfirmAction(m.toolCall!)}
                          disabled={loading}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> ยืนยันดำเนินการ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs flex-1"
                          onClick={() => {
                            setPendingConfirmation(null);
                            setMessages((prev) => [
                              ...prev,
                              {
                                id: `cancel-${Date.now()}`,
                                role: "assistant",
                                content: "🚫 ยกเลิกคำสั่งเรียบร้อยแล้ว",
                                timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
                              },
                            ]);
                          }}
                          disabled={loading}
                        >
                          ยกเลิก
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2.5 text-muted-foreground text-xs p-3 rounded-2xl bg-card border w-fit">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>กำลังประมวลผลคำสั่งและค้นหาข้อมูลคลัง...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Action Prompt Pills */}
        <div className="py-2 border-t flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.label}
              onClick={() => handleSend(qa.query)}
              disabled={loading}
              className="whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {qa.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-card p-1.5 rounded-2xl border shadow-sm"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
              accept=".pdf,.txt,.md,.csv,.json,.srt,.fountain"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="แนบไฟล์เอกสาร (PDF, CSV, TXT, MD)"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="พิมพ์ถามสต๊อก, ค้นหากล้อง, วางแผนอุปกรณ์ หรือสั่งงาน AI..."
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs font-th h-9"
              disabled={loading}
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 px-4 rounded-xl gap-1.5 font-semibold text-xs shrink-0"
              disabled={!input.trim() || loading}
            >
              <Send className="w-3.5 h-3.5" />
              <span>ส่ง</span>
            </Button>
          </form>
        </div>
      </main>

      {/* ── Knowledge Sources Dialog ──────────────────────────────── */}
      <Dialog open={sourcesModalOpen} onOpenChange={setSourcesModalOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary font-bold">
              <BookOpen className="w-5 h-5" />
              <DialogTitle className="text-lg">คลังเอกสารอ้างอิง (Knowledge Base)</DialogTitle>
            </div>
            <DialogDescription>
              อัปโหลด Call Sheet, Script, รายการอุปกรณ์ หรือคู่มือ PDF เพื่อให้ AI นำไปอ้างอิงตอบคำถาม
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <UploadCloud className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-xs text-foreground">คลิกเพื่ออัปโหลดไฟล์เอกสาร</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                รองรับไฟล์ .pdf, .csv, .txt, .md, .json, .srt, .fountain (สูงสุด 40,000 ตัวอักษรต่อไฟล์)
              </p>
            </div>

            {/* Manual Note Add */}
            <div className="p-3 bg-muted/40 rounded-xl border space-y-2 text-xs">
              <span className="font-semibold text-foreground">หรือเพิ่มข้อความโน้ตด่วน:</span>
              <Input
                placeholder="หัวข้อโน้ต (เช่น กฎการเบิกไฟกองโฆษณา)"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="h-8 text-xs"
              />
              <textarea
                placeholder="พิมพ์เนื้อหาที่ต้องการให้ AI จดจำ..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="w-full h-20 text-xs p-2 rounded-md border bg-background resize-none focus:outline-hidden"
              />
              <Button size="sm" onClick={handleAddTextSource} className="h-7 text-xs gap-1">
                <Plus className="w-3.5 h-3.5" /> บันทึกโน้ต
              </Button>
            </div>

            {/* List of active sources */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground">
                เอกสารในระบบ ({sources.length} รายการ):
              </span>
              {sources.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">ยังไม่มีเอกสารในคลังความรู้</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {sources.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <button
                          onClick={() => toggleSource(s.id)}
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            s.enabled ? "bg-primary border-primary text-white" : "border-border"
                          }`}
                        >
                          {s.enabled && <Check className="w-3 h-3" />}
                        </button>
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className={`truncate font-medium ${!s.enabled ? "line-through text-muted-foreground" : ""}`}>
                          {s.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({formatBytes(s.sizeBytes)})
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteSource(s.id)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI Settings Dialog ────────────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Settings className="w-5 h-5 text-primary" />
              การตั้งค่า AI Provider
            </DialogTitle>
            <DialogDescription>
              เลือกระบบโมเดล AI สำหรับประมวลผลคำสั่งในหน้า AI Agent
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
                  <SelectItem value="gemini">Google Gemini (คลาวด์แนะนำ - แม่นยำและเร็ว)</SelectItem>
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
            <Button
              size="sm"
              onClick={() => {
                saveAISettings(settings);
                setSettingsOpen(false);
                toast.success("บันทึกการตั้งค่า AI สำเร็จ");
              }}
            >
              บันทึกการตั้งค่า
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
