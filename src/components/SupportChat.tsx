import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Bot, ShieldCheck, User as UserIcon, Send, Loader2, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Msg = {
  id: string;
  sender: "user" | "ai" | "admin" | "system";
  content: string;
  created_at: string;
};

type Category = "order" | "payment" | "wallet" | "rider" | "restaurant" | "other";

const CATEGORY_LABEL: Record<Category, string> = {
  order: "Order",
  payment: "Payment",
  wallet: "Wallet",
  rider: "Rider",
  restaurant: "Restaurant",
  other: "Other",
};

const QUICK_PROMPTS: Record<Category, string[]> = {
  order: ["Where is my order?", "Cancel my order", "Order arrived wrong / missing item"],
  payment: ["Payment failed but money deducted", "Refund status?", "Which payment methods work?"],
  wallet: ["Wallet balance issue", "Withdrawal not received", "How do withdrawals work?"],
  rider: ["Account still pending verification", "How is my earning calculated?", "Change my documents"],
  restaurant: ["My restaurant not approved yet", "Update menu / prices", "Payout / wallet issue"],
  other: ["I need to talk to a human", "How do I reset my password?", "Report a bug"],
};

interface Props {
  /** Which role is opening chat — controls default category and quick prompts */
  role: "customer" | "rider" | "restaurant";
  title?: string;
}

export function SupportChat({ role, title = "Support Chat" }: Props) {
  const { user } = useAuth();
  const defaultCategory: Category =
    role === "rider" ? "rider" : role === "restaurant" ? "restaurant" : "order";

  const [category, setCategory] = useState<Category>(defaultCategory);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"ai" | "escalated" | "resolved">("ai");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load existing conversation
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: convo } = await supabase
        .from("support_conversations")
        .select("id, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (convo) {
        setConversationId(convo.id);
        setStatus(convo.status as any);
        const { data: msgs } = await supabase
          .from("support_messages")
          .select("id, sender, content, created_at")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: true });
        setMessages((msgs as any) ?? []);
        await supabase
          .from("support_conversations")
          .update({ unread_user: false })
          .eq("id", convo.id);
      }
    })();
  }, [user]);

  // Realtime for new messages on this conversation
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`support:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversationId}`,
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
          filter: `id=eq.${conversationId}`,
        },
        (payload: any) => {
          if (payload.new?.status) setStatus(payload.new.status);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !user) return;
    setSending(true);
    // Optimistic user bubble
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      sender: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: { message: msg, category },
      });
      if (error) throw error;
      if (data?.escalated) {
        toast.success("Escalated to a human agent — you'll get a reply soon.");
      }
      // Fetch fresh conversation + messages (dedupes optimistic tmp bubble)
      const { data: convo } = await supabase
        .from("support_conversations")
        .select("id, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (convo) {
        setConversationId(convo.id);
        setStatus(convo.status as any);
        const { data: msgs } = await supabase
          .from("support_messages")
          .select("id, sender, content, created_at")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: true });
        setMessages((msgs as any) ?? []);
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not send message");
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="flex flex-col overflow-hidden h-[calc(100vh-10rem)] min-h-[500px]">
        {/* Header */}
        <div className="p-4 border-b bg-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
              <Headphones className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sm">{title}</div>
              <div className="text-xs text-muted-foreground">
                {status === "escalated"
                  ? "Talking to a human agent"
                  : status === "resolved"
                    ? "This chat was resolved"
                    : "AI assistant — replies in seconds"}
              </div>
            </div>
          </div>
          <Badge
            variant={status === "escalated" ? "destructive" : status === "resolved" ? "secondary" : "outline"}
            className="text-[10px] capitalize"
          >
            {status === "ai" ? "AI" : status}
          </Badge>
        </div>

        {/* Category chips */}
        <div className="px-4 py-2 border-b bg-muted/30 flex gap-2 overflow-x-auto">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors",
                category === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent",
              )}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Hi! How can we help you today?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pick a topic above, or tap a quick question below.
                  </p>
                </div>
                <div className="flex flex-col gap-2 max-w-md mx-auto">
                  {QUICK_PROMPTS[category].map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-sm px-4 py-2.5 rounded-xl border bg-card hover:bg-accent text-left transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              if (m.sender === "system") {
                return (
                  <div key={m.id} className="text-center text-xs text-muted-foreground italic px-4">
                    {m.content}
                  </div>
                );
              }
              const isMe = m.sender === "user";
              const isAi = m.sender === "ai";
              return (
                <div key={m.id} className={cn("flex gap-2", isMe ? "justify-end" : "justify-start")}>
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {isAi ? (
                        <Bot className="w-4 h-4 text-primary" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : isAi
                          ? "bg-muted rounded-bl-sm"
                          : "bg-accent/20 border border-accent/40 rounded-bl-sm",
                    )}
                  >
                    <div className="text-[10px] uppercase opacity-70 mb-0.5">
                      {isMe ? "You" : isAi ? "Assistant" : "Support Agent"}
                    </div>
                    {m.content}
                  </div>
                  {isMe && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="flex gap-2 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="p-3 border-t bg-card flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={status === "resolved" ? "Send a new message to reopen…" : "Type your message…"}
            rows={1}
            className="resize-none min-h-[44px] max-h-32"
            disabled={sending}
          />
          <Button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            size="icon"
            className="h-11 w-11 gradient-primary flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default SupportChat;
