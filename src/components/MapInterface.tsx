import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MapPin, Upload, Square } from "lucide-react";
import { toast } from "sonner";
import { useProperty } from "@/hooks/useProperty";
import { supabase } from "@/integrations/supabase/client";

export const MapInterface = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);
  const [address, setAddress] = useState('');
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [currentMarkers, setCurrentMarkers] = useState<mapboxgl.Marker[]>([]);
  
  const { selectedProperty, createProperty, calculateCarbon, selectProperty, loading, calculationLoading } = useProperty();

  // Fetch Mapbox token from Supabase secrets
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          console.error('Error fetching Mapbox token:', error);
          toast.error("Could not load map configuration");
          setTokenLoading(false);
          return;
        }
        
        if (data?.token) {
          setMapboxToken(data.token);
          initializeMap(data.token);
        } else {
          toast.error("Mapbox token not configured");
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error("Failed to initialize map");
      } finally {
        setTokenLoading(false);
      }
    };

    fetchMapboxToken();
  }, []);

  const clearMap = () => {
    if (!map.current) return;
    
    // Remove all markers
    currentMarkers.forEach(marker => marker.remove());
    setCurrentMarkers([]);
    
    // Remove polygon layer if it exists
    if (map.current.getLayer('polygon-fill')) {
      map.current.removeLayer('polygon-fill');
    }
    if (map.current.getLayer('polygon-outline')) {
      map.current.removeLayer('polygon-outline');
    }
    if (map.current.getSource('polygon')) {
      map.current.removeSource('polygon');
    }
    
    setDrawingPoints([]);
    setDrawingMode(false);
    toast("Map cleared");
  };

  const addPolygonToMap = (coordinates: [number, number][]) => {
    if (!map.current || coordinates.length < 3) {
      console.log('Cannot add polygon: insufficient points or no map', coordinates.length);
      return;
    }

    console.log('Adding polygon to map with coordinates:', coordinates);

    // Close the polygon by adding the first point at the end
    const closedCoordinates = [...coordinates, coordinates[0]];
    console.log('Closed coordinates:', closedCoordinates);

    const polygonGeoJSON = {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [closedCoordinates]
      },
      properties: {}
    };

    console.log('Polygon GeoJSON:', polygonGeoJSON);

    try {
      // Remove existing polygon if it exists
      if (map.current.getLayer('polygon-fill')) {
        map.current.removeLayer('polygon-fill');
      }
      if (map.current.getLayer('polygon-outline')) {
        map.current.removeLayer('polygon-outline');
      }
      if (map.current.getSource('polygon')) {
        map.current.removeSource('polygon');
      }

      // Add new polygon source
      map.current.addSource('polygon', {
        type: 'geojson',
        data: polygonGeoJSON
      });

      console.log('Added polygon source');

      // Add fill layer
      map.current.addLayer({
        id: 'polygon-fill',
        type: 'fill',
        source: 'polygon',
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': 0.3
        }
      });

      console.log('Added polygon fill layer');

      // Add outline layer
      map.current.addLayer({
        id: 'polygon-outline',
        type: 'line',
        source: 'polygon',
        paint: {
          'line-color': '#22c55e',
          'line-width': 3
        }
      });

      console.log('Added polygon outline layer');
      toast('Polygon displayed on map!');
    } catch (error) {
      console.error('Error adding polygon to map:', error);
      toast.error('Failed to display polygon on map');
    }
  };

  const calculatePolygonArea = (coordinates: [number, number][]) => {
    // Simple area calculation using shoelace formula (approximation for small areas)
    if (coordinates.length < 3) return 0;
    
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i][0] * coordinates[j][1];
      area -= coordinates[j][0] * coordinates[i][1];
    }
    
    area = Math.abs(area) / 2;
    
    // Convert from degree-squared to hectares (very rough approximation)
    // 1 degree ≈ 111 km at equator, so 1 sq degree ≈ 12321 sq km
    const hectares = area * 12321 * 100; // Convert to hectares
    return hectares;
  };

  const initializeMap = (token?: string) => {
    const tokenToUse = token || mapboxToken;
    if (!mapContainer.current || !tokenToUse) return;

    try {
      mapboxgl.accessToken = tokenToUse;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-v9',
        zoom: 10,
        center: [-122.4194, 37.7749], // San Francisco default
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl(),
        'top-right'
      );

      // Map click handler will be added in separate useEffect
      toast("Map initialized! Click to select properties or enable Draw Boundary mode.");
    } catch (error) {
      console.error('Map initialization error:', error);
      toast.error("Failed to initialize map. Please check your Mapbox token.");
    }
  };

  // Add click handler in separate useEffect to ensure it uses current state
  useEffect(() => {
    if (!map.current) return;

    const handleMapClick = async (e: mapboxgl.MapMouseEvent) => {
      console.log('Map clicked, drawingMode:', drawingMode, 'current points:', drawingPoints.length);
      
      if (drawingMode) {
        // Add point to drawing
        const newPoints = [...drawingPoints, [e.lngLat.lng, e.lngLat.lat] as [number, number]];
        console.log('Adding new point, total points:', newPoints.length);
        setDrawingPoints(newPoints);
        
        // Add visual marker for the point
        const marker = new mapboxgl.Marker({ 
          color: '#22c55e',
          scale: 1.5
        })
          .setLngLat(e.lngLat)
          .addTo(map.current!);
        
        setCurrentMarkers(prev => [...prev, marker]);
        
        // If we have 3+ points, draw the polygon
        if (newPoints.length >= 3) {
          console.log('Drawing polygon with', newPoints.length, 'points');
          addPolygonToMap(newPoints);
        }
        
        toast(`Point ${newPoints.length} added. ${newPoints.length >= 3 ? 'Polygon created!' : `Need ${3 - newPoints.length} more points.`}`);
      } else {
        // Create a mock selected area for demo
        const mockArea = Math.random() * 5 + 1; // 1-6 hectares
        
        // Create GeoJSON point geometry
        const geometry = {
          type: 'Point',
          coordinates: [e.lngLat.lng, e.lngLat.lat]
        };
        
        // Create property in database
        await createProperty({
          name: `Property at ${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`,
          geometry,
          area_hectares: mockArea,
        });
        
        const marker = new mapboxgl.Marker({ color: '#22c55e' })
          .setLngLat(e.lngLat)
          .addTo(map.current!);
          
        setCurrentMarkers(prev => [...prev, marker]);
        toast(`Property saved! Area: ${mockArea.toFixed(2)} hectares`);
      }
    };

    // Remove existing listener and add new one
    map.current.off('click', handleMapClick);
    map.current.on('click', handleMapClick);

    return () => {
      if (map.current) {
        map.current.off('click', handleMapClick);
      }
    };
  }, [drawingMode, drawingPoints, createProperty, currentMarkers]);

  const finishDrawing = async () => {
    if (drawingPoints.length < 3) {
      toast.error("Need at least 3 points to create a property");
      return;
    }

    const area = calculatePolygonArea(drawingPoints);
    const centerLat = drawingPoints.reduce((sum, p) => sum + p[1], 0) / drawingPoints.length;
    const centerLng = drawingPoints.reduce((sum, p) => sum + p[0], 0) / drawingPoints.length;

    // Create property from drawn polygon
    const newProperty = await createProperty({
      name: `Drawn Property at ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`,
      geometry: {
        type: 'Polygon',
        coordinates: [[...drawingPoints, drawingPoints[0]]] // Close the polygon
      },
      area_hectares: area,
    });

    // Select the newly created property and calculate carbon
    if (newProperty) {
      selectProperty(newProperty);
      await calculateCarbon(newProperty);
    }

    toast(`Property created! Area: ${area.toFixed(2)} hectares`);
    setDrawingMode(false);
    setDrawingPoints([]);
  };

  const handleAddressSearch = async () => {
    if (!address.trim()) {
      toast.error("Please enter an address");
      return;
    }
    // Mock geocoding for demo
    const mockArea = Math.random() * 10 + 2;
    
    // Create property from address search
    await createProperty({
      name: address,
      address: address,
      geometry: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749] // Mock coordinates
      },
      area_hectares: mockArea,
    });
    
    toast(`Found property: ${address}. Area: ${mockArea.toFixed(2)} hectares`);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-4">Select Your Property</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Choose your property using address search, GPS coordinates, or draw a custom boundary on the map.
        </p>
      </div>

      {tokenLoading && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3"></div>
              <p className="text-muted-foreground">Loading map configuration...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!tokenLoading && !map.current && (
        <Card className="mb-6 border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Map Configuration Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Could not load the map. Please check if the Mapbox token is properly configured in the project settings.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        {/* Controls Panel */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Property Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Address Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search by Address</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                  />
                  <Button size="sm" onClick={handleAddressSearch}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* GPS Pin */}
              <Button variant="outline" className="w-full justify-start">
                <MapPin className="w-4 h-4 mr-2" />
                Drop GPS Pin
              </Button>

              {/* Upload Boundary */}
              <Button variant="outline" className="w-full justify-start">
                <Upload className="w-4 h-4 mr-2" />
                Upload Boundary
              </Button>

              {/* Clear Map */}
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={clearMap}
              >
                <Square className="w-4 h-4 mr-2" />
                Clear Map
              </Button>

              {/* Draw Boundary */}
              <div className="space-y-2">
                <Button 
                  variant={drawingMode ? "default" : "outline"} 
                  className="w-full justify-start"
                  onClick={() => setDrawingMode(!drawingMode)}
                >
                  <Square className="w-4 h-4 mr-2" />
                  {drawingMode ? 'Stop Drawing' : 'Draw Boundary'}
                </Button>
                
                {drawingMode && (
                  <div className="text-xs text-muted-foreground pl-6">
                    Click map to add points. Need 3+ points for polygon.
                    {drawingPoints.length > 0 && (
                      <div className="mt-1">
                        Points: {drawingPoints.length}
                        {drawingPoints.length >= 3 && (
                          <Button 
                            size="sm" 
                            className="ml-2 h-6"
                            onClick={finishDrawing}
                          >
                            Finish
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Property Info */}
          {selectedProperty && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg text-primary">Selected Property</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Area:</span>
                    <span className="font-medium">{selectedProperty.area_hectares.toFixed(2)} ha</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resolution:</span>
                    <span className="font-medium">10m pixels</span>
                  </div>
                  <Button 
                    className="w-full mt-4" 
                    size="sm"
                    onClick={() => calculateCarbon(selectedProperty)}
                    disabled={calculationLoading}
                  >
                    {calculationLoading ? 'Calculating...' : 'Calculate Carbon Storage'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map */}
        <div className="md:col-span-3">
          <Card className="h-[600px]">
            <CardContent className="p-0 h-full">
              <div 
                ref={mapContainer} 
                className="w-full h-full rounded-lg"
                style={{ minHeight: '600px' }}
              />
              {!map.current && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Map will appear here after token setup</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
