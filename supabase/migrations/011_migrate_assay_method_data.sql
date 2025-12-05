-- ============================================================================
-- Migration 011: Migrate Assay-Method Data
-- ============================================================================
-- Migrates existing method_id from assay_definitions to assay_methods junction
-- table, then removes the redundant column
-- 
-- IMPORTANT: This is a breaking schema change
-- ============================================================================

SET search_path TO public;

-- ============================================================================
-- STEP 1: MIGRATE EXISTING DATA
-- ============================================================================

DO $$
DECLARE
    migrated_count INT := 0;
    assay_record RECORD;
BEGIN
    RAISE NOTICE 'Starting data migration from assay_definitions.method_id to assay_methods...';
    
    -- Migrate all assays that have a method_id set
    FOR assay_record IN 
        SELECT id, method_id 
        FROM assay_definitions 
        WHERE method_id IS NOT NULL 
        AND deleted_at IS NULL
    LOOP
        -- Insert into junction table, mark as default
        INSERT INTO assay_methods (assay_id, method_id, is_default, notes)
        VALUES (
            assay_record.id,
            assay_record.method_id,
            true,  -- Existing method becomes the default
            'Migrated from original assay definition'
        )
        ON CONFLICT (assay_id, method_id) DO NOTHING;
        
        migrated_count := migrated_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Migrated % assay-method relationships', migrated_count;
END $$;

-- ============================================================================
-- STEP 2: VERIFY ALL ASSAYS HAVE AT LEAST ONE METHOD
-- ============================================================================

DO $$
DECLARE
    orphan_count INT;
    orphan_assays TEXT;
BEGIN
    -- Count assays without any methods
    SELECT COUNT(*), STRING_AGG(name, ', ')
    INTO orphan_count, orphan_assays
    FROM assay_definitions a
    WHERE a.deleted_at IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM assay_methods am
        WHERE am.assay_id = a.id
    );
    
    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % assays without methods: %', orphan_count, orphan_assays;
        RAISE WARNING 'These assays need manual method assignment before proceeding';
        RAISE WARNING 'You can add methods via the UI or run:';
        RAISE WARNING 'INSERT INTO assay_methods (assay_id, method_id, is_default) VALUES (''<assay_id>'', ''<method_id>'', true);';
        
        -- Uncomment the line below to make this a hard error that stops migration
        -- RAISE EXCEPTION 'Migration halted: % assays without methods', orphan_count;
    ELSE
        RAISE NOTICE '✓ All active assays have at least one method';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: DROP OLD COLUMN
-- ============================================================================

-- Remove the now-redundant method_id column from assay_definitions
ALTER TABLE public.assay_definitions
DROP COLUMN IF EXISTS method_id;

DO $$ BEGIN
    RAISE NOTICE '✓ Removed method_id column from assay_definitions';
END $$;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Show summary of assay-method relationships
DO $$
DECLARE
    total_assays INT;
    total_relationships INT;
    avg_methods_per_assay NUMERIC;
BEGIN
    SELECT COUNT(DISTINCT a.id), COUNT(am.id), AVG(method_counts.cnt)
    INTO total_assays, total_relationships, avg_methods_per_assay
    FROM assay_definitions a
    LEFT JOIN assay_methods am ON a.id = am.assay_id
    LEFT JOIN (
        SELECT assay_id, COUNT(*) as cnt
        FROM assay_methods
        GROUP BY assay_id
    ) method_counts ON a.id = method_counts.assay_id
    WHERE a.deleted_at IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'MIGRATION SUMMARY';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Total active assays: %', total_assays;
    RAISE NOTICE 'Total assay-method relationships: %', total_relationships;
    RAISE NOTICE 'Average methods per assay: %', ROUND(avg_methods_per_assay, 2);
    RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

-- If you need to rollback this migration, run:
-- 
-- -- Step 1: Re-add method_id column
-- ALTER TABLE public.assay_definitions ADD COLUMN method_id UUID REFERENCES public.methods(id);
-- 
-- -- Step 2: Copy default method back
-- UPDATE assay_definitions a
-- SET method_id = am.method_id
-- FROM assay_methods am
-- WHERE a.id = am.assay_id AND am.is_default = true;
-- 
-- -- Step 3: Drop junction table
-- DROP TABLE public.assay_methods;
