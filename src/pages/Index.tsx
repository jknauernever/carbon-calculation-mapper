import { MapInterface } from "@/components/MapInterface";
import { TestGEENode } from "@/components/TestGEENode";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        <TestGEENode />
        <MapInterface />
      </div>
    </div>
  );
};

export default Index;
