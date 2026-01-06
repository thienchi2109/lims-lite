-- Migration 112: Grant service_role access for CoA public endpoints
-- Security Impact: Low (minimal grants, service_role is trusted)
-- Purpose: Enable public CoA endpoints that use JWT-based client authentication

SET search_path TO public;

-- ============================================================================
-- CoA PUBLIC ACCESS GRANTS (Principle of Least Privilege)
--
-- The /api/coa/* endpoints authenticate clients via phone + JWT token,
-- NOT via Supabase Auth. RLS policies (designed for LIMS users) cannot
-- apply, so service_role is used with application-level authorization.
--
-- Grant strategy: Minimum permissions needed per endpoint
-- - /api/coa/authenticate: SELECT clients, samples, coa_reports; INSERT coa_access_log
-- - /api/coa/download: SELECT samples, coa_reports, storage; INSERT coa_access_log
-- ============================================================================

-- clients: Query by phone for authentication (SELECT only)
GRANT SELECT ON public.clients TO service_role;

-- samples: Fetch completed samples for client (SELECT only)
GRANT SELECT ON public.samples TO service_role;

-- coa_reports: Fetch ready reports for download (SELECT only)
GRANT SELECT ON public.coa_reports TO service_role;

-- coa_access_log: Audit trail (INSERT for logging, SELECT for analytics)
GRANT SELECT, INSERT ON public.coa_access_log TO service_role;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.coa_access_log IS
    'Audit log for CoA access. service_role has SELECT+INSERT for public endpoint logging.';
