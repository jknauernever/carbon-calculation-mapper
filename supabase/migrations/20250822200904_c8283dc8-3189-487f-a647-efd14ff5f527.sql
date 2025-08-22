-- Fix security issue: Restrict usage_analytics access to admins only
-- Remove any existing public policies on usage_analytics (if any)
DROP POLICY IF EXISTS "Public can view usage analytics" ON public.usage_analytics;

-- Create admin-only read access policy
CREATE POLICY "Only admins can view usage analytics" 
ON public.usage_analytics 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Ensure no public access policies exist
-- Keep the existing system insert policy for logging
-- CREATE POLICY "System can create analytics" already exists and is correct

-- Optional: Create policy for admins to manage analytics (delete old records, etc.)
CREATE POLICY "Admins can manage usage analytics" 
ON public.usage_analytics 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create a function for admins to get anonymized analytics summary
CREATE OR REPLACE FUNCTION public.get_analytics_summary(
  start_date timestamp with time zone DEFAULT now() - interval '30 days',
  end_date timestamp with time zone DEFAULT now()
)
RETURNS TABLE(
  endpoint text,
  request_count bigint,
  unique_ips bigint,
  avg_area_hectares numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Only allow admins to access this function
  SELECT 
    ua.endpoint,
    COUNT(*) as request_count,
    COUNT(DISTINCT ua.ip_address) as unique_ips,
    AVG((ua.request_data->>'area_hectares')::numeric) as avg_area_hectares
  FROM public.usage_analytics ua
  WHERE ua.created_at BETWEEN start_date AND end_date
    AND public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY ua.endpoint
  ORDER BY request_count DESC;
$$;