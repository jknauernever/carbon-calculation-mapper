import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geeApiKey = Deno.env.get('GEE_TILE_SERVER_API_KEY');
    
    if (!geeApiKey) {
      console.error('GEE_TILE_SERVER_API_KEY not found in environment');
      return new Response(
        JSON.stringify({ error: 'GEE API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let dataset, year, month, z, x, y;

    // Handle both query parameters and request body
    if (req.method === 'POST') {
      const body = await req.json();
      dataset = body.dataset;
      year = body.year || '2024';
      month = body.month || '6';
      z = body.z;
      x = body.x;
      y = body.y;
      console.log('POST body:', body);
    } else {
      const url = new URL(req.url);
      dataset = url.searchParams.get('dataset');
      year = url.searchParams.get('year') || '2024';
      month = url.searchParams.get('month') || '6';
      z = url.searchParams.get('z');
      x = url.searchParams.get('x');
      y = url.searchParams.get('y');
      console.log('Query params:', { dataset, year, month, z, x, y });
    }

    if (!dataset) {
      return new Response(
        JSON.stringify({ error: 'Dataset parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If z, x, y are provided, this is a tile request - get the tile URL first, then fetch the tile
    if (z && x && y) {
      console.log('Fetching tile for coordinates:', { z, x, y, dataset, year, month });
      
      // First get the tile URL from the Vercel API
      const apiUrl = `https://gee-tile-server.vercel.app/api/tiles?dataset=${dataset}&year=${year}&month=${month}&apikey=${geeApiKey}`;
      
      try {
        const apiResponse = await fetch(apiUrl);
        
        if (!apiResponse.ok) {
          console.error('API response failed:', apiResponse.status);
          return new Response(
            JSON.stringify({ error: `API failed: ${apiResponse.status}` }),
            { 
              status: apiResponse.status, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        const apiData = await apiResponse.json();
        
        if (!apiData.tile_url) {
          console.error('No tile_url in API response:', apiData);
          return new Response(
            JSON.stringify({ error: 'No tile URL available' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        // Now fetch the actual tile from GEE
        const tileUrl = apiData.tile_url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        console.log('Fetching tile from GEE:', tileUrl);
        
        const tileResponse = await fetch(tileUrl);
        
        if (!tileResponse.ok) {
          console.error('Tile fetch failed:', tileResponse.status, tileResponse.statusText);
          return new Response(
            JSON.stringify({ error: `Tile fetch failed: ${tileResponse.status}` }),
            { 
              status: tileResponse.status, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Return the tile data with appropriate headers
        const tileData = await tileResponse.arrayBuffer();
        return new Response(tileData, {
          headers: {
            ...corsHeaders,
            'Content-Type': tileResponse.headers.get('Content-Type') || 'image/png',
            'Cache-Control': 'public, max-age=3600', // Cache tiles for 1 hour
          }
        });
        
      } catch (error) {
        console.error('Error fetching tile:', error);
        return new Response(
          JSON.stringify({ error: `Tile fetch error: ${error.message}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // If no tile coordinates, return our custom URL template directly
    console.log('Returning custom URL template for:', dataset, year, month);
    
    // Return our custom URL that points back to this Supabase function
    const customTileUrl = `https://sereallctpcqrdjmvwrs.supabase.co/functions/v1/get-gee-tiles?dataset=${dataset}&year=${year}&month=${month}&z={z}&x={x}&y={y}`;
    
    return new Response(JSON.stringify({
      tileUrl: customTileUrl,
      dataset: dataset,
      description: "Proxied through Supabase",
      parameters: { year, month }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error in get-gee-tiles function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});