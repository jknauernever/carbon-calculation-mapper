import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const TestGEEHardcoded: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testGEEIntegration = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing hardcoded GEE integration...');
      
      const { data, error } = await supabase.functions.invoke('test-gee-hardcoded', {
        body: {}
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      console.log('✅ Function response:', data);

      if (data.success) {
        setResult(data);
        toast.success(`Success! Retrieved ${data.data.totalPoints} NDVI data points`);
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
          <CardTitle>🧪 Test GEE Hardcoded Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Location:</strong> Point(-120.0, 37.0) - California</p>
            <p><strong>Date Range:</strong> 2020-01-01 to 2020-12-31</p>
            <p><strong>Dataset:</strong> MODIS/006/MOD13Q1 NDVI</p>
            <p><strong>Scale:</strong> 250 meters</p>
          </div>

          <Button 
            onClick={testGEEIntegration} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Testing GEE Integration...' : 'Test Hardcoded GEE NDVI'}
          </Button>

          {result && (
            <div className="mt-4">
              {result.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Points:</span>
                      <span className="font-semibold ml-2">{result.data.totalPoints}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data Source:</span>
                      <span className="font-semibold ml-2">{result.data.dataSource}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scale:</span>
                      <span className="font-semibold ml-2">{result.data.scale}m</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Poll Attempts:</span>
                      <span className="font-semibold ml-2">{result.pollAttempts || 'Direct'}</span>
                    </div>
                  </div>

                  {result.data.timeSeries && result.data.timeSeries.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">NDVI Time Series (First 10 points):</h4>
                      <div className="bg-muted p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                        {result.data.timeSeries.slice(0, 10).map((point: any, idx: number) => (
                          <div key={idx}>
                            {point.dateString}: NDVI = {point.ndvi?.toFixed(4) || 'N/A'}
                          </div>
                        ))}
                        {result.data.timeSeries.length > 10 && (
                          <div className="text-muted-foreground mt-2">
                            ... and {result.data.timeSeries.length - 10} more points
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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