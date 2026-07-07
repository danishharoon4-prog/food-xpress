import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: require an authenticated user for every action. The function
  // proxies calls that consume Google Maps API quota, so unauthenticated
  // access would let anyone drain the app's billing.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      throw new Error("Google Maps API key not configured");
    }

    const { action, ...params } = await req.json();


    switch (action) {
      case "get_key": {
        return new Response(
          JSON.stringify({ key: apiKey }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "geocode": {
        // Reverse geocoding: convert lat/lng to address
        const { latitude, longitude } = params;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("Geocode API response status:", data.status, "error_message:", data.error_message);
        
        if (data.status === "OK" && data.results.length > 0) {
          const result = data.results[0];
          return new Response(
            JSON.stringify({
              address: result.formatted_address,
              components: result.address_components,
              placeId: result.place_id,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Return coordinates as fallback instead of throwing
        return new Response(
          JSON.stringify({
            address: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`,
            fallback: true,
            apiStatus: data.status,
            apiError: data.error_message || null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "autocomplete": {
        // Address autocomplete suggestions
        const { input, sessionToken } = params;
        if (!input || input.length < 2) {
          return new Response(JSON.stringify({ predictions: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          input
        )}&key=${apiKey}&components=country:pk${sessionToken ? `&sessiontoken=${sessionToken}` : ""}`;
        const response = await fetch(url);
        const data = await response.json();
        return new Response(
          JSON.stringify({
            predictions: (data.predictions || []).map((p: any) => ({
              place_id: p.place_id,
              description: p.description,
              main_text: p.structured_formatting?.main_text,
              secondary_text: p.structured_formatting?.secondary_text,
            })),
            status: data.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "place_details": {
        // Get coordinates + formatted address for a place_id
        const { placeId, sessionToken } = params;
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${apiKey}${
          sessionToken ? `&sessiontoken=${sessionToken}` : ""
        }`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === "OK" && data.result) {
          return new Response(
            JSON.stringify({
              address: data.result.formatted_address,
              latitude: data.result.geometry?.location?.lat,
              longitude: data.result.geometry?.location?.lng,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`Place details failed: ${data.status}`);
      }

      case "distance": {
        // Calculate distance between two points
        const { origin, destination } = params;
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${apiKey}&units=metric`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === "OK" && data.rows[0]?.elements[0]?.status === "OK") {
          const element = data.rows[0].elements[0];
          return new Response(
            JSON.stringify({
              distance: element.distance,
              duration: element.duration,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error("Unable to calculate distance");
      }

      case "directions_url": {
        // Generate Google Maps directions URL
        const { origin, destination } = params;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
        
        return new Response(
          JSON.stringify({ url }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error("Invalid action");
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
