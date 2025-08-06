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

    // If z, x, y are provided, this is a tile request
    if (z && x && y) {
      const tileUrl = `https://gee-tile-server.vercel.app/api/tiles/${z}/${x}/${y}?dataset=${dataset}&year=${year}&month=${month}&apikey=${geeApiKey}`;
      
      console.log('Fetching tile from:', tileUrl);
      
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
    }

    // If no tile coordinates, return tile URL template that bypasses auth
    const tileUrlTemplate = `https://gee-tile-server.vercel.app/api/tiles/{z}/{x}/{y}?dataset=${dataset}&year=${year}&month=${month}&apikey=${geeApiKey}`;
    
    console.log('Generated tile URL template:', tileUrlTemplate);
    
    return new Response(
      JSON.stringify({ 
        tileUrl: tileUrlTemplate,
        dataset,
        year,
        month
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

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