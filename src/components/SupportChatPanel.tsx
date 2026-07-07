import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, ShieldCheck, Loader2, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function SupportChatPanel({ defaultIssueType = "order" as IssueType }) {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [status, setStatus] = useState<"ai" | "escalated" | "resolved">("ai");
  const [issueType, setIssueType] = useState<IssueType>(defaultIssueType);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

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
      await loadConversation();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  if (!user || role === "admin") return null;

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <CardHeader className="gradient-primary text-primary-foreground p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              {status === "escalated" ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <LifeBuoy className="w-6 h-6" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg font-display">Support Center</CardTitle>
              <p className="text-xs opacity-90 mt-0.5">
                {status === "escalated"
                  ? "Connected with human admin"
                  : "AI assistant · Ready 24/7"}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] font-semibold">
            {status === "escalated" ? "LIVE AGENT" : status === "resolved" ? "RESOLVED" : "AI"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          <div ref={scrollRef} className="p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
                  <Bot className="w-8 h-8" />
                </div>
                <p className="font-semibold text-sm">How can we help you today?</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  Ask anything about your orders, payments, delivery, or account. Type "human admin" to talk to a real person.
                </p>
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
                <div
                  key={m.id}
                  className={cn("flex gap-2 animate-fade-in", isUser ? "justify-end" : "justify-start")}
                >
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
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm",
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

        <div className="p-3 border-t bg-muted/30 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-muted-foreground shrink-0">
              Issue type
            </label>
            <Select value={issueType} onValueChange={(v) => setIssueType(v as IssueType)}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-card">
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
              className="resize-none min-h-[42px] max-h-28 bg-card"
              disabled={sending}
            />
            <Button
              onClick={send}
              disabled={sending || !input.trim()}
              size="icon"
              className="h-[42px] w-[42px] flex-shrink-0 shadow-md"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {status !== "escalated" && (
            <p className="text-[10px] text-muted-foreground text-center">
              AI-powered responses. Ask for "human admin" to escalate to our support team.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
