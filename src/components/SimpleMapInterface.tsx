import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TileManager } from './TileManager';
import { Dataset } from '@/hooks/useMapTiles';
import { DatasetSelector } from './DatasetSelector';

export const SimpleMapInterface: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      console.log('🚀 SIMPLE MAP INITIALIZATION STARTING');

      if (!mapContainer.current || map.current) {
        return;
      }

      try {
        // Get Mapbox token
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error || !data?.token) {
          throw new Error('Failed to get Mapbox token');
        }

        console.log('✅ MAPBOX TOKEN RECEIVED');

        // Set access token
        mapboxgl.accessToken = data.token;

        // Create map
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/satellite-v9',
          center: [-94.0, 40.0], // Start in corn belt region
          zoom: 6,
          projection: 'mercator'
        });

        // Add controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

        // Set loaded state
        map.current.on('load', () => {
          console.log('✅ SIMPLE MAP LOADED SUCCESSFULLY');
          setIsMapLoaded(true);
        });

        map.current.on('error', (e) => {
          console.error('❌ Map error:', e);
          toast.error('Map error occurred');
        });

      } catch (error) {
        console.error('❌ Map initialization error:', error);
        toast.error('Failed to initialize map');
      }
    };

    initMap();

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const handleDatasetSelect = useCallback((dataset: Dataset) => {
    console.log('📊 DATASET SELECTED IN SIMPLE MAP:', dataset.name);
    setSelectedDataset(dataset);
  }, []);

  return (
    <div className="relative w-full h-screen">
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full"
        style={{ background: '#000' }}
      />
      
      {/* Tile Manager */}
      {isMapLoaded && (
        <TileManager 
          map={map.current} 
          selectedDataset={selectedDataset}
        />
      )}
      
      {/* Dataset Selector */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
          <h3 className="text-lg font-semibold mb-3">Select Dataset</h3>
          <DatasetSelector onDatasetSelect={handleDatasetSelect} />
        </div>
      </div>

      {/* Status Indicator */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-black/75 text-white px-3 py-2 rounded-lg text-sm">
          Map: {isMapLoaded ? '✅ Loaded' : '⏳ Loading...'}
          {selectedDataset && (
            <div>Dataset: {selectedDataset.name}</div>
          )}
        </div>
      </div>
    </div>
  );
};