-- Migration 129: Backfill HIV viral load and CD4 assays as confidential
-- Security Impact: Medium
-- Changes:
--   - Marks HIV viral load assays as confidential
--   - Marks CD4 assays as confidential
--   - Keeps the backfill idempotent for repeated deploys

SET search_path TO public;

UPDATE public.assay_definitions
SET is_confidential = TRUE
WHERE deleted_at IS NULL
  AND is_confidential = FALSE
  AND (
    lower(name) IN (
      'hiv đo tải lượng hệ thống tự động',
      'đếm số lượng tế bào cd3/cd4/cd8'
    )
    OR (
      lower(name) LIKE '%hiv%'
      AND lower(name) LIKE '%tải lượng%'
    )
    OR lower(name) LIKE '%cd4%'
  );
