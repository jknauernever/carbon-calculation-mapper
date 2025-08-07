import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Square, RotateCcw, ChevronLeft, ChevronRight, TrendingUp, MapPin } from "lucide-react";
import { toast } from "sonner";
import { GEELayerToggle } from "./GEELayerToggle";

import { CarbonResults } from "./CarbonResults";
import { BaseMapSelector } from "./BaseMapSelector";
import { GEEDataVisualization } from "./GEEDataVisualization";
import { CarbonMethodologyInfo } from "./CarbonMethodologyInfo";



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
  const [isDrawing, setIsDrawing] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [drawingCoords, setDrawingCoords] = useState<Array<[number, number]>>([]);
  const [selectedArea, setSelectedArea] = useState<{
    coordinates: Array<[number, number]>;
    areaHectares: number;
    areaAcres: number;
  } | null>(null);
  const [carbonCalculation, setCarbonCalculation] = useState<CarbonCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Record<string, { enabled: boolean; opacity: number }>>({});
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>('satellite-streets');

  // Initialize map with Mapbox token from Supabase
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        console.log('🔑 Fetching Mapbox token...');
        // Use supabase.functions.invoke which handles auth properly
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          console.error('❌ Supabase function error:', error);
          toast.error('Failed to get Mapbox token. Check Supabase secrets.');
          return;
        }
        
        if (data?.token) {
          console.log('✅ Mapbox token received');
          setMapboxToken(data.token);
          initializeMap(data.token);
        } else {
          console.error('❌ No token in response:', data);
          toast.error('Mapbox token not configured. Please add MAPBOX_PUBLIC_TOKEN to Supabase Edge Function secrets.');
        }
      } catch (error) {
        console.error('❌ Error fetching Mapbox token:', error);
        toast.error('Network error loading map token');
      }
    };

    fetchMapboxToken();
  }, []);

  const initializeMap = useCallback((token?: string) => {
    console.log('🚀 Starting map initialization');
    
    if (!mapContainer.current) {
      console.log('❌ Map container not available');
      return;
    }
    
    if (map.current) {
      console.log('ℹ️ Map already exists, skipping initialization');
      return;
    }

    const mapboxAccessToken = token || mapboxToken;
    if (!mapboxAccessToken) {
      console.error('❌ No Mapbox token available');
      toast.error('Map token missing');
      return;
    }

    try {
      console.log('🗺️ Creating Mapbox map instance');
      mapboxgl.accessToken = mapboxAccessToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: getMapStyle('satellite-streets'),
        center: [0, 0],
        zoom: 2,
        projection: 'mercator',
        antialias: true,
        preserveDrawingBuffer: true
      });

      // Add controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

      // Handle successful load
      map.current.on('load', () => {
        console.log('✅ Map loaded successfully');
        setIsMapLoaded(true);
        toast.success('Map loaded');
      });

      // Enhanced error handling
      map.current.on('error', (e) => {
        console.error('❌ Map error:', e);
        if (e.error?.message?.includes('token')) {
          toast.error('Invalid Mapbox token');
        } else {
          toast.error('Map loading error');
        }
      });

      // Style loading events
      map.current.on('styledata', () => {
        console.log('🎨 Map style loaded');
      });

      console.log('✅ Map initialization complete');
      
    } catch (error) {
      console.error('❌ Map initialization failed:', error);
      toast.error('Failed to initialize map');
    }
  }, []); // Only run once on mount

  // Handle map resize when sidebar toggles or window resizes
  useEffect(() => {
    const handleResize = () => {
      if (map.current) {
        map.current.resize();
      }
    };

    // Listen for window resize events
    window.addEventListener('resize', handleResize);
    
    // Resize map when sidebar collapsed state changes
    const timeoutId = setTimeout(handleResize, 300); // Allow transition to complete

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [sidebarCollapsed]);

  // Handle base map style changes
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    
    const newStyle = getMapStyle(selectedBaseMap);
    map.current.setStyle(newStyle);
  }, [selectedBaseMap, isMapLoaded]);

  const getMapStyle = (baseMapId: string) => {
    const baseMapOptions: Record<string, string> = {
      'none': 'data:application/json;base64,' + btoa(JSON.stringify({
        version: 8,
        sources: {},
        layers: [{
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#ffffff'
          }
        }]
      })),
      'streets': 'mapbox://styles/mapbox/streets-v12',
      'outdoors': 'mapbox://styles/mapbox/outdoors-v12',
      'light': 'mapbox://styles/mapbox/light-v11',
      'dark': 'mapbox://styles/mapbox/dark-v11',
      'satellite': 'mapbox://styles/mapbox/satellite-v9',
      'satellite-streets': 'mapbox://styles/mapbox/satellite-streets-v12',
      'navigation-day': 'mapbox://styles/mapbox/navigation-day-v1',
      'navigation-night': 'mapbox://styles/mapbox/navigation-night-v1'
    };
    
    return baseMapOptions[baseMapId] || baseMapOptions['satellite-streets'];
  };

  const handleBaseMapChange = (baseMapId: string) => {
    setSelectedBaseMap(baseMapId);
    toast.success(`Base map changed to ${baseMapId}`);
  };

  // Helper functions first (no dependencies)
  const calculatePolygonArea = (coords: Array<[number, number]>): { hectares: number; acres: number } => {
    // Simple area calculation using shoelace formula (approximate)
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i][0] * coords[j][1];
      area -= coords[j][0] * coords[i][1];
    }
    const hectares = Math.abs(area) / 2 * 111000 * 111000 / 10000; // Convert to hectares (approximate)
    const acres = hectares * 2.47105; // Convert hectares to acres
    return { hectares, acres };
  };

  const calculateCarbonForSelectedArea = async (area: { coordinates: Array<[number, number]>; areaHectares: number; areaAcres: number }) => {
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-carbon-gee', {
        body: {
          geometry: {
            type: 'Polygon',
            coordinates: [area.coordinates]
          },
          areaHectares: area.areaHectares,
        },
      });

      if (error) throw error;

      if (data.carbonData) {
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

  // New simplified drawing functions
  const updateDrawingLayer = useCallback(() => {
    if (!map.current) return;

    // Remove existing drawing layers and source
    const layers = ['drawing-polygon-fill', 'drawing-polygon-outline', 'drawing-points'];
    layers.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });
    if (map.current.getSource('drawing-source')) {
      map.current.removeSource('drawing-source');
    }

    if (drawingCoords.length === 0) return;

    // Create GeoJSON for points and polygon
    const features = [];

    // Add point markers
    drawingCoords.forEach((coord, index) => {
      features.push({
        type: 'Feature',
        properties: { type: 'point', index },
        geometry: {
          type: 'Point',
          coordinates: coord
        }
      });
    });

    // Add polygon if we have 3+ points
    if (drawingCoords.length >= 3) {
      const closedCoords = [...drawingCoords, drawingCoords[0]];
      features.push({
        type: 'Feature',
        properties: { type: 'polygon' },
        geometry: {
          type: 'Polygon',
          coordinates: [closedCoords]
        }
      });
    }

    // Add single GeoJSON source
    map.current.addSource('drawing-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features
      }
    });

    // Add polygon fill layer
    map.current.addLayer({
      id: 'drawing-polygon-fill',
      type: 'fill',
      source: 'drawing-source',
      filter: ['==', ['get', 'type'], 'polygon'],
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.3
      }
    });

    // Add polygon outline layer
    map.current.addLayer({
      id: 'drawing-polygon-outline',
      type: 'line',
      source: 'drawing-source',
      filter: ['==', ['get', 'type'], 'polygon'],
      paint: {
        'line-color': '#2563eb',
        'line-width': 2
      }
    });

    // Add point markers layer
    map.current.addLayer({
      id: 'drawing-points',
      type: 'circle',
      source: 'drawing-source',
      filter: ['==', ['get', 'type'], 'point'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#2563eb',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  }, [drawingCoords]);

  const clearDrawing = useCallback(() => {
    if (!map.current) return;

    // Remove all drawing layers
    const layers = ['drawing-polygon-fill', 'drawing-polygon-outline', 'drawing-points'];
    layers.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });

    if (map.current.getSource('drawing-source')) {
      map.current.removeSource('drawing-source');
    }

    // Clear selected area display
    if (map.current.getLayer('selected-area-fill')) {
      map.current.removeLayer('selected-area-fill');
    }
    if (map.current.getLayer('selected-area-outline')) {
      map.current.removeLayer('selected-area-outline');
    }
    if (map.current.getSource('selected-area')) {
      map.current.removeSource('selected-area');
    }

    setDrawingCoords([]);
    setSelectedArea(null);
    setCarbonCalculation(null);
  }, []);

  const finishDrawing = useCallback(() => {
    if (drawingCoords.length < 3) {
      toast.error('Need at least 3 points to create an area');
      return;
    }

    // Calculate area
    const areaCalc = calculatePolygonArea(drawingCoords);
    const area = {
      coordinates: drawingCoords,
      areaHectares: areaCalc.hectares,
      areaAcres: areaCalc.acres
    };

    // Clear drawing layer and show final polygon
    clearDrawing();
    
    // Create final polygon
    const closedCoords = [...drawingCoords, drawingCoords[0]];
    const polygonGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [closedCoords]
      }
    };

    map.current?.addSource('selected-area', {
      type: 'geojson',
      data: polygonGeoJSON
    });

    map.current?.addLayer({
      id: 'selected-area-fill',
      type: 'fill',
      source: 'selected-area',
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.3
      }
    });

    map.current?.addLayer({
      id: 'selected-area-outline',
      type: 'line',
      source: 'selected-area',
      paint: {
        'line-color': '#2563eb',
        'line-width': 2
      }
    });

    setSelectedArea(area);
    setIsDrawing(false);
    setDrawingCoords([]);
    
    // Calculate carbon
    calculateCarbonForSelectedArea(area);
    toast.success('Area created! Calculating carbon...');
  }, [drawingCoords, clearDrawing]);

  const handleMapClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!isDrawing) return;

    const { lng, lat } = e.lngLat;
    const newCoords = [...drawingCoords, [lng, lat] as [number, number]];
    setDrawingCoords(newCoords);
  }, [isDrawing, drawingCoords]);

  // Update drawing layer when coordinates change
  useEffect(() => {
    updateDrawingLayer();
  }, [drawingCoords, updateDrawingLayer]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawing) {
        setIsDrawing(false);
        clearDrawing();
        toast.info('Drawing cancelled');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, clearDrawing]);


  // Simple event listener setup - always active
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    map.current.on('click', handleMapClick);
    
    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [handleMapClick, isMapLoaded]);

  const startDrawing = () => {
    clearDrawing();
    setIsDrawing(true);
    toast.info('Click on the map to start drawing. Press ESC to cancel.');
  };

  const clearMap = () => {
    clearDrawing();
    setIsDrawing(false);
    
    toast.info('Map cleared');
  };


  // Debounced search for autocomplete
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchAddress.trim() && searchAddress.length > 2) {
        fetchSuggestions(searchAddress);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchAddress]);

  const fetchSuggestions = async (query: string) => {
    if (!mapboxToken) return;
    
    setIsSearching(true);
    try {
      const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&autocomplete=true&limit=5`;
      
      const response = await fetch(geocodingUrl);
      const data = await response.json();
      
      if (data.features) {
        setSearchSuggestions(data.features);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestionSelect = (suggestion: any) => {
    const [lng, lat] = suggestion.center;
    
    if (map.current) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 2000
      });
    }
    
    setSearchAddress(suggestion.place_name);
    setShowSuggestions(false);
    toast.success(`Found: ${suggestion.place_name}`);
  };

  const handleAddressSearch = async () => {
    if (!searchAddress.trim()) return;
    
    setShowSuggestions(false);
    
    if (searchSuggestions.length > 0) {
      handleSuggestionSelect(searchSuggestions[0]);
      return;
    }

    try {
      const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchAddress)}.json?access_token=${mapboxToken}&autocomplete=true&limit=1`;
      
      const response = await fetch(geocodingUrl);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        handleSuggestionSelect(data.features[0]);
      } else {
        toast.error('Location not found');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Search failed. Please try again.');
    }
  };






  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-12' : 'w-80'} transition-all duration-300 bg-card border-r border-border flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border flex flex-col">
          {!sidebarCollapsed && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Data Layers
                </h2>
              </div>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 self-end"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Sidebar Content */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {/* Selected Area Results - Moved from right panel */}
                {selectedArea && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4" />
                        Selected Area
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Area</p>
                        <div className="space-y-1">
                          <p className="text-lg font-semibold">{selectedArea.areaHectares.toFixed(2)} hectares</p>
                          <p className="text-sm text-muted-foreground">{selectedArea.areaAcres.toFixed(2)} acres</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Points: {selectedArea.coordinates.length}</p>
                      </div>

                      {isCalculating ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                          <p className="mt-2 text-sm text-muted-foreground">Calculating carbon storage...</p>
                        </div>
                      ) : carbonCalculation ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold">Carbon Storage Results</h3>
                              <CarbonMethodologyInfo />
                            </div>
                            <div className="grid grid-cols-1 gap-3 text-sm">
                              <div className="bg-muted/50 p-2 rounded">
                                <span className="text-muted-foreground">Total CO₂e:</span>
                                <span className="font-semibold ml-2">{carbonCalculation.total_co2e.toFixed(1)} t CO₂e</span>
                              </div>
                              <div className="bg-muted/50 p-2 rounded">
                                <span className="text-muted-foreground">Above-Ground Biomass:</span>
                                <span className="font-semibold ml-2">{carbonCalculation.above_ground_biomass.toFixed(1)} t CO₂e</span>
                              </div>
                              <div className="bg-muted/50 p-2 rounded">
                                <span className="text-muted-foreground">Below-Ground Biomass:</span>
                                <span className="font-semibold ml-2">{carbonCalculation.below_ground_biomass.toFixed(1)} t CO₂e</span>
                              </div>
                              <div className="bg-muted/50 p-2 rounded">
                                <span className="text-muted-foreground">Soil Carbon:</span>
                                <span className="font-semibold ml-2">{carbonCalculation.soil_organic_carbon.toFixed(1)} t CO₂e</span>
                              </div>
                              <div className="bg-muted/50 p-2 rounded">
                                <span className="text-muted-foreground">Method:</span>
                                <span className="font-semibold ml-2 text-xs">{carbonCalculation.calculation_method}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <p className="text-sm text-muted-foreground">
                            {isDrawing ? 'Add more points, then click Finish' : 'Click "Draw Area" to start'}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
          </div>
        )}
      </div>

      {/* Main Map Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Map Controls Header */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 flex items-center gap-2 relative">
              <Search className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 relative">
                <Input
                  placeholder="Search for an address or location..."
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                  onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="flex-1"
                />
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 first:rounded-t-md last:rounded-b-md border-b border-border last:border-b-0"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate">{suggestion.place_name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {isSearching && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  </div>
                )}
              </div>
              <Button onClick={handleAddressSearch} size="sm">
                Search
              </Button>
            </div>

            {/* Base Map Selector and Drawing Controls */}
            <div className="flex items-center gap-2">
              <BaseMapSelector 
                selectedBaseMap={selectedBaseMap}
                onBaseMapChange={handleBaseMapChange}
              />
              {!isDrawing ? (
                <Button
                  variant="outline"
                  onClick={startDrawing}
                  className="flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  Draw Area
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    onClick={finishDrawing}
                    disabled={drawingCoords.length < 3}
                    className="flex items-center gap-2"
                  >
                    Finish ({drawingCoords.length} points)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDrawing(false);
                      clearDrawing();
                      toast.info('Drawing cancelled');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              <Button variant="outline" onClick={clearMap} size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative w-full min-h-0">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
          
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

          {isDrawing && (
            <div className="absolute top-4 left-4 bg-card p-3 rounded-lg shadow-lg border border-border">
              <p className="text-sm text-foreground">
                Drawing mode active. Points: {drawingCoords.length}
                {drawingCoords.length >= 3 ? ' (Ready to finish!)' : ` (Need ${Math.max(0, 3 - drawingCoords.length)} more)`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ESC to cancel • Click Finish when ready
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};