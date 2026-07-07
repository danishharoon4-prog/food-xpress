import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Bot, ShieldCheck, User, Send, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Convo = {
  id: string;
  user_id: string;
  status: "ai" | "escalated" | "resolved";
  last_message_at: string;
  unread_admin: boolean;
  profile?: { full_name: string | null; email: string | null };
};

type Msg = {
  id: string;
  sender: "user" | "ai" | "admin" | "system";
  content: string;
  created_at: string;
};

export default function AdminSupport() {
  const { user } = useAuth();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "escalated" | "ai" | "resolved">("escalated");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConvos = async () => {
    const { data } = await supabase
      .from("support_conversations")
      .select("id, user_id, status, last_message_at, unread_admin")
      .order("last_message_at", { ascending: false });

    if (!data) return;
    // fetch profiles separately
    const userIds = data.map((c: any) => c.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setConvos(
      data.map((c: any) => ({ ...c, profile: pmap.get(c.user_id) })) as Convo[],
    );
  };

  useEffect(() => {
    loadConvos();
    const ch = supabase
      .channel("admin-support")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => loadConvos(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("id, sender, content, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      setMessages((data as any) ?? []);
      // clear unread_admin flag
      await supabase
        .from("support_conversations")
        .update({ unread_admin: false })
        .eq("id", activeId);
    })();

    const ch = supabase
      .channel(`admin-msgs:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !activeId || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: activeId,
        sender: "admin",
        sender_user_id: user.id,
        content: reply.trim(),
      });
      if (error) throw error;
      // Mark escalated (in case still ai) & set unread_user
      await supabase
        .from("support_conversations")
        .update({
          status: "escalated",
          last_message_at: new Date().toISOString(),
          unread_user: true,
          unread_admin: false,
        })
        .eq("id", activeId);
      // Notify the user
      const convo = convos.find((c) => c.id === activeId);
      if (convo) {
        await supabase.from("notifications").insert({
          user_id: convo.user_id,
          title: "Support reply",
          message: reply.trim().slice(0, 140),
          type: "info",
          data: { kind: "support_reply", conversation_id: activeId },
        });
      }
      setReply("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const markResolved = async () => {
    if (!activeId) return;
    await supabase
      .from("support_conversations")
      .update({ status: "resolved" })
      .eq("id", activeId);
    toast.success("Marked as resolved");
    loadConvos();
  };

  const filtered = convos.filter((c) => filter === "all" || c.status === filter);
  const active = convos.find((c) => c.id === activeId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-8rem)]">
      {/* List */}
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Conversations
          </h2>
          <div className="flex gap-1 flex-wrap">
            {(["escalated", "ai", "resolved", "all"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs capitalize"
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">No conversations.</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "w-full text-left p-3 border-b hover:bg-accent/50 transition-colors",
                activeId === c.id && "bg-accent/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">
                  {c.profile?.full_name || c.profile?.email || "User"}
                </span>
                {c.unread_admin && <span className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="flex items-center justify-between mt-1">
                <Badge
                  variant={c.status === "escalated" ? "destructive" : c.status === "resolved" ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {c.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                </span>
              </div>
            </button>
          ))}
        </ScrollArea>
      </Card>

      {/* Thread */}
      <Card className="flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a conversation to view messages.
          </div>
        ) : (
          <>
            <div className="p-3 border-b flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">
                  {active.profile?.full_name || active.profile?.email}
                </div>
                <div className="text-xs text-muted-foreground">Status: {active.status}</div>
              </div>
              {active.status !== "resolved" && (
                <Button size="sm" variant="outline" onClick={markResolved}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Resolve
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="p-4 space-y-3">
                {messages.map((m) => {
                  if (m.sender === "system") {
                    return (
                      <div key={m.id} className="text-center text-xs text-muted-foreground italic">
                        {m.content}
                      </div>
                    );
                  }
                  const isAdmin = m.sender === "admin";
                  const isAi = m.sender === "ai";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex gap-2", isAdmin ? "justify-end" : "justify-start")}
                    >
                      {!isAdmin && (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {isAi ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                          isAdmin
                            ? "bg-primary text-primary-foreground"
                            : isAi
                              ? "bg-muted"
                              : "bg-accent/20 border border-accent/30",
                        )}
                      >
                        <div className="text-[10px] uppercase opacity-70 mb-0.5">
                          {isAi ? "AI" : isAdmin ? "You" : "Customer"}
                        </div>
                        {m.content}
                      </div>
                      {isAdmin && (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="p-3 border-t flex gap-2 items-end">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Type your reply..."
                rows={1}
                className="resize-none min-h-[40px] max-h-24"
              />
              <Button onClick={sendReply} disabled={sending || !reply.trim()} size="icon" className="h-10 w-10">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
