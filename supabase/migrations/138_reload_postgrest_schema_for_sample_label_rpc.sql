-- Reload PostgREST schema cache after adding the sample label print RPC.
--
-- Security Impact:
-- - Does not change privileges or data.
-- - Ensures PostgREST exposes public.record_sample_label_print without requiring
--   a manual service restart after the prior RPC migration is applied.

SELECT pg_notify('pgrst', 'reload schema');
