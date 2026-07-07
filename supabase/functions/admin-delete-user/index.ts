import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, service);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const { user_id } = await req.json();
    if (!user_id) return json({ error: "user_id required" }, 400);
    if (user_id === caller.id) return json({ error: "Cannot delete yourself" }, 400);

    // Pre-clean rows tied to owned restaurants before removing the auth user.
    // User-owned rows cascade from auth.users; restaurant-owned data does not.
    const { error: favoritesError } = await admin.from("favorite_restaurants").delete().eq("user_id", user_id);
    if (favoritesError) return json({ error: favoritesError.message }, 400);

    const { error: restaurantsError } = await admin.from("restaurants").delete().eq("owner_id", user_id);
    if (restaurantsError) return json({ error: restaurantsError.message }, 400);

    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) {
      console.error("deleteUser failed:", JSON.stringify(error), error);
      return json({ error: error.message || "Database error deleting user" }, 400);
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
