import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SERVICE_ACCOUNT_KEY = Deno.env.get('GEE_SERVICE_ACCOUNT');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🌱 Starting GEE NDVI integration with exact specification...');

    if (!SERVICE_ACCOUNT_KEY) {
      throw new Error('GEE_SERVICE_ACCOUNT not configured');
    }

    // Parse service account key
    const serviceAccount = JSON.parse(SERVICE_ACCOUNT_KEY);
    console.log('🔑 Service account loaded:', serviceAccount.client_email);

    // Step 1: Generate JWT for GEE authentication
    console.log('📝 Step 1: Generating JWT...');
    
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/earthengine.readonly",  // Exact scope as specified
      aud: "https://oauth2.googleapis.com/token",                     // Exact aud as specified
      exp: now + 3600,
      iat: now
    };

    console.log('JWT payload:', payload);

    // Encode header and payload
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    // Process private key for signing
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
    console.log('✅ JWT created successfully, length:', jwt.length);

    // Step 2: Exchange JWT for access token
    console.log('🔄 Step 2: Exchanging JWT for access token...');
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);
    console.log('Token data:', tokenData);

    if (!tokenData.access_token) {
      throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
    }
    console.log('✅ Access token obtained successfully');

    // Step 3: Send POST request to GEE REST API (v1beta as specified)
    console.log('🌍 Step 3: Sending POST to GEE v1beta endpoint...');

    const geeRequestBody = {
      "expression": "var geometry = ee.Geometry.Point([-120.0, 37.0]);\\nvar ndvi = ee.ImageCollection('MODIS/006/MOD13Q1')\\n  .select('NDVI')\\n  .filterDate('2020-01-01', '2020-12-31')\\n  .filterBounds(geometry);\\nvar ndviSeries = ndvi.map(function(img) {\\n  var value = img.reduceRegion({\\n    reducer: ee.Reducer.mean(),\\n    geometry: geometry,\\n    scale: 250\\n  });\\n  return ee.Feature(null, value).set('system:time_start', img.get('system:time_start'));\\n});\\nndviSeries;",
      "project": "earthengine-public"
    };

    console.log('Request body:', JSON.stringify(geeRequestBody, null, 2));

    const geeResponse = await fetch(
      "https://earthengine.googleapis.com/v1/projects/earthengine-public/value:compute",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geeRequestBody),
      }
    );

    console.log('GEE response status:', geeResponse.status);

    if (!geeResponse.ok) {
      const errorText = await geeResponse.text();
      console.error('GEE API error:', errorText);
      throw new Error(`GEE API error: ${geeResponse.status} - ${errorText}`);
    }

    const geeData = await geeResponse.json();
    console.log('📊 GEE Response:', geeData);

    // Step 4: Poll for operation completion
    if (geeData.name) {
      console.log('⏳ Step 4: Polling operation:', geeData.name);
      
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        console.log(`Polling attempt ${attempts + 1}/${maxAttempts}...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const pollResponse = await fetch(
          `https://earthengine.googleapis.com/v1/${geeData.name}`,  // Use v1 for polling
          {
            headers: { "Authorization": `Bearer ${tokenData.access_token}` }
          }
        );
        
        const pollData = await pollResponse.json();
        console.log(`Poll ${attempts + 1} result:`, pollData);
        
        if (pollData.done === true) {
          console.log('✅ Operation completed!');
          
          if (pollData.error) {
            throw new Error(`GEE operation failed: ${JSON.stringify(pollData.error)}`);
          }
          
          // Step 5: Process and display NDVI time series
          console.log('📈 Step 5: Processing NDVI time series...');
          
          const features = pollData.result?.features || [];
          console.log(`Found ${features.length} features`);
          
          const timeSeries = features.map((feature: any) => {
            const timestamp = feature.properties['system:time_start'];
            const ndviValue = feature.properties.NDVI;
            
            return {
              date: new Date(parseInt(timestamp)),
              timestamp: timestamp,
              ndvi: ndviValue,
              dateString: new Date(parseInt(timestamp)).toLocaleDateString()
            };
          }).sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

          console.log('✅ Success! NDVI time series processed:', timeSeries);

          return new Response(
            JSON.stringify({
              success: true,
              message: "NDVI time series retrieved successfully for Point(-120.0, 37.0) in California",
              data: {
                location: { longitude: -120.0, latitude: 37.0 },
                dateRange: { start: "2020-01-01", end: "2020-12-31" },
                dataSource: "MODIS/006/MOD13Q1",
                scale: 250,
                totalPoints: timeSeries.length,
                timeSeries: timeSeries
              },
              operationId: geeData.name,
              pollAttempts: attempts + 1
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        attempts++;
      }
      
      throw new Error(`Operation timed out after ${maxAttempts} attempts`);
    }

    // Handle direct response (no operation polling needed)
    console.log('📈 Processing direct response...');
    const features = geeData.features || [];
    const timeSeries = features.map((feature: any) => ({
      date: new Date(parseInt(feature.properties['system:time_start'])),
      ndvi: feature.properties.NDVI,
      dateString: new Date(parseInt(feature.properties['system:time_start'])).toLocaleDateString()
    })).sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

    return new Response(
      JSON.stringify({
        success: true,
        message: "NDVI time series retrieved successfully for Point(-120.0, 37.0) in California",
        data: {
          location: { longitude: -120.0, latitude: 37.0 },
          dateRange: { start: "2020-01-01", end: "2020-12-31" },
          dataSource: "MODIS/006/MOD13Q1",
          scale: 250,
          totalPoints: timeSeries.length,
          timeSeries: timeSeries
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        details: error.stack || 'No stack trace available'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});