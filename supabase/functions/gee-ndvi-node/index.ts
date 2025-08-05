import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🌱 Starting GEE NDVI with JavaScript client library...');

    // Import Earth Engine using require (for Node.js compatibility)
    const ee = require('@google/earthengine');

    // Get service account from environment
    const serviceAccountJson = Deno.env.get('GEE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new Error('GEE_SERVICE_ACCOUNT environment variable not set');
    }

    console.log('🔑 Service account found, parsing...');
    const serviceAccountObject = JSON.parse(serviceAccountJson);

    // Authenticate with Earth Engine using the correct method
    console.log('🔐 Authenticating with Earth Engine...');
    await ee.data.authenticateViaPrivateKey(serviceAccountObject);
    
    console.log('✅ Authentication successful, initializing Earth Engine...');
    await ee.initialize();

    console.log('🌍 Earth Engine initialized, fetching NDVI data...');

    // Define the point geometry
    const point = ee.Geometry.Point([-120.0, 37.0]);

    // Get MODIS NDVI collection
    const ndviCollection = ee.ImageCollection('MODIS/006/MOD13Q1')
      .select('NDVI')
      .filterDate('2020-01-01', '2020-12-31')
      .filterBounds(point);

    // Calculate mean NDVI for the year
    const meanNdvi = ndviCollection.mean();

    // Reduce to get the value at the point
    const ndviValue = meanNdvi.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: point,
      scale: 250,
      maxPixels: 1e9
    });

    console.log('📊 Computing NDVI value...');

    // Get the computed value
    const result = await new Promise((resolve, reject) => {
      ndviValue.evaluate((result: any, error: any) => {
        if (error) {
          console.error('❌ Earth Engine computation error:', error);
          reject(error);
        } else {
          console.log('✅ Computation successful:', result);
          resolve(result);
        }
      });
    });

    // Format response
    const response = {
      success: true,
      data: {
        location: {
          latitude: 37.0,
          longitude: -120.0
        },
        year: 2020,
        dataset: 'MODIS/006/MOD13Q1',
        scale: 250,
        ndviMean: result?.NDVI || null,
        computedAt: new Date().toISOString()
      }
    };

    console.log('🎉 Returning successful result');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in gee-ndvi-node function:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});