-- Migration 040: Update samples table for client linkage
-- Security Impact: LOW - No changes to existing RLS policies, adds FK constraint
-- Description: Adds client_id FK, type CHECK, client_name auto-fill trigger
-- Changes: New columns (client_id, type), new trigger (sync_client_name_snapshot), new constraints

SET search_path TO public;

-- ============================================================================
-- 1. ADD NEW COLUMN: type (TEXT with CHECK constraint)
-- ============================================================================

-- Add type column if not exists (nullable initially for backfill)
ALTER TABLE public.samples ADD COLUMN IF NOT EXISTS type TEXT;

-- Add CHECK constraint for allowed sample types
DO $$
BEGIN
    -- Drop constraint if it exists (idempotent)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'samples_type_check' 
        AND conrelid = 'public.samples'::regclass
    ) THEN
        ALTER TABLE public.samples DROP CONSTRAINT samples_type_check;
    END IF;
    
    -- Create constraint
    ALTER TABLE public.samples ADD CONSTRAINT samples_type_check CHECK (type IN (
        'Máu',
        'Dịch niệu đạo/âm đạo',
        'Nước tiểu',
        'Phết tế bào âm đạo',
        'Ngoáy trực tràng/hậu môn',
        'Phân',
        'Nước',
        'Thực phẩm'
    ));
END $$;

COMMENT ON COLUMN public.samples.type IS 'Sample type - must match Vietnamese sample type list';

-- ============================================================================
-- 2. CREATE INDEX ON type FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_samples_type ON public.samples(type);

-- ============================================================================
-- 3. CREATE TRIGGER: Auto-fill client_name from clients table
-- ============================================================================

-- Create or replace the snapshot function
CREATE OR REPLACE FUNCTION sync_client_name_snapshot()
RETURNS TRIGGER AS $$
BEGIN
    -- When client_id is provided, auto-fill client_name from clients table
    IF NEW.client_id IS NOT NULL THEN
        SELECT name INTO NEW.client_name
        FROM public.clients
        WHERE id = NEW.client_id;
        
        -- If client not found, raise error (FK constraint should catch this too)
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client with id % not found', NEW.client_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_client_name_snapshot() IS 
'Auto-fills samples.client_name from clients.name when client_id changes. Ensures historical snapshot accuracy.';

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS sync_samples_client_name ON public.samples;

-- Create trigger
CREATE TRIGGER sync_samples_client_name
  BEFORE INSERT OR UPDATE OF client_id ON public.samples
  FOR EACH ROW
  EXECUTE FUNCTION sync_client_name_snapshot();

-- ============================================================================
-- 4. ADD FOREIGN KEY CONSTRAINT (client_id -> clients.id)
-- ============================================================================

-- NOTE: This will be added AFTER backfill in migration 041
-- Placeholder comment for tracking
-- ALTER TABLE public.samples ADD CONSTRAINT samples_client_fk FOREIGN KEY (client_id) REFERENCES clients(id);

-- ============================================================================
-- 5. CREATE INDEX ON client_id FOR FK PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_samples_client_id ON public.samples(client_id);

-- ============================================================================
-- MIGRATION COMPLETE (Part 1 of 2)
-- ============================================================================
-- Next steps:
-- 1. Apply migration: Get-Content supabase\migrations\040_update_samples_for_clients.sql | docker exec -i lims-postgres psql -U postgres -d postgres
-- 2. Verify columns: docker exec lims-postgres psql -U postgres -d postgres -c "\d samples"
-- 3. Proceed to migration 041 for backfill and final constraints
