-- Fix critical security vulnerability in user_roles table
-- Remove overly permissive policies
DROP POLICY IF EXISTS "Allow public read access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public write access to user_roles" ON public.user_roles;

-- Create secure RLS policies for user_roles table

-- Policy 1: Users can only view their own role information
CREATE POLICY "Users can view their own role" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Policy 2: Admins can view all user roles (for management purposes)
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy 3: Only admins can insert new role assignments
CREATE POLICY "Admins can assign roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy 4: Only admins can update role assignments
CREATE POLICY "Admins can update roles" 
ON public.user_roles 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy 5: Only admins can delete role assignments
CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create a helper function for users to check their own roles efficiently
CREATE OR REPLACE FUNCTION public.get_user_roles(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(role app_role)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Allow users to see their own roles, or admins to see any user's roles
  SELECT ur.role
  FROM public.user_roles ur
  WHERE ur.user_id = target_user_id
    AND (target_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
$$;