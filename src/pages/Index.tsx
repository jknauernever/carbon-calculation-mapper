import { MapInterface } from "@/components/MapInterface";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Land-Based Carbon Calculator
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Estimate carbon storage potential for land areas using satellite imagery and AI-powered analysis. 
            To get started: <span className="font-semibold">draw or select an area on the map</span>, then 
            <span className="font-semibold"> click "Calculate Carbon"</span> to receive detailed carbon sequestration 
            estimates including above-ground biomass, below-ground biomass, and soil organic carbon values.
          </p>
        </div>
        <MapInterface />
      </div>
    </div>
  );
};

export default Index;
