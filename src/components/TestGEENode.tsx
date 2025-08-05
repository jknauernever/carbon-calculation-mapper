import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const TestGEENode: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testGEENode = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing GEE Node.js client integration...');
      
      const { data, error } = await supabase.functions.invoke('gee-ndvi-node', {
        body: {}
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      console.log('✅ Function response:', data);

      if (data.success) {
        setResult(data);
        toast.success(`Success! NDVI mean: ${data.data.ndviMean?.toFixed(4) || 'N/A'}`);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
      toast.error(`Test failed: ${error.message}`);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>🚀 Test GEE Node.js Client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Method:</strong> Official Google Earth Engine JavaScript client</p>
            <p><strong>Location:</strong> Point(-120.0, 37.0) - California</p>
            <p><strong>Date Range:</strong> 2020-01-01 to 2020-12-31</p>
            <p><strong>Dataset:</strong> MODIS/006/MOD13Q1 NDVI</p>
            <p><strong>Operation:</strong> Mean NDVI for the year</p>
          </div>

          <Button 
            onClick={testGEENode} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Testing GEE Node Client...' : 'Test GEE Node.js Integration'}
          </Button>

          {result && (
            <div className="mt-4">
              {result.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">NDVI Mean:</span>
                      <span className="font-semibold ml-2">
                        {result.data.ndviMean?.toFixed(4) || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dataset:</span>
                      <span className="font-semibold ml-2">{result.data.dataset}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scale:</span>
                      <span className="font-semibold ml-2">{result.data.scale}m</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Year:</span>
                      <span className="font-semibold ml-2">{result.data.year}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">Full JSON Response:</h4>
                    <div className="bg-muted p-3 rounded text-xs font-mono max-h-60 overflow-y-auto">
                      <pre>{JSON.stringify(result, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-destructive/10 p-3 rounded">
                  <p className="text-destructive font-semibold">Error:</p>
                  <p className="text-sm">{result.error}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};