-- Fix the function search path security warning
CREATE OR REPLACE FUNCTION public.cleanup_old_analytics()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.usage_analytics 
  WHERE created_at < now() - interval '30 days';
END;
$$;