import { MapInterface } from "@/components/MapInterface";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-2 sm:p-4">
        <div className="mb-4 sm:mb-8 text-center px-2">
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">
            Land Based Carbon Calculator - Google Earth Engine
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-5xl mx-auto leading-relaxed">
            Estimate carbon storage potential for land areas using satellite imagery and AI-powered analysis. 
            To get started: <span className="font-semibold">zoom into an area on the map</span>, click 
            <span className="font-semibold"> "Draw Area"</span> to draw a polygon around the area you want to measure, then 
            click <span className="font-semibold">"Finish"</span> to receive detailed carbon storage 
            estimates including above-ground biomass, below-ground biomass, and soil organic carbon values.
          </p>
        </div>
        <div className="h-[calc(100vh-220px)] sm:h-[calc(100vh-280px)]">
          <MapInterface />
        </div>
        <div className="text-center py-4 border-t border-border mt-4">
          <p className="text-xs text-muted-foreground">
            Copyright 2025 - All Rights Reserved - <a href="https://KnauerNever.com" target="_blank" rel="noopener noreferrer" className="hover:underline">KnauerNever.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
