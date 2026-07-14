import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "cancel_order",
  title: "Cancel order",
  description:
    "Cancel an order. Customers can cancel only before it enters preparation; restaurant owners and admins can cancel any time before pickup. Requires a reason.",
  inputSchema: {
    order_id: z.string().uuid().describe("Order id to cancel."),
    reason: z.string().trim().min(3).describe("Human-readable cancellation reason."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ order_id, reason }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("cancel_order", {
      _order_id: order_id,
      _reason: reason,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Order cancelled. Result: ${JSON.stringify(data)}` }],
      structuredContent: { ok: data === true },
    };
  },
});
