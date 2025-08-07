-- Step 2: Modify the properties table to remove user_id dependency
-- Option 1: Simply drop the user_id column if you don't need it
ALTER TABLE public.properties DROP COLUMN IF EXISTS user_id;

-- Option 2: Or if you need to keep track of ownership without auth,
-- you could replace it with a different identifier like:
-- ALTER TABLE public.properties 
--   ALTER COLUMN user_id TYPE text,
--   ALTER COLUMN user_id DROP NOT NULL;