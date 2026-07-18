// Public edge function to serve the latest Android APK via a redirect to a signed URL.
// Usage: GET /functions/v1/download-apk           -> redirects to active release
//        GET /functions/v1/download-apk?id=<uuid> -> redirects to specific release
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabase.from("app_releases").select("file_path, version").limit(1);
    query = id ? query.eq("id", id) : query.eq("is_active", true).order("created_at", { ascending: false });

    const { data: release, error } = await query.maybeSingle();
    if (error) throw error;
    if (!release) {
      return new Response(
        JSON.stringify({ error: "No active release found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const filename = `food-xpress-${release.version}.apk`;
    const { data: signed, error: signErr } = await supabase.storage
      .from("app-releases")
      .createSignedUrl(release.file_path, 60 * 10, { download: filename });

    if (signErr || !signed?.signedUrl) throw signErr || new Error("Failed to sign URL");

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: signed.signedUrl },
    });
  } catch (e) {
    console.error("download-apk error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
