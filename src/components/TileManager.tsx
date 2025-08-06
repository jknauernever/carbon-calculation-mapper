import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMapTiles, Dataset } from '@/hooks/useMapTiles';

interface TileManagerProps {
  map: mapboxgl.Map | null;
  selectedDataset: Dataset | null;
}

export const TileManager: React.FC<TileManagerProps> = ({ map, selectedDataset }) => {
  const { activeTile, isLoading, loadTile, clearTile } = useMapTiles();
  const currentLayerId = useRef<string | null>(null);

  // Load tile when dataset selected
  useEffect(() => {
    if (selectedDataset) {
      console.log('📊 DATASET SELECTED:', selectedDataset.name);
      loadTile(selectedDataset);
    }
  }, [selectedDataset, loadTile]);

  // Apply tile to map when available
  useEffect(() => {
    if (!map || !activeTile) {
      return;
    }

    console.log('🗺️ APPLYING TILE TO MAP');

    // Remove previous layer if exists
    if (currentLayerId.current) {
      try {
        if (map.getLayer(currentLayerId.current)) {
          map.removeLayer(currentLayerId.current);
          console.log('🧹 Removed previous layer:', currentLayerId.current);
        }
        if (map.getSource(currentLayerId.current)) {
          map.removeSource(currentLayerId.current);
          console.log('🧹 Removed previous source:', currentLayerId.current);
        }
      } catch (error) {
        console.log('⚠️ Error removing previous layer/source:', error);
      }
    }

    const layerId = `tile-${activeTile.dataset.id}`;
    currentLayerId.current = layerId;

    try {
      // Add tile source
      map.addSource(layerId, {
        type: 'raster',
        tiles: [activeTile.tileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 18
      });

      // Add tile layer
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: layerId,
        paint: {
          'raster-opacity': 0.8,
          'raster-contrast': 0.3,
          'raster-saturation': 1.2
        }
      });

      console.log('✅ TILE LAYER ADDED:', layerId);

      // Zoom to data area for NDVI/EVI
      if (activeTile.dataset.id === 'ndvi' || activeTile.dataset.id === 'evi') {
        map.flyTo({
          center: [-94.0, 40.0], // Iowa/Nebraska corn belt
          zoom: 8,
          duration: 2000
        });
      }

    } catch (error) {
      console.error('❌ Error adding tile layer:', error);
    }
  }, [map, activeTile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map && currentLayerId.current) {
        try {
          if (map.getLayer(currentLayerId.current)) {
            map.removeLayer(currentLayerId.current);
          }
          if (map.getSource(currentLayerId.current)) {
            map.removeSource(currentLayerId.current);
          }
        } catch (error) {
          console.log('Cleanup error:', error);
        }
      }
    };
  }, [map]);

  return null; // This component doesn't render anything
};