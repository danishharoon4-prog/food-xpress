import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquareText, Send, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export type ReviewTargetType = "restaurant" | "rider";

interface Remark {
  id: string;
  author_id: string;
  author_role: "admin" | "owner";
  message: string;
  created_at: string;
}

interface ReviewRemarksProps {
  targetType: ReviewTargetType;
  targetId: string;
  /** True when the current viewer is an admin (posts as admin). */
  isAdmin?: boolean;
  /** Owner's auth user id — used to notify them when an admin posts a remark. */
  ownerUserId?: string | null;
  title?: string;
  className?: string;
}

/**
 * Shared remarks thread for a profile under review.
 * Admin leaves remarks; the profile owner (restaurant / rider) can read them
 * and reply with their own feedback.
 */
export default function ReviewRemarks({
  targetType,
  targetId,
  isAdmin = false,
  ownerUserId,
  title = "Review Remarks",
  className,
}: ReviewRemarksProps) {
  const { user } = useAuth();
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!targetId) return;
    const { data, error } = await supabase
      .from("review_remarks")
      .select("id, author_id, author_role, message, created_at")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("review remarks load", error);
    }
    setRemarks((data as Remark[]) ?? []);
    setLoading(false);
  }, [targetType, targetId]);

  useEffect(() => {
    setLoading(true);
    load();
    const ch = supabase
      .channel(`review-remarks:${targetType}:${targetId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "review_remarks",
          filter: `target_id=eq.${targetId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, targetType, targetId]);

  const send = async () => {
    const message = text.trim();
    if (!message || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("review_remarks").insert({
        target_type: targetType,
        target_id: targetId,
        author_id: user.id,
        author_role: isAdmin ? "admin" : "owner",
        message,
      });
      if (error) throw error;

      if (isAdmin && ownerUserId) {
        // Best-effort notification to the profile owner.
        await supabase
          .from("notifications")
          .insert({
            user_id: ownerUserId,
            title: "Admin remark on your profile",
            message: message.slice(0, 140),
            type: "info",
            data: { kind: "review_remark", target_type: targetType, target_id: targetId },
          })
          .then(({ error: nErr }) => nErr && console.warn("notify owner failed", nErr));
      }

      setText("");
      load();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to post remark");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareText className="w-4 h-4" /> {title}
          {remarks.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{remarks.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : remarks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "No remarks yet. Add a remark — the owner will be able to see and reply."
              : "No remarks from the admin yet."}
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {remarks.map((r) => {
              const mine = r.author_id === user?.id;
              const fromAdmin = r.author_role === "admin";
              return (
                <div key={r.id} className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
                  {!mine && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {fromAdmin ? (
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      ) : (
                        <User className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <div className="text-[10px] uppercase opacity-70 mb-0.5">
                      {fromAdmin ? "Admin" : "Owner"} ·{" "}
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </div>
                    {r.message}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 items-end pt-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={isAdmin ? "Add a remark for the owner..." : "Reply to the admin..."}
            className="resize-none min-h-[40px] max-h-24"
          />
          <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="h-10 w-10">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
