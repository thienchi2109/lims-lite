-- Migration 041: Backfill clients from samples and finalize constraints
-- Security Impact: MEDIUM - Modifies existing sample data, adds NOT NULL constraints
-- Description: Creates placeholder clients from existing samples, links them, finalizes FK/NOT NULL constraints
-- Changes: Data migration (INSERT clients), UPDATE samples (client_id, type), ADD constraints (FK, NOT NULL)

SET search_path TO public;

-- ============================================================================
-- 1. BACKFILL STRATEGY
-- ============================================================================
-- Problem: Existing samples have client_name but no client_id
-- Solution: Create placeholder client records using existing sample data
-- Approach:
--   1. Extract unique (client_name) from samples
--   2. Create placeholder clients with minimal data
--   3. Link samples to new client records
--   4. Add NOT NULL and FK constraints

-- ============================================================================
-- 2. CREATE PLACEHOLDER CLIENTS FROM EXISTING SAMPLES
-- ============================================================================

-- Insert unique clients based on existing sample.client_name
-- Use placeholder values for required fields that we don't have
INSERT INTO public.clients (
    name,
    date_of_birth,
    gender,
    phone,
    id_card_num,
    created_at,
    updated_at
)
SELECT DISTINCT
    COALESCE(client_name, 'Unknown Client') AS name,
    '2000-01-01'::DATE AS date_of_birth,  -- Placeholder DOB
    'Khác' AS gender,  -- Placeholder gender
    '0000000000' AS phone,  -- Placeholder phone (will be updated later)
    'BACKFILL-' || gen_random_uuid()::TEXT AS id_card_num,  -- Unique placeholder ID
    NOW() AS created_at,
    NOW() AS updated_at
FROM public.samples
WHERE client_name IS NOT NULL
  AND client_id IS NULL  -- Only backfill samples that don't have client_id yet
  -- Check if client doesn't already exist (avoid duplicates)
  AND NOT EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.name = COALESCE(samples.client_name, 'Unknown Client')
        AND c.date_of_birth = '2000-01-01'::DATE
  )
ON CONFLICT (name, date_of_birth) DO NOTHING;

-- Log backfill action
DO $$
DECLARE
    client_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO client_count FROM public.clients;
    RAISE NOTICE 'Backfill complete: % client records created', client_count;
END $$;

-- ============================================================================
-- 3. LINK EXISTING SAMPLES TO BACKFILLED CLIENTS
-- ============================================================================

-- Update samples.client_id to point to the backfilled client records
UPDATE public.samples s
SET client_id = c.id
FROM public.clients c
WHERE s.client_id IS NULL
  AND s.client_name IS NOT NULL
  AND c.name = s.client_name
  AND c.date_of_birth = '2000-01-01'::DATE;

-- Verify linkage
DO $$
DECLARE
    linked_count INTEGER;
    unlinked_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO linked_count 
    FROM public.samples WHERE client_id IS NOT NULL;
    
    SELECT COUNT(*) INTO unlinked_count 
    FROM public.samples WHERE client_id IS NULL;
    
    RAISE NOTICE 'Linked samples: %, Unlinked samples: %', linked_count, unlinked_count;
    
    IF unlinked_count > 0 THEN
        RAISE WARNING 'There are % samples without client_id. These may need manual review.', unlinked_count;
    END IF;
END $$;

-- ============================================================================
-- 4. BACKFILL sample.type WITH PLACEHOLDER
-- ============================================================================

-- Set placeholder type for samples that don't have it
UPDATE public.samples
SET type = 'Máu'  -- Default to 'Máu' (Blood) as most common type
WHERE type IS NULL;

-- Verify type backfill
DO $$
DECLARE
    null_type_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_type_count 
    FROM public.samples WHERE type IS NULL;
    
    IF null_type_count > 0 THEN
        RAISE WARNING 'There are % samples with NULL type after backfill', null_type_count;
    ELSE
        RAISE NOTICE 'All samples now have type assigned';
    END IF;
END $$;

-- ============================================================================
-- 5. ADD FOREIGN KEY CONSTRAINT (client_id -> clients.id)
-- ============================================================================

-- Add FK constraint (now that all samples have client_id)
DO $$
BEGIN
    -- Drop constraint if it exists (idempotent)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'samples_client_fk' 
        AND conrelid = 'public.samples'::regclass
    ) THEN
        ALTER TABLE public.samples DROP CONSTRAINT samples_client_fk;
    END IF;
    
    -- Create FK constraint
    ALTER TABLE public.samples ADD CONSTRAINT samples_client_fk 
    FOREIGN KEY (client_id) REFERENCES clients(id);
    
    RAISE NOTICE 'Foreign key constraint samples_client_fk created';
END $$;

-- ============================================================================
-- 6. ENFORCE NOT NULL CONSTRAINTS
-- ============================================================================

-- Make client_id NOT NULL (now that all samples are linked)
ALTER TABLE public.samples ALTER COLUMN client_id SET NOT NULL;

-- Make client_name NOT NULL (already required in practice)
ALTER TABLE public.samples ALTER COLUMN client_name SET NOT NULL;

-- Make type NOT NULL (now that all samples have type)
ALTER TABLE public.samples ALTER COLUMN type SET NOT NULL;

-- ============================================================================
-- 7. VERIFY CONSTRAINTS
-- ============================================================================

DO $$
DECLARE
    fk_exists BOOLEAN;
    client_id_nullable BOOLEAN;
    client_name_nullable BOOLEAN;
    type_nullable BOOLEAN;
BEGIN
    -- Check FK constraint
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'samples_client_fk'
    ) INTO fk_exists;
    
    -- Check NOT NULL constraints
    SELECT is_nullable = 'YES' INTO client_id_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'samples' AND column_name = 'client_id';
    
    SELECT is_nullable = 'YES' INTO client_name_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'samples' AND column_name = 'client_name';
    
    SELECT is_nullable = 'YES' INTO type_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'samples' AND column_name = 'type';
    
    -- Report status
    RAISE NOTICE 'Constraint verification:';
    RAISE NOTICE '  FK samples_client_fk exists: %', fk_exists;
    RAISE NOTICE '  client_id is NOT NULL: %', NOT client_id_nullable;
    RAISE NOTICE '  client_name is NOT NULL: %', NOT client_name_nullable;
    RAISE NOTICE '  type is NOT NULL: %', NOT type_nullable;
    
    IF NOT fk_exists OR client_id_nullable OR client_name_nullable OR type_nullable THEN
        RAISE EXCEPTION 'One or more constraints are not properly set';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Apply migration: Get-Content supabase\migrations\041_backfill_clients_from_samples.sql | docker exec -i lims-postgres psql -U postgres -d postgres
-- 2. Run security tests: docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
-- 3. Verify samples: docker exec lims-postgres psql -U postgres -d postgres -c "SELECT id, sample_id, client_id, client_name, type FROM samples LIMIT 5;"
-- 4. Verify clients: docker exec lims-postgres psql -U postgres -d postgres -c "SELECT id, name, date_of_birth, phone FROM clients LIMIT 5;"
