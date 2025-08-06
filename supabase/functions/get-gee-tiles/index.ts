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

    // If z, x, y are provided, this is a tile request - proxy to the actual API
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

    // If no tile coordinates, get the tile URL from the API and return template
    console.log('Getting tile URL from API for:', dataset, year, month);
    
    // Call the main API endpoint to get the tile URL
    const apiUrl = `https://gee-tile-server.vercel.app/api/tiles?dataset=${dataset}&year=${year}&month=${month}&apikey=${geeApiKey}`;
    console.log('Calling API:', apiUrl);
    
    try {
      const apiResponse = await fetch(apiUrl);
      console.log('API response status:', apiResponse.status);
      console.log('API response content-type:', apiResponse.headers.get('content-type'));
      
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('API error response:', errorText);
        return new Response(
          JSON.stringify({ 
            error: `GEE API failed: ${apiResponse.status} - ${errorText}`,
            apiUrl: apiUrl
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // Get the actual response from the API
      const apiData = await apiResponse.json();
      console.log('API response data:', apiData);
      
      // Check if the API returns a tile_url field
      if (apiData.tile_url) {
        // Use the tile URL returned by the API
        console.log('Got tile URL from API:', apiData.tile_url);
        return new Response(
          JSON.stringify({ 
            tileUrl: apiData.tile_url,
            dataset,
            year,
            month,
            debug: {
              apiKeySet: !!geeApiKey,
              originalResponse: apiData
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } else {
        console.error('No tile_url in API response:', apiData);
        return new Response(
          JSON.stringify({ 
            error: 'No tile_url in API response',
            apiResponse: apiData
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } catch (apiError) {
      console.error('API fetch failed:', apiError);
      return new Response(
        JSON.stringify({ 
          error: `GEE API unreachable: ${apiError.message}`,
          apiUrl: apiUrl
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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