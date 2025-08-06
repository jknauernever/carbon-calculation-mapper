import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching datasets from Vercel API...');
    
    const response = await fetch('https://gee-tile-server.vercel.app/api/datasets');
    
    if (!response.ok) {
      console.error('Vercel API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: `Vercel API error: ${response.status} ${response.statusText}` }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const data = await response.json();
    console.log('Datasets fetched successfully:', data);
    
    // Ensure we return the data in the expected format
    const datasets = Array.isArray(data.datasets) ? data.datasets : 
                    Array.isArray(data) ? data : [];
    
    return new Response(
      JSON.stringify({ 
        datasets,
        count: datasets.length,
        success: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error fetching datasets:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});