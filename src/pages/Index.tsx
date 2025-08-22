import { useState } from "react";
import { MapInterface } from "@/components/MapInterface";
import geeLogoImage from "@/assets/google-earth-engine-logo.png";

const Index = () => {
  const [isSearchActive, setIsSearchActive] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-2 sm:p-4">
        <div className={`mb-4 sm:mb-8 px-2 transition-all duration-300 ${isSearchActive ? 'mb-2 sm:mb-4' : ''}`}>
          <div className="mb-4">
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">
              Land Based Carbon Calculator - Google Earth Engine
            </h1>
          </div>
          <div className="flex flex-col lg:flex-row items-center gap-6 max-w-6xl mx-auto">
            <div className="flex-1">
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed text-center lg:text-left">
                Estimate carbon storage potential for land areas using satellite imagery and AI-powered analysis. 
                To get started: <span className="font-semibold">zoom into an area on the map</span>, click 
                <span className="font-semibold"> "Draw Area"</span> to draw a polygon around the area you want to measure, then 
                click <span className="font-semibold">"Finish"</span> to receive detailed carbon storage 
                estimates including above-ground biomass, below-ground biomass, and soil organic carbon values.
              </p>
            </div>
            <div className="flex-shrink-0">
              <img 
                src={geeLogoImage} 
                alt="Google Earth Engine Logo" 
                className="w-20 sm:w-24 h-auto"
              />
            </div>
          </div>
        </div>
        <div className={`transition-all duration-500 ${isSearchActive ? 'h-screen fixed inset-0 z-50 bg-background' : 'h-[calc(100vh-220px)] sm:h-[calc(100vh-280px)]'}`}>
          {isSearchActive && (
            <div className="absolute top-4 left-4 right-4 z-10">
              <button
                onClick={() => setIsSearchActive(false)}
                className="mb-2 px-3 py-1 bg-card border border-border rounded-md text-sm text-muted-foreground hover:bg-accent"
              >
                ← Back to main page
              </button>
            </div>
          )}
          <MapInterface onSearchActive={setIsSearchActive} />
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
