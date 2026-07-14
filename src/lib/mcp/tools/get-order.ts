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
  name: "get_order",
  title: "Get order details",
  description:
    "Get full details for a single order (RLS enforced — only the customer, assigned rider, restaurant owner, or admin can read it). Includes items.",
  inputSchema: {
    order_id: z.string().uuid().describe("Order id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [{ data: order, error: orderErr }, { data: items, error: itemsErr }] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, status, subtotal, delivery_fee, total, restaurant_id, customer_id, rider_id, delivery_address, special_instructions, estimated_delivery_time, actual_delivery_time, cancellation_reason, created_at"
        )
        .eq("id", order_id)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select("id, item_name, item_price, quantity, subtotal, special_instructions")
        .eq("order_id", order_id),
    ]);
    if (orderErr) return { content: [{ type: "text", text: orderErr.message }], isError: true };
    if (itemsErr) return { content: [{ type: "text", text: itemsErr.message }], isError: true };
    if (!order) {
      return { content: [{ type: "text", text: "Order not found or you do not have access." }], isError: true };
    }
    const payload = { order, items: items ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
