-- First, drop the remaining dependent policy
DROP POLICY IF EXISTS "Users can view calculations for their properties or admins can " ON public.carbon_calculations;

-- Now drop the user_id column from properties table
ALTER TABLE public.properties DROP COLUMN IF EXISTS user_id;