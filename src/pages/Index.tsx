import { Hero } from "@/components/Hero";
import { MapInterface } from "@/components/MapInterface";
import { CarbonResults } from "@/components/CarbonResults";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <MapInterface />
      <CarbonResults />
    </div>
  );
};

export default Index;
