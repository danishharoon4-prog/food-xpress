import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Bot, User, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ISSUE_TYPES = [
  { value: "order", label: "Order Issue" },
  { value: "payment", label: "Payment" },
  { value: "wallet", label: "Wallet" },
  { value: "rider", label: "Rider" },
  { value: "restaurant", label: "Restaurant" },
  { value: "other", label: "Other" },
] as const;

type IssueType = (typeof ISSUE_TYPES)[number]["value"];

type Msg = {
  id: string;
  sender: "user" | "ai" | "admin" | "system";
  content: string;
  created_at: string;
};

export function SupportChatWidget() {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [status, setStatus] = useState<"ai" | "escalated" | "resolved">("ai");
  const [issueType, setIssueType] = useState<IssueType>("order");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Don't show for admins (they have the admin support page) or unauthenticated users
  if (!user || role === "admin") return null;

  const loadConversation = async () => {
    if (!user) return;
    const { data: convo } = await supabase
      .from("support_conversations")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (convo) {
      setConvoId(convo.id);
      setStatus((convo.status as any) ?? "ai");
      const { data: msgs } = await supabase
        .from("support_messages")
        .select("id, sender, content, created_at")
        .eq("conversation_id", convo.id)
        .order("created_at", { ascending: true });
      setMessages((msgs as any) ?? []);
    }
  };

  useEffect(() => {
    if (open) loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  // Realtime updates for admin replies
  useEffect(() => {
    if (!convoId) return;
    const ch = supabase
      .channel(`support:${convoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${convoId}`,
        },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_conversations",
          filter: `id=eq.${convoId}`,
        },
        (payload) => {
          const c = payload.new as any;
          setStatus(c.status ?? "ai");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [convoId]);

  useEffect(() => {
    // auto-scroll
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    // optimistic
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      sender: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: { message: text, category: issueType },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      // Realtime will deliver actual rows; reload to sync ids
      await loadConversation();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className={cn(
          "fixed z-[60] bottom-24 md:bottom-6 right-4 md:right-6",
          "w-14 h-14 rounded-full gradient-primary text-primary-foreground shadow-glow",
          "flex items-center justify-center transition-transform hover-scale animate-float",
        )}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-[60] bottom-40 md:bottom-24 right-4 md:right-6",
            "w-[calc(100vw-2rem)] max-w-sm h-[70vh] max-h-[560px]",
            "bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden animate-pop-in",
          )}
        >
          {/* Header */}
          <div className="p-4 gradient-primary text-primary-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                {status === "escalated" ? <ShieldCheck className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div>
                <div className="font-semibold text-sm">FoodXpress Support</div>
                <div className="text-xs opacity-90">
                  {status === "escalated" ? "Human admin" : "AI assistant · 24/7"}
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {status === "escalated" ? "LIVE" : "AI"}
            </Badge>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="p-4 space-y-3 h-full">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <Bot className="w-8 h-8 mx-auto mb-2 text-primary" />
                  Hi! How can we help today? Ask about your order, payment, or anything else.
                </div>
              )}
              {messages.map((m) => {
                if (m.sender === "system") {
                  return (
                    <div key={m.id} className="text-center text-xs text-muted-foreground italic py-1">
                      {m.content}
                    </div>
                  );
                }
                const isUser = m.sender === "user";
                return (
                  <div key={m.id} className={cn("flex gap-2 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {m.sender === "admin" ? (
                          <ShieldCheck className="w-4 h-4 text-primary" />
                        ) : (
                          <Bot className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                        isUser
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : m.sender === "admin"
                            ? "bg-accent/10 text-foreground border border-accent/30 rounded-bl-sm"
                            : "bg-muted text-foreground rounded-bl-sm",
                      )}
                    >
                      {m.content}
                    </div>
                    {isUser && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
              {sending && (
                <div className="flex gap-2 justify-start animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl px-3 py-2 text-sm flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Composer */}
          <div className="p-3 border-t bg-card space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-muted-foreground shrink-0">
                Issue type
              </label>
              <Select value={issueType} onValueChange={(v) => setIssueType(v as IssueType)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Describe your ${issueType} issue...`}
                rows={1}
                className="resize-none min-h-[40px] max-h-24"
                disabled={sending}
              />
              <Button
                onClick={send}
                disabled={sending || !input.trim()}
                size="icon"
                className="h-10 w-10 flex-shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            {status !== "escalated" && (
              <p className="text-[10px] text-muted-foreground text-center">
                AI responses. Ask for "human admin" to escalate.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
