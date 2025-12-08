-- Migration 035: Fix rejected_by foreign key constraint name
-- Description: Ensures the foreign key has the correct name for PostgREST to find it

SET search_path TO public;

-- First, get the current constraint name and drop it if it exists
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find the constraint name for rejected_by column
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.samples'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.samples'::regclass
        AND attname = 'rejected_by'
    )];
    
    -- Drop the constraint if it exists and is not already named correctly
    IF constraint_name IS NOT NULL AND constraint_name != 'samples_rejected_by_fkey' THEN
        EXECUTE format('ALTER TABLE public.samples DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Add the foreign key constraint with the correct name
ALTER TABLE public.samples 
    ADD CONSTRAINT samples_rejected_by_fkey 
    FOREIGN KEY (rejected_by) 
    REFERENCES public.users(id);

COMMENT ON CONSTRAINT samples_rejected_by_fkey ON public.samples 
IS 'Foreign key to users table for tracking who rejected/discarded the sample';
