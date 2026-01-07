import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      throw new Error("Google Maps API key not configured");
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "geocode": {
        // Reverse geocoding: convert lat/lng to address
        const { latitude, longitude } = params;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
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
        
        throw new Error("Unable to geocode location");
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
