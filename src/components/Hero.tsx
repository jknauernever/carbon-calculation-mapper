import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf, Globe, BarChart3 } from "lucide-react";
import heroImage from "@/assets/hero-landscape.jpg";

export const Hero = () => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/60 to-primary/90" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center text-white">
        <div className="mb-6 flex justify-center">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
            <Leaf className="w-5 h-5 text-primary-glow" />
            <span className="text-sm font-medium">Carbon Storage Calculator</span>
          </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Measure
          <span className="bg-gradient-to-r from-primary-glow to-white bg-clip-text text-transparent"> Carbon </span>
          Storage
        </h1>
        
        <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed opacity-90">
          Calculate CO₂e stored on any property with sub-acre precision using satellite data, 
          soil carbon mapping, and advanced biomass estimation.
        </p>
        
        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
            <Globe className="w-4 h-4" />
            <span className="text-sm">≤0.25 ha Resolution</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm">Multi-layer Analysis</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
            <Leaf className="w-4 h-4" />
            <span className="text-sm">Real-time Calculation</span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="bg-white text-primary hover:bg-white/90 shadow-glow text-lg px-8 py-4 h-auto"
          >
            Start Calculating
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-4 h-auto"
          >
            Learn More
          </Button>
        </div>
      </div>
      
      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-white/5 backdrop-blur-sm rounded-full animate-pulse" />
      <div className="absolute bottom-32 right-16 w-32 h-32 bg-primary-glow/10 backdrop-blur-sm rounded-full animate-pulse" />
      <div className="absolute top-1/3 right-20 w-16 h-16 bg-white/5 backdrop-blur-sm rounded-full animate-pulse" />
    </div>
  );
};