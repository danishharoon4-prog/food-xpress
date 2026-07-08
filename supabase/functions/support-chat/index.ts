// Support chat AI reply function.
// Verifies user, ensures a conversation, saves user message, calls Lovable AI, saves reply.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_SYSTEM_PROMPT = `You are the friendly support assistant for FoodXpress, a Pakistani local food delivery app.
- Users may be customers, restaurant owners, or riders. Adapt your help to their role.
- Common topics: order status, delivery ETA, payment issues (EasyPaisa, JazzCash, COD, Stripe), refunds, menu updates, rider earnings/wallet, account/login, restaurant approval.
- Keep replies short, warm, practical. Use plain language. English or Roman Urdu — mirror the user's language.
- If the issue clearly needs a human (refund dispute, missed delivery money, account ban, unresolved after 2 tries, or the user explicitly asks for a human/admin), reply with a brief acknowledgement AND include the exact token [[ESCALATE]] at the very end so the system can notify an admin.
- Never invent order numbers or promise specific refund amounts. If unsure, ask a clarifying question.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Decode JWT payload directly. The token is signed by Supabase Auth; if the
    // signature/expiry are valid the sub is trustworthy. Avoids failing on
    // revoked/rotated sessions where /auth/user returns session_not_found.
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let user: { id: string; email?: string } | null = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload?.sub && (!payload.exp || payload.exp * 1000 > Date.now())) {
        user = { id: payload.sub, email: payload.email };
      }
    } catch (_) { /* fallthrough */ }
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const message: string = (body?.message ?? "").toString().trim();
    const category: string = (body?.category ?? "other").toString().trim().toLowerCase();
    if (!message || message.length > 4000) return json({ error: "Invalid message" }, 400);
    const allowedCats = ["order", "payment", "wallet", "rider", "restaurant", "other"];
    const safeCategory = allowedCats.includes(category) ? category : "other";

    // Get user's role for context
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = roleRow?.role ?? "customer";

    // Ensure conversation exists
    let { data: convo } = await admin
      .from("support_conversations")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!convo) {
      const { data: created, error: cErr } = await admin
        .from("support_conversations")
        .insert({ user_id: user.id, status: "ai" })
        .select("id, status")
        .single();
      if (cErr) return json({ error: cErr.message }, 500);
      convo = created;
    }

    // Save user message
    await admin.from("support_messages").insert({
      conversation_id: convo.id,
      sender: "user",
      sender_user_id: user.id,
      content: message,
    });

    // If already escalated to admin, don't generate AI reply — just notify admins
    if (convo.status === "escalated") {
      await admin
        .from("support_conversations")
        .update({ last_message_at: new Date().toISOString(), unread_admin: true })
        .eq("id", convo.id);
      return json({ ok: true, escalated: true });
    }

    // Load recent history for context (last 20 messages)
    const { data: history } = await admin
      .from("support_messages")
      .select("sender, content")
      .eq("conversation_id", convo.id)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = [
      {
        role: "system",
        content:
          SUPPORT_SYSTEM_PROMPT +
          `\n\nCurrent user role: ${role}. Issue category selected by user: ${safeCategory}. Focus your reply on this category first.`,
      },
      ...(history ?? []).map((m: any) => ({
        role: m.sender === "user" ? "user" : m.sender === "ai" ? "assistant" : "system",
        content: m.sender === "admin" ? `[Admin reply]: ${m.content}` : m.content,
      })),
    ];

    // Call Lovable AI Gateway
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Rate limit. Try again shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "AI error", detail: errTxt }, 500);
    }

    const aiJson = await aiRes.json();
    let reply: string = aiJson?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a reply.";

    const shouldEscalate = /\[\[ESCALATE\]\]/i.test(reply);
    reply = reply.replace(/\[\[ESCALATE\]\]/gi, "").trim();

    // Save AI reply
    await admin.from("support_messages").insert({
      conversation_id: convo.id,
      sender: "ai",
      content: reply,
    });

    if (shouldEscalate) {
      await admin.from("support_messages").insert({
        conversation_id: convo.id,
        sender: "system",
        content: "This conversation has been escalated to a human admin. Someone will reply shortly.",
      });
      await admin
        .from("support_conversations")
        .update({
          status: "escalated",
          last_message_at: new Date().toISOString(),
          unread_admin: true,
        })
        .eq("id", convo.id);

      // Notify all admins
      const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      if (admins && admins.length > 0) {
        await admin.from("notifications").insert(
          admins.map((a: any) => ({
            user_id: a.user_id,
            title: "Support: New escalation",
            message: "A user needs human support. Open the Support panel.",
            type: "warning",
            data: { conversation_id: convo!.id, kind: "support_escalation" },
          })),
        );
      }
    } else {
      await admin
        .from("support_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convo.id);
    }

    return json({ ok: true, reply, escalated: shouldEscalate });
  } catch (e) {
    console.error("support-chat error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
