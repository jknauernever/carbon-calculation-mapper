import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SERVICE_ACCOUNT_KEY = Deno.env.get('GEE_SERVICE_ACCOUNT');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, startDate, endDate } = await req.json();

    console.log('NDVI request:', { latitude, longitude, startDate, endDate });

    if (!SERVICE_ACCOUNT_KEY) {
      throw new Error('GEE_SERVICE_ACCOUNT not configured');
    }

    // Parse service account key
    const serviceAccount = JSON.parse(SERVICE_ACCOUNT_KEY);

    // Generate JWT for authentication
    const header = {
      alg: "RS256",
      typ: "JWT"
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/earthengine.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(
      `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}`
    );

    // Import private key for signing
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      new TextEncoder().encode(serviceAccount.private_key),
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      data
    );

    const jwt = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response:', tokenData);

    if (!tokenData.access_token) {
      throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
    }

    // Create GEE expression for NDVI time series
    const geeExpression = `
var geometry = ee.Geometry.Point([${longitude}, ${latitude}]);
var ndvi = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate('${startDate}', '${endDate}')
  .filterBounds(geometry)
  .map(function(img) {
    var ndviValue = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
    return ndviValue.copyProperties(img, ['system:time_start']);
  });

var ndviSeries = ndvi.map(function(img) {
  var value = img.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e9
  });
  return ee.Feature(null, value).set('system:time_start', img.get('system:time_start'));
});

ndviSeries;
    `.trim();

    console.log('GEE Expression:', geeExpression);

    // Send request to GEE API
    const geeResponse = await fetch(
      "https://earthengine.googleapis.com/v1/projects/earthengine-public:compute",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expression: geeExpression,
        }),
      }
    );

    const geeData = await geeResponse.json();
    console.log('GEE Response:', geeData);

    if (!geeResponse.ok) {
      throw new Error(`GEE API error: ${JSON.stringify(geeData)}`);
    }

    // Check if we got an operation ID (for async operations)
    if (geeData.name) {
      console.log('Polling operation:', geeData.name);
      
      // Poll for completion
      let operationComplete = false;
      let attempts = 0;
      const maxAttempts = 30;
      
      while (!operationComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const pollResponse = await fetch(
          `https://earthengine.googleapis.com/v1/${geeData.name}`,
          {
            headers: {
              "Authorization": `Bearer ${tokenData.access_token}`,
            },
          }
        );
        
        const pollData = await pollResponse.json();
        console.log(`Poll attempt ${attempts + 1}:`, pollData);
        
        if (pollData.done) {
          operationComplete = true;
          
          if (pollData.error) {
            throw new Error(`GEE operation failed: ${JSON.stringify(pollData.error)}`);
          }
          
          // Extract and format NDVI time series data
          const features = pollData.result?.features || [];
          const timeSeries = features
            .map((feature: any) => ({
              date: new Date(parseInt(feature.properties['system:time_start'])),
              ndvi: feature.properties.NDVI || 0
            }))
            .filter((point: any) => !isNaN(point.ndvi) && point.ndvi !== null)
            .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

          console.log('Processed time series:', timeSeries);

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                timeSeries,
                location: { latitude, longitude },
                dateRange: { startDate, endDate },
                totalPoints: timeSeries.length
              }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        attempts++;
      }
      
      throw new Error('Operation timed out after 60 seconds');
    }

    // Direct response (synchronous)
    const features = geeData.features || [];
    const timeSeries = features
      .map((feature: any) => ({
        date: new Date(parseInt(feature.properties['system:time_start'])),
        ndvi: feature.properties.NDVI || 0
      }))
      .filter((point: any) => !isNaN(point.ndvi) && point.ndvi !== null)
      .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          timeSeries,
          location: { latitude, longitude },
          dateRange: { startDate, endDate },
          totalPoints: timeSeries.length
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('NDVI calculation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});