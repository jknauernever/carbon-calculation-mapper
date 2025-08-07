-- Remove user-based restrictions and allow public access to all tables

-- Drop existing restrictive policies on properties table
DROP POLICY IF EXISTS "Users can create their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can view their own properties or admins can view all" ON public.properties;

-- Drop existing restrictive policies on carbon_calculations table  
DROP POLICY IF EXISTS "Users can view calculations for their properties or admins can" ON public.carbon_calculations;
-- Keep the "System can create calculations" policy as it already allows all inserts

-- Drop all policies on user_roles table since we're removing user restrictions
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create new public access policies for properties
CREATE POLICY "Allow public read access to properties" 
ON public.properties FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to properties" 
ON public.properties FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to properties" 
ON public.properties FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to properties" 
ON public.properties FOR DELETE 
USING (true);

-- Create new public access policies for carbon_calculations
CREATE POLICY "Allow public read access to carbon_calculations" 
ON public.carbon_calculations FOR SELECT 
USING (true);

-- Create public access policies for user_roles (if needed for future use)
CREATE POLICY "Allow public read access to user_roles" 
ON public.user_roles FOR SELECT 
USING (true);

CREATE POLICY "Allow public write access to user_roles" 
ON public.user_roles FOR ALL 
USING (true);

-- Make user_id column nullable in properties table since it's no longer required
ALTER TABLE public.properties ALTER COLUMN user_id DROP NOT NULL;