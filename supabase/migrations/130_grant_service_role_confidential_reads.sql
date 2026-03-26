-- Migration 130: Grant service_role read access for confidentiality helpers
-- Security Impact: Medium
-- Changes:
--   - Grants service_role SELECT on results, assay_definitions, and users
--   - Restores admin-helper reads used for confidential sample/client concealment
--   - Keeps service_role operating with existing bypassrls semantics

SET search_path TO public;

GRANT SELECT ON TABLE public.results TO service_role;
GRANT SELECT ON TABLE public.assay_definitions TO service_role;
GRANT SELECT ON TABLE public.users TO service_role;
