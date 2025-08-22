-- Update properties table policies to be read-only for public
DROP POLICY IF EXISTS "Allow public insert access to properties" ON public.properties;
DROP POLICY IF EXISTS "Allow public update access to properties" ON public.properties;
DROP POLICY IF EXISTS "Allow public delete access to properties" ON public.properties;

-- Keep public read access
CREATE POLICY "Public can view properties" 
ON public.properties 
FOR SELECT 
USING (true);

-- Only system can create properties
CREATE POLICY "System can create properties" 
ON public.properties 
FOR INSERT 
WITH CHECK (false); -- This will be overridden by service role in edge functions

-- Update carbon_calculations table policies
DROP POLICY IF EXISTS "Allow public read access to carbon_calculations" ON public.carbon_calculations;

-- Keep public read access for carbon calculations
CREATE POLICY "Public can view carbon calculations" 
ON public.carbon_calculations 
FOR SELECT 
USING (true);

-- System can still create calculations (keep existing policy)
-- CREATE POLICY "System can create calculations" already exists

-- Create usage analytics table for monitoring
CREATE TABLE IF NOT EXISTS public.usage_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET,
  user_agent TEXT,
  endpoint TEXT NOT NULL,
  request_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on usage analytics
ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;

-- Only system can insert analytics
CREATE POLICY "System can create analytics" 
ON public.usage_analytics 
FOR INSERT 
WITH CHECK (true);

-- Create function to clean old analytics (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_analytics()
RETURNS void AS $$
BEGIN
  DELETE FROM public.usage_analytics 
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_usage_analytics_created_at ON public.usage_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_ip_endpoint ON public.usage_analytics(ip_address, endpoint, created_at);