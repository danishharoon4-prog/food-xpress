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
  name: "list_restaurants",
  title: "List restaurants",
  description:
    "List approved, active restaurants on FoodExpress. Optional city filter and text search on name/cuisine.",
  inputSchema: {
    city: z.string().trim().optional().describe("Filter by city, e.g. 'Mansehra'."),
    search: z.string().trim().optional().describe("Search text matched against name or cuisine."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ city, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("restaurants")
      .select("id, name, cuisine_type, city, address, is_active, image_url")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .limit(limit ?? 20);
    if (city) q = q.ilike("city", city);
    if (search) q = q.or(`name.ilike.%${search}%,cuisine_type.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { restaurants: data ?? [] },
    };
  },
});
