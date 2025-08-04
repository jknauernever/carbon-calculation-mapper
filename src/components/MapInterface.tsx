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
  
  const { selectedProperty, createProperty, calculateCarbon, loading, calculationLoading } = useProperty();

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

      // Add click handler for property selection
      map.current.on('click', async (e) => {
        if (!drawingMode) {
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
          
          new mapboxgl.Marker({ color: '#22c55e' })
            .setLngLat(e.lngLat)
            .addTo(map.current!);
            
          toast(`Property saved! Area: ${mockArea.toFixed(2)} hectares`);
        }
      });

      toast("Map initialized! Click anywhere to select a property.");
    } catch (error) {
      console.error('Map initialization error:', error);
      toast.error("Failed to initialize map. Please check your Mapbox token.");
    }
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

              {/* Draw Boundary */}
              <Button 
                variant={drawingMode ? "default" : "outline"} 
                className="w-full justify-start"
                onClick={() => setDrawingMode(!drawingMode)}
              >
                <Square className="w-4 h-4 mr-2" />
                Draw Boundary
              </Button>
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