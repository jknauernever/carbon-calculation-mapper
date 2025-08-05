import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Square, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { GEELayerToggle } from "./GEELayerToggle";
import { CarbonResults } from "./CarbonResults";
import { GEEDataVisualization } from "./GEEDataVisualization";
import { supabase } from "@/integrations/supabase/client";

interface CarbonCalculation {
  total_co2e: number;
  above_ground_biomass: number;
  below_ground_biomass: number;
  soil_organic_carbon: number;
  calculation_method: string;
  data_sources?: any;
}

export const MapInterface = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');
  const [drawingMode, setDrawingMode] = useState(false);
  const [coordinates, setCoordinates] = useState<Array<[number, number]>>([]);
  const [selectedArea, setSelectedArea] = useState<{
    coordinates: Array<[number, number]>;
    area: number;
  } | null>(null);
  const [carbonCalculation, setCarbonCalculation] = useState<CarbonCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Record<string, { enabled: boolean; opacity: number }>>({});

  // Initialize map with Mapbox token from Supabase
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        console.log('Fetching Mapbox token...');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          console.error('Supabase function error:', error);
          throw error;
        }
        
        if (data?.token) {
          console.log('Mapbox token received successfully');
          setMapboxToken(data.token);
          initializeMap(data.token);
        } else {
          console.error('No token in response:', data);
          toast.error('Mapbox token not found. Please add MAPBOX_PUBLIC_TOKEN to Supabase Edge Function secrets.');
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        toast.error('Failed to load map. Please configure Mapbox token in Supabase secrets.');
      }
    };

    fetchMapboxToken();
  }, []);

  const initializeMap = useCallback((token?: string) => {
    if (!mapContainer.current || map.current) return;

    const mapboxAccessToken = token || mapboxToken;
    if (!mapboxAccessToken) {
      console.error('No Mapbox token available');
      return;
    }

    mapboxgl.accessToken = mapboxAccessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [-98.5795, 39.8283], // Center of US
      zoom: 4,
      projection: 'mercator'
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.current.on('load', () => {
      setIsMapLoaded(true);
      addMapEventListeners();
    });

    map.current.on('error', (e) => {
      console.error('Map error:', e);
      toast.error('Map failed to load properly');
    });
  }, [mapboxToken]);

  const addMapEventListeners = () => {
    if (!map.current) return;

    map.current.on('click', handleMapClick);
  };

  const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
    if (!drawingMode) return;

    const { lng, lat } = e.lngLat;
    const newCoordinates = [...coordinates, [lng, lat] as [number, number]];
    setCoordinates(newCoordinates);

    if (newCoordinates.length >= 3) {
      addPolygonToMap(newCoordinates);
    }
  };

  const addPolygonToMap = (coords: Array<[number, number]>) => {
    if (!map.current) return;

    // Close the polygon
    const closedCoords = [...coords, coords[0]];

    const polygonGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [closedCoords]
      }
    };

    // Remove existing polygon layers
    if (map.current.getLayer('selected-area-fill')) {
      map.current.removeLayer('selected-area-fill');
    }
    if (map.current.getLayer('selected-area-outline')) {
      map.current.removeLayer('selected-area-outline');
    }
    if (map.current.getSource('selected-area')) {
      map.current.removeSource('selected-area');
    }

    // Add new polygon
    map.current.addSource('selected-area', {
      type: 'geojson',
      data: polygonGeoJSON
    });

    map.current.addLayer({
      id: 'selected-area-fill',
      type: 'fill',
      source: 'selected-area',
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.3
      }
    });

    map.current.addLayer({
      id: 'selected-area-outline',
      type: 'line',
      source: 'selected-area',
      paint: {
        'line-color': '#2563eb',
        'line-width': 2
      }
    });

    // Calculate area
    const area = calculatePolygonArea(coords);
    setSelectedArea({ coordinates: coords, area });
    setDrawingMode(false);
    setCoordinates([]);
  };

  const calculatePolygonArea = (coords: Array<[number, number]>): number => {
    // Simple area calculation using shoelace formula (approximate)
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i][0] * coords[j][1];
      area -= coords[j][0] * coords[i][1];
    }
    return Math.abs(area) / 2 * 111000 * 111000 / 10000; // Convert to hectares (approximate)
  };

  const startDrawing = () => {
    setDrawingMode(true);
    setCoordinates([]);
    clearMap();
    toast.info('Click on the map to draw a polygon. Need at least 3 points.');
  };

  const finishDrawing = () => {
    if (coordinates.length >= 3) {
      addPolygonToMap(coordinates);
      calculateCarbonForArea();
    } else {
      toast.error('Need at least 3 points to create a polygon');
    }
  };

  const clearMap = () => {
    if (!map.current) return;

    // Clear drawing state
    setDrawingMode(false);
    setCoordinates([]);
    setSelectedArea(null);
    setCarbonCalculation(null);

    // Remove map layers
    const layersToRemove = ['selected-area-fill', 'selected-area-outline'];
    layersToRemove.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });

    if (map.current.getSource('selected-area')) {
      map.current.removeSource('selected-area');
    }

    // Clear GEE layers
    Object.keys(activeLayers).forEach(layerId => {
      removeGEELayer(layerId);
    });
    setActiveLayers({});
  };

  const calculateCarbonForArea = async () => {
    if (!selectedArea) return;

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-carbon-gee', {
        body: {
          geometry: {
            type: 'Polygon',
            coordinates: [selectedArea.coordinates]
          },
          areaHectares: selectedArea.area,
        },
      });

      if (error) throw error;

      if (data.success) {
        setCarbonCalculation(data.carbonData);
        toast.success('Carbon calculation completed!');
      } else {
        throw new Error('Calculation failed');
      }
    } catch (error) {
      console.error('Error calculating carbon:', error);
      toast.error('Failed to calculate carbon storage');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleAddressSearch = async () => {
    if (!searchAddress.trim()) return;

    // Mock geocoding - center on a default location
    // In real implementation, use Mapbox Geocoding API
    const mockCoords: [number, number] = [-98.5795, 39.8283];
    
    if (map.current) {
      map.current.flyTo({
        center: mockCoords,
        zoom: 10,
        duration: 2000
      });
    }
    
    toast.success(`Searching for: ${searchAddress}`);
  };

  const handleLayerToggle = (layerId: string, enabled: boolean) => {
    if (enabled) {
      addGEELayer(layerId);
    } else {
      removeGEELayer(layerId);
    }

    setActiveLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], enabled }
    }));
  };

  const handleLayerOpacityChange = (layerId: string, opacity: number) => {
    if (map.current && map.current.getLayer(layerId)) {
      const layerType = map.current.getLayer(layerId)?.type;
      if (layerType === 'raster') {
        map.current.setPaintProperty(layerId, 'raster-opacity', opacity / 100);
      }
    }

    setActiveLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], opacity }
    }));
  };

  const addGEELayer = async (layerId: string) => {
    if (!map.current || !isMapLoaded) return;

    try {
      console.log(`Adding GEE layer: ${layerId}`);
      
      // Generate live GEE tile URL
      const { data, error } = await supabase.functions.invoke('calculate-carbon-gee', {
        body: {
          action: 'getTileUrl',
          layerId: layerId,
          bbox: map.current.getBounds().toArray().flat()
        },
      });

      if (error) {
        console.error(`Error getting tile URL for ${layerId}:`, error);
        throw error;
      }

      const tileUrl = data.tileUrl;
      console.log(`Got tile URL for ${layerId}:`, tileUrl);

      // Remove existing layer if it exists
      if (map.current.getLayer(layerId)) {
        console.log(`Removing existing layer: ${layerId}`);
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(layerId)) {
        console.log(`Removing existing source: ${layerId}`);
        map.current.removeSource(layerId);
      }

      // Add new GEE tile layer
      console.log(`Adding source for ${layerId}:`, tileUrl);
      map.current.addSource(layerId, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256
      });

      console.log(`Adding layer for ${layerId}`);
      map.current.addLayer({
        id: layerId,
        type: 'raster',
        source: layerId,
        paint: {
          'raster-opacity': (activeLayers[layerId]?.opacity || 80) / 100
        }
      });

      // Add event listeners for debugging tile loading
      map.current.on('sourcedataloading', (e) => {
        if (e.sourceId === layerId) {
          console.log(`Loading tiles for ${layerId}:`, e);
        }
      });

      map.current.on('sourcedata', (e) => {
        if (e.sourceId === layerId) {
          console.log(`Tiles loaded for ${layerId}:`, e.isSourceLoaded);
        }
      });

      map.current.on('error', (e) => {
        console.error(`Map error for ${layerId}:`, e);
      });

      toast.success(`${layerId} layer added to map`);
    } catch (error) {
      console.error(`Error adding ${layerId} layer:`, error);
      toast.error(`Failed to load ${layerId} layer`);
    }
  };

  const removeGEELayer = (layerId: string) => {
    if (!map.current) return;

    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(layerId)) {
      map.current.removeSource(layerId);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-12' : 'w-80'} transition-all duration-300 bg-card border-r border-border flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!sidebarCollapsed && (
            <h2 className="text-lg font-semibold text-foreground">Data Layers</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Sidebar Content */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-4">
            <GEELayerToggle
              onLayerToggle={handleLayerToggle}
              onLayerOpacityChange={handleLayerOpacityChange}
            />
          </div>
        )}
      </div>

      {/* Main Map Area */}
      <div className="flex-1 flex flex-col">
        {/* Map Controls Header */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search for an address or location..."
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                className="flex-1"
              />
              <Button onClick={handleAddressSearch} size="sm">
                Search
              </Button>
            </div>

            {/* Drawing Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant={drawingMode ? "default" : "outline"}
                onClick={drawingMode ? finishDrawing : startDrawing}
                disabled={drawingMode && coordinates.length < 3}
                size="sm"
              >
                <Square className="w-4 h-4 mr-2" />
                {drawingMode ? 'Finish Drawing' : 'Draw Area'}
              </Button>
              <Button variant="outline" onClick={clearMap} size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />
          
          {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">
                  {mapboxToken ? 'Loading map...' : 'Fetching map configuration...'}
                </p>
                {!mapboxToken && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    If this takes too long, check your Mapbox token configuration
                  </p>
                )}
              </div>
            </div>
          )}

          {drawingMode && (
            <div className="absolute top-4 left-4 bg-card p-3 rounded-lg shadow-lg border border-border">
              <p className="text-sm text-foreground">
                Drawing mode active. Points: {coordinates.length}
                {coordinates.length >= 3 ? ' (Ready to finish)' : ' (Need at least 3)'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Selected Area Info */}
      {selectedArea && (
        <div className="w-96 bg-card border-l border-border p-4 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle>Selected Area</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Area</p>
                <p className="text-lg font-semibold">{selectedArea.area.toFixed(2)} hectares</p>
              </div>

              {isCalculating ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Calculating carbon storage...</p>
                </div>
              ) : carbonCalculation ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Carbon Storage Results</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total CO₂e:</span>
                        <span className="font-semibold ml-2">{carbonCalculation.total_co2e.toFixed(1)} tonnes</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Biomass:</span>
                        <span className="font-semibold ml-2">{carbonCalculation.above_ground_biomass.toFixed(1)} tonnes</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Soil Carbon:</span>
                        <span className="font-semibold ml-2">{carbonCalculation.soil_organic_carbon.toFixed(1)} tonnes</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Method:</span>
                        <span className="font-semibold ml-2">{carbonCalculation.calculation_method}</span>
                      </div>
                    </div>
                  </div>
                  {carbonCalculation.data_sources && (
                    <GEEDataVisualization carbonCalculation={carbonCalculation} />
                  )}
                </div>
              ) : (
                <Button onClick={calculateCarbonForArea} className="w-full">
                  Calculate Carbon Storage
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};