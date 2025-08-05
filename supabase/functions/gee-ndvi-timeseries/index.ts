import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SERVICE_ACCOUNT_KEY = Deno.env.get('GEE_SERVICE_ACCOUNT');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🌱 NDVI Time Series function called');
    
    const { latitude, longitude, startDate, endDate } = await req.json();
    console.log('📍 Request params:', { latitude, longitude, startDate, endDate });

    if (!SERVICE_ACCOUNT_KEY) {
      throw new Error('GEE_SERVICE_ACCOUNT not configured');
    }

    // Parse service account key
    const serviceAccount = JSON.parse(SERVICE_ACCOUNT_KEY);
    console.log('🔑 Service account loaded:', serviceAccount.client_email);

    // Create JWT for GEE authentication (copied from working function)
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/earthengine",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    };

    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    // Process private key exactly like the working function
    const privateKeyPem = serviceAccount.private_key;
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = privateKeyPem.replace(pemHeader, "").replace(pemFooter, "").replace(/\\n/g, "").replace(/\s/g, "");
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5", 
      cryptoKey,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const jwt = `${headerB64}.${payloadB64}.${signatureB64}`;
    console.log('✅ JWT created successfully');

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
    }
    console.log('✅ Access token obtained');

    // Create NDVI time series expression for GEE
    const geeExpression = `
var geometry = ee.Geometry.Point([${longitude}, ${latitude}]);
var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate('${startDate}', '${endDate}')
  .filterBounds(geometry)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

var ndviCollection = collection.map(function(img) {
  var ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return ndvi.copyProperties(img, ['system:time_start']);
});

var timeSeries = ndviCollection.map(function(img) {
  var value = img.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e9
  });
  return ee.Feature(null, {
    'NDVI': value.get('NDVI'),
    'date': img.get('system:time_start')
  });
});

timeSeries;`.trim();

    console.log('🌍 Sending request to GEE...');

    // Send request to GEE
    const geeResponse = await fetch(
      "https://earthengine.googleapis.com/v1/projects/earthengine-public:compute",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expression: geeExpression }),
      }
    );

    if (!geeResponse.ok) {
      const errorText = await geeResponse.text();
      throw new Error(`GEE API error: ${geeResponse.status} - ${errorText}`);
    }

    const geeData = await geeResponse.json();
    console.log('📊 GEE Response received:', geeData);

    // Handle async operations
    if (geeData.name) {
      console.log('⏳ Polling operation:', geeData.name);
      
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pollResponse = await fetch(
          `https://earthengine.googleapis.com/v1/${geeData.name}`,
          {
            headers: { "Authorization": `Bearer ${tokenData.access_token}` }
          }
        );
        
        const pollData = await pollResponse.json();
        
        if (pollData.done) {
          if (pollData.error) {
            throw new Error(`GEE operation failed: ${JSON.stringify(pollData.error)}`);
          }
          
          const features = pollData.result?.features || [];
          const timeSeries = features
            .map((feature: any) => ({
              date: new Date(parseInt(feature.properties.date || feature.properties['system:time_start'])),
              ndvi: parseFloat(feature.properties.NDVI || 0)
            }))
            .filter((point: any) => !isNaN(point.ndvi) && point.ndvi !== null && isFinite(point.ndvi))
            .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

          console.log(`✅ Success! ${timeSeries.length} NDVI points processed`);

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
      }
      
      throw new Error('Operation timed out');
    }

    // Handle direct response
    const features = geeData.features || [];
    const timeSeries = features
      .map((feature: any) => ({
        date: new Date(parseInt(feature.properties.date || feature.properties['system:time_start'])),
        ndvi: parseFloat(feature.properties.NDVI || 0)
      }))
      .filter((point: any) => !isNaN(point.ndvi) && point.ndvi !== null && isFinite(point.ndvi))
      .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

    console.log(`✅ Success! ${timeSeries.length} NDVI points processed`);

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
    console.error('❌ NDVI Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});