-- Migration 047: Refresh PostgREST schema cache after lab specialties
-- Security Impact: None
-- Changes: Force PostgREST to recognize assay_definitions.specialty_id column

SET search_path TO public;

-- Reload PostgREST schema cache so new specialty_id column is visible
NOTIFY pgrst, 'reload schema';

-- Fallback to ensure cache refresh even if NOTIFY is missed
COMMENT ON SCHEMA public IS 'Schema cache refresh after lab specialties v047';
