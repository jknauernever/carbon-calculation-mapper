import { MapInterface } from "@/components/MapInterface";

const Index = () => {
  console.log('🏠 Index page rendering...');
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div style={{ border: '2px solid red', padding: '10px', margin: '10px' }}>
          <h1 style={{ color: 'red', fontSize: '24px' }}>DEBUG: Index Page Loaded</h1>
          <p style={{ color: 'blue' }}>About to render MapInterface component...</p>
        </div>
        <MapInterface />
      </div>
    </div>
  );
};

export default Index;
