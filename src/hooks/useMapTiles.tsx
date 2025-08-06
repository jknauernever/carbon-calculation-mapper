import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Dataset {
  id: string;
  name: string;
  description: string;
  category: string;
  collection?: string;
  band?: string;
  temporalResolution?: string;
  spatialResolution?: string;
  defaultPalette?: string;
  min?: number;
  max?: number;
  parameters?: any;
}

export const useMapTiles = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTile, setActiveTile] = useState<{
    dataset: Dataset;
    tileUrl: string;
  } | null>(null);

  const loadTile = useCallback(async (dataset: Dataset) => {
    console.log('🔄 LOADING TILE for dataset:', dataset.name);
    setIsLoading(true);

    try {
      // Get tile URL from edge function
      const { data, error } = await supabase.functions.invoke('get-gee-tiles', {
        body: {
          dataset: dataset.id,
          year: '2024',
          month: '6'
        }
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      if (!data?.tileUrl) {
        throw new Error('No tile URL received');
      }

      console.log('✅ TILE URL received:', data.tileUrl);

      setActiveTile({
        dataset,
        tileUrl: data.tileUrl
      });

      toast.success(`✅ ${dataset.name} tiles loaded successfully`);

    } catch (error) {
      console.error('❌ Tile loading error:', error);
      toast.error(`Failed to load ${dataset.name} tiles`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearTile = useCallback(() => {
    console.log('🧹 CLEARING active tile');
    setActiveTile(null);
  }, []);

  return {
    activeTile,
    isLoading,
    loadTile,
    clearTile
  };
};