-- Pin search_path for functions reported by Supabase database lints.
-- Security impact:
-- - No RLS policies, privileges, extensions, or function bodies are changed.
-- - Only function-level search_path configuration is pinned to public.
-- - This removes role-mutable search_path behavior from existing public functions.

SET search_path TO public;

ALTER FUNCTION public.calculate_average_tat(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_approval_queue_metrics(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_coa_statistics(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_error_rate_metrics(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_kpi_metrics(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_sample_accession_trend(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_sample_ids_by_specialty(uuid[]) SET search_path = public;
ALTER FUNCTION public.get_samples_by_status(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_specialty_sample_stats(timestamp with time zone, timestamp with time zone, text[]) SET search_path = public;
ALTER FUNCTION public.get_staff_productivity(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_tat_trend_daily(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.global_search(text, integer) SET search_path = public;
ALTER FUNCTION public.run_qc_security_tests() SET search_path = public;
ALTER FUNCTION public.search_assays(text, integer) SET search_path = public;
ALTER FUNCTION public.search_audit_logs(text, integer) SET search_path = public;
ALTER FUNCTION public.search_clients(text, integer) SET search_path = public;
ALTER FUNCTION public.search_results(text, integer) SET search_path = public;
ALTER FUNCTION public.search_samples(text, integer) SET search_path = public;
ALTER FUNCTION public.test_check_qc_approval_status_exists() SET search_path = public;
ALTER FUNCTION public.test_get_active_qc_session_exists() SET search_path = public;
ALTER FUNCTION public.test_qc_manager_only_policies() SET search_path = public;
ALTER FUNCTION public.test_qc_results_analyst_can_insert() SET search_path = public;
ALTER FUNCTION public.test_qc_select_requires_authenticated() SET search_path = public;
ALTER FUNCTION public.test_qc_tables_have_policies() SET search_path = public;
ALTER FUNCTION public.test_qc_tables_have_rls_enabled() SET search_path = public;
ALTER FUNCTION public.test_qc_violations_analyst_can_insert() SET search_path = public;
ALTER FUNCTION public.test_qc_violations_only_manager_can_update() SET search_path = public;
ALTER FUNCTION public.track_sample_status_transitions() SET search_path = public;
ALTER FUNCTION public.update_search_vector_assay_definitions() SET search_path = public;
ALTER FUNCTION public.update_search_vector_audit_logs() SET search_path = public;
ALTER FUNCTION public.update_search_vector_clients() SET search_path = public;
ALTER FUNCTION public.update_search_vector_results() SET search_path = public;
ALTER FUNCTION public.update_search_vector_samples() SET search_path = public;
