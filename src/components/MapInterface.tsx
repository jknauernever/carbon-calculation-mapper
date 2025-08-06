import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Square, RotateCcw, ChevronLeft, ChevronRight, TrendingUp, MapPin } from "lucide-react";
import { toast } from "sonner";
import { GEELayerToggle } from "./GEELayerToggle";
import { DatasetSelector } from "./DatasetSelector";
import { CarbonResults } from "./CarbonResults";
import { BaseMapSelector } from "./BaseMapSelector";
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

interface Dataset {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters?: Record<string, any>;
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
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [datasetMetadata, setDatasetMetadata] = useState<any>(null);
  const [tileLoading, setTileLoading] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>('satellite');

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
    console.log('🚀 initializeMap called');
    if (!mapContainer.current || map.current) {
      console.log('❌ Map container not ready or map already exists');
      return;
    }

    const mapboxAccessToken = token || mapboxToken;
    if (!mapboxAccessToken) {
      console.error('❌ No Mapbox token available');
      return;
    }

    console.log('🗺️ Initializing Mapbox map...');
    mapboxgl.accessToken = mapboxAccessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(selectedBaseMap),
      center: [0, 0], // World center
      zoom: 2,
      projection: 'mercator'
    });

    console.log('🎮 Adding map controls...');
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.current.on('load', () => {
      console.log('🗺️ Map loaded successfully');
      setIsMapLoaded(true);
      console.log('🔧 About to add map event listeners...');
      addMapEventListeners();
      console.log('✅ Map initialization complete');
    });

    map.current.on('error', (e) => {
      console.error('❌ Map error:', e);
      toast.error('Map failed to load properly');
    });

    console.log('✅ Map setup complete');
  }, [mapboxToken, selectedBaseMap]);

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
    
    return baseMapOptions[baseMapId] || baseMapOptions['satellite'];
  };

  const handleBaseMapChange = (baseMapId: string) => {
    setSelectedBaseMap(baseMapId);
    
    if (map.current) {
      const newStyle = getMapStyle(baseMapId);
      map.current.setStyle(newStyle);
      
      // Re-add dataset layers after style change
      map.current.once('styledata', () => {
        if (selectedDataset) {
          addDatasetLayer(selectedDataset);
        }
        // Re-add selected area if it exists
        if (selectedArea) {
          const closedCoords = [...selectedArea.coordinates, selectedArea.coordinates[0]];
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
        }
      });
    }
  };

  // Helper functions first (no dependencies)
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

  const calculateCarbonForSelectedArea = async (area: { coordinates: Array<[number, number]>; area: number }) => {
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-carbon-gee', {
        body: {
          geometry: {
            type: 'Polygon',
            coordinates: [area.coordinates]
          },
          areaHectares: area.area,
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

  const addPointMarker = useCallback((lng: number, lat: number, pointNumber: number) => {
    if (!map.current) return;

    const markerId = `drawing-point-${pointNumber}`;
    
    // Remove existing marker if it exists
    if (map.current.getSource(markerId)) {
      if (map.current.getLayer(markerId)) {
        map.current.removeLayer(markerId);
      }
      map.current.removeSource(markerId);
    }

    // Add point marker
    map.current.addSource(markerId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: { pointNumber },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      }
    });

    map.current.addLayer({
      id: markerId,
      type: 'circle',
      source: markerId,
      paint: {
        'circle-radius': 6,
        'circle-color': '#2563eb',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  }, []);

  const clearDrawingMarkers = useCallback(() => {
    if (!map.current) return;
    
    // Remove all drawing point markers
    for (let i = 1; i <= 10; i++) { // Clear up to 10 potential markers
      const markerId = `drawing-point-${i}`;
      if (map.current.getLayer(markerId)) {
        map.current.removeLayer(markerId);
      }
      if (map.current.getSource(markerId)) {
        map.current.removeSource(markerId);
      }
    }
  }, []);

  const showPolygonPreview = useCallback((coords: Array<[number, number]>) => {
    if (!map.current || coords.length < 3) return;

    // Close the polygon for preview
    const closedCoords = [...coords, coords[0]];

    const polygonGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [closedCoords]
      }
    };

    // Remove existing preview layers
    if (map.current.getLayer('polygon-preview-fill')) {
      map.current.removeLayer('polygon-preview-fill');
    }
    if (map.current.getLayer('polygon-preview-outline')) {
      map.current.removeLayer('polygon-preview-outline');
    }
    if (map.current.getSource('polygon-preview')) {
      map.current.removeSource('polygon-preview');
    }

    // Add preview polygon with different styling
    map.current.addSource('polygon-preview', {
      type: 'geojson',
      data: polygonGeoJSON
    });

    map.current.addLayer({
      id: 'polygon-preview-fill',
      type: 'fill',
      source: 'polygon-preview',
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.2
      }
    });

    map.current.addLayer({
      id: 'polygon-preview-outline',
      type: 'line',
      source: 'polygon-preview',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-dasharray': [2, 2] // Dashed line for preview
      }
    });
  }, []);



  const clearAllDrawingElements = useCallback(() => {
    if (!map.current) return;
    
    console.log('🧹 Clearing all drawing elements');
    
    // Clear drawing markers
    clearDrawingMarkers();
    
    // Clear preview polygon
    const previewLayers = ['polygon-preview-fill', 'polygon-preview-outline'];
    previewLayers.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        console.log('Removing preview layer:', layerId);
        map.current.removeLayer(layerId);
      }
    });
    if (map.current.getSource('polygon-preview')) {
      console.log('Removing preview source');
      map.current.removeSource('polygon-preview');
    }
    
    // Clear completed polygon
    const polygonLayers = ['selected-area-fill', 'selected-area-outline'];
    polygonLayers.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        console.log('Removing completed polygon layer:', layerId);
        map.current.removeLayer(layerId);
      }
    });
    if (map.current.getSource('selected-area')) {
      console.log('Removing completed polygon source');
      map.current.removeSource('selected-area');
    }
    
    console.log('✅ All drawing elements cleared');
  }, [clearDrawingMarkers]);

  const cancelDrawing = useCallback(() => {
    console.log('❌ Cancelling drawing mode');
    setDrawingMode(false);
    setCoordinates([]);
    setSelectedArea(null);
    setCarbonCalculation(null);
    clearDrawingMarkers();
    toast.info('Drawing cancelled');
  }, [clearDrawingMarkers]);

  const handleMapClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    console.log('🖱️ Map clicked', { drawingMode, coordinates: coordinates.length, lngLat: e.lngLat });
    
    if (!drawingMode) {
      console.log('❌ Not in drawing mode, ignoring click');
      return;
    }

    const { lng, lat } = e.lngLat;
    const newCoordinates = [...coordinates, [lng, lat] as [number, number]];
    console.log('📍 Adding new coordinate', { lng, lat, total: newCoordinates.length });
    setCoordinates(newCoordinates);

    // Add visual marker for the clicked point
    addPointMarker(lng, lat, newCoordinates.length);

    // Show preview and calculate dynamically if we have 3+ points
    if (newCoordinates.length >= 3) {
      console.log('🔷 Showing polygon preview and calculating for', newCoordinates.length, 'points');
      showPolygonPreview(newCoordinates);
      // Calculate area and trigger carbon calculation dynamically
      const area = calculatePolygonArea(newCoordinates);
      setSelectedArea({ coordinates: newCoordinates, area });
      // Auto-calculate carbon for the current polygon
      calculateCarbonForSelectedArea({ coordinates: newCoordinates, area });
    }
  }, [drawingMode, coordinates, addPointMarker, showPolygonPreview]);

  const addMapEventListeners = useCallback(() => {
    console.log('🔧 addMapEventListeners called');
    if (!map.current) {
      console.log('❌ No map.current available');
      return;
    }

    console.log('📍 Current drawing mode:', drawingMode);
    
    // Remove existing listeners first
    map.current.off('click', handleMapClick);
    
    // Add fresh listeners with current state
    map.current.on('click', handleMapClick);
    console.log('✅ Map click event listener attached/updated');
    
    // Add keyboard event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('⌨️ Key pressed:', e.key, 'Drawing mode:', drawingMode);
      if (e.key === 'Escape' && drawingMode) {
        cancelDrawing();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Store cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleMapClick, drawingMode, cancelDrawing]);

  // Re-attach event listeners when drawing state changes
  useEffect(() => {
    console.log('🔄 useEffect triggered - isMapLoaded:', isMapLoaded, 'drawingMode:', drawingMode);
    if (isMapLoaded && map.current) {
      console.log('🔄 Updating event listeners due to state change');
      addMapEventListeners();
    }
  }, [addMapEventListeners, isMapLoaded, drawingMode]);

  const startDrawing = () => {
    console.log('🎯 Starting drawing mode');
    
    // Force clear everything first
    console.log('🧹 Force clearing before starting new drawing');
    clearAllDrawingElements();
    
    // Ensure we start with completely clean state
    setCoordinates([]);
    setSelectedArea(null);
    setCarbonCalculation(null);
    
    // Small delay to ensure clearing is complete before starting
    setTimeout(() => {
      setDrawingMode(true);
      toast.info('Click points on the map to draw a polygon. Results update with each point (3+ required).');
    }, 100);
  };

  const calculateCarbonForArea = async () => {
    if (!selectedArea) return;
    await calculateCarbonForSelectedArea(selectedArea);
  };

  const clearMap = () => {
    if (!map.current) return;

    console.log('🧹 Clearing entire map - FORCE CLEAR');
    
    // Force clear all visual elements first
    clearAllDrawingElements();
    
    // Clear drawing state completely
    setDrawingMode(false);
    setCoordinates([]);
    setSelectedArea(null);
    setCarbonCalculation(null);

    // Clear dataset layers
    clearDatasetLayers();
    setSelectedDataset(null);
    setDatasetMetadata(null);
    
    setActiveLayers({});
    
    console.log('✅ Map completely cleared');
    toast.info('Map cleared');
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

  const handleDatasetSelect = async (dataset: Dataset) => {
    setSelectedDataset(dataset);
    console.log('Selected dataset:', dataset);
    toast.success(`Dataset selected: ${dataset.name}`);
    
    // Clear existing dataset layers
    clearDatasetLayers();
    
    // Add new dataset layer to map
    await addDatasetLayer(dataset);
  };

  const clearDatasetLayers = () => {
    if (!map.current) return;
    
    // Remove any existing dataset layers
    const layersToRemove = ['dataset-layer', 'dataset-layer-source'];
    layersToRemove.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });
    
    if (map.current.getSource('dataset-tiles')) {
      map.current.removeSource('dataset-tiles');
    }
  };

  const addDatasetLayer = async (dataset: Dataset) => {
    if (!map.current || !isMapLoaded) {
      toast.error('Map not ready');
      return;
    }

    setTileLoading(true);
    
    try {
      console.log('Adding dataset layer:', dataset);
      
      // Clear existing dataset layers first
      clearDatasetLayers();
      
      // Get tile URL template from our secure edge function
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
        throw new Error('No tile URL received from edge function');
      }

      console.log('Tile URL template received:', data.tileUrl);
      
      // Add tile source with the secure tile URL
      map.current.addSource('dataset-tiles', {
        type: 'raster',
        tiles: [data.tileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 18,
        attribution: 'Google Earth Engine via GEE Tile Server'
      });
      
      // Add raster layer with appropriate styling
      map.current.addLayer({
        id: 'dataset-layer',
        type: 'raster',
        source: 'dataset-tiles',
        paint: {
          'raster-opacity': 0.8,
          'raster-fade-duration': 300
        }
      });
      
      // Set metadata from the datasets API response
      setDatasetMetadata({
        collection: dataset.parameters?.collection || 'Unknown',
        band: dataset.parameters?.band || 'Unknown',
        description: dataset.description,
        category: dataset.category,
        temporalResolution: dataset.parameters?.temporalResolution || 'Unknown',
        spatialResolution: dataset.parameters?.spatialResolution || 'Unknown'
      });
      
      // Add event listeners for debugging
      map.current.on('sourcedata', (e) => {
        if (e.sourceId === 'dataset-tiles') {
          if (e.isSourceLoaded) {
            console.log('✅ Dataset tiles loaded successfully');
            toast.success('Dataset layer loaded');
          }
        }
      });
      
      map.current.on('error', (e: any) => {
        console.error('❌ Map tile error:', e);
        if (e.sourceId === 'dataset-tiles') {
          toast.error('Failed to load dataset tiles - API key may be missing');
        }
      });
      
      console.log('✅ Dataset layer added successfully');
      
    } catch (error) {
      console.error('Error adding dataset layer:', error);
      toast.error(`Failed to load dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTileLoading(false);
    }
  };

  const getColorPalette = (category: string) => {
    const palettes: Record<string, string[]> = {
      'Vegetation': ['#8B4513', '#DAA520', '#9ACD32', '#32CD32', '#006400'],
      'Water': ['#E6F3FF', '#CCE7FF', '#99D6FF', '#4169E1', '#000080'],
      'Climate': ['#4169E1', '#1E90FF', '#FFD700', '#FF8C00', '#DC143C'],
      'Temperature': ['#000080', '#4169E1', '#FFD700', '#FF8C00', '#DC143C'],
      'Precipitation': ['#F5F5DC', '#87CEEB', '#4169E1', '#0000CD', '#000080'],
      'Landcover': ['#8B4513', '#DAA520', '#9ACD32', '#32CD32', '#4169E1'],
      'Other': ['#696969', '#808080', '#A9A9A9', '#C0C0C0', '#D3D3D3']
    };
    return palettes[category] || palettes['Other'];
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
                <DatasetSelector 
                  onDatasetSelect={handleDatasetSelect}
                  selectedDataset={selectedDataset}
                />
                
                {tileLoading && (
                  <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                    <span>Loading dataset tiles...</span>
                  </div>
                )}
                
                {selectedDataset && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        Dataset Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm">{selectedDataset.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedDataset.description}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Category:</span>
                        <span className="text-xs px-2 py-1 bg-secondary rounded">
                          {selectedDataset.category}
                        </span>
                      </div>
                      
                      {datasetMetadata && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-xs">Metadata</h5>
                          <div className="text-xs space-y-1">
                            {datasetMetadata.dateRange && (
                              <div>
                                <span className="font-medium">Date Range: </span>
                                {datasetMetadata.dateRange}
                              </div>
                            )}
                            {datasetMetadata.resolution && (
                              <div>
                                <span className="font-medium">Resolution: </span>
                                {datasetMetadata.resolution}
                              </div>
                            )}
                            {datasetMetadata.units && (
                              <div>
                                <span className="font-medium">Units: </span>
                                {datasetMetadata.units}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <h5 className="font-medium text-xs">Color Palette</h5>
                        <div className="flex gap-1">
                          {getColorPalette(selectedDataset.category).map((color, index) => (
                            <div
                              key={index}
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                      <div>
                        <p className="text-sm text-muted-foreground">Area</p>
                        <p className="text-lg font-semibold">{selectedArea.area.toFixed(2)} hectares</p>
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
                            <h3 className="text-sm font-semibold">Carbon Storage Results</h3>
                            <div className="grid grid-cols-1 gap-3 text-sm">
                              <div className="bg-muted/50 p-2 rounded">
                                <span className="text-muted-foreground">Total CO₂e:</span>
                                <span className="font-semibold ml-2">{carbonCalculation.total_co2e.toFixed(1)} tonnes</span>
                              </div>
                              <div className="bg-muted/50 p-2 rounded">
                                <span className="text-muted-foreground">Biomass:</span>
                                <span className="font-semibold ml-2">{carbonCalculation.above_ground_biomass.toFixed(1)} tonnes</span>
                              </div>
                              <div className="bg-muted/50 p-2 rounded">
                                <span className="text-muted-foreground">Soil Carbon:</span>
                                <span className="font-semibold ml-2">{carbonCalculation.soil_organic_carbon.toFixed(1)} tonnes</span>
                              </div>
                              <div className="bg-muted/50 p-2 rounded">
                                <span className="text-muted-foreground">Method:</span>
                                <span className="font-semibold ml-2 text-xs">{carbonCalculation.calculation_method}</span>
                              </div>
                            </div>
                          </div>
                          {carbonCalculation.data_sources && (
                            <div className="border-t pt-2">
                              <GEEDataVisualization carbonCalculation={carbonCalculation} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <p className="text-sm text-muted-foreground">
                            {drawingMode ? 'Add more points for calculation' : 'Click "Draw Area" to start'}
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

            {/* Base Map Selector and Drawing Controls */}
            <div className="flex items-center gap-2">
              <BaseMapSelector 
                selectedBaseMap={selectedBaseMap}
                onBaseMapChange={handleBaseMapChange}
              />
              <Button
                variant={drawingMode ? "default" : "outline"}
                onClick={drawingMode ? cancelDrawing : startDrawing}
                size="sm"
              >
                <Square className="w-4 h-4 mr-2" />
                {drawingMode ? 'Stop Drawing' : 'Draw Area'}
              </Button>
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

          {drawingMode && (
            <div className="absolute top-4 left-4 bg-card p-3 rounded-lg shadow-lg border border-border">
              <p className="text-sm text-foreground">
                Drawing mode active. Points: {coordinates.length}
                {coordinates.length >= 3 ? ' (Carbon calculating...)' : ` (Need ${Math.max(0, 3 - coordinates.length)} more for calculation)`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ESC to cancel • Results update with each point
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};