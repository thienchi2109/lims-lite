-- Migration 207: Add explicit compatibility catalog service-role policies.
--
-- Migration 206 enabled RLS and revoked API access on the internal
-- compatibility catalog tables, but the global security suite requires every
-- RLS-enabled table to have at least one explicit policy.
--
-- Security impact:
-- - Adds SELECT-only policies scoped exclusively to service_role.
-- - Keeps anon and authenticated without table privileges or RLS policies.
-- - Preserves the existing no-direct-mutation boundary for every API role.
-- - Fails atomically if the migration 206 baseline or final policy contract
--   differs from the expected internal-catalog design.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
BEGIN
    IF to_regclass(
        'public.assay_sample_type_catalog_revisions'
    ) IS NULL
       OR to_regclass(
           'public.assay_sample_type_reviews'
       ) IS NULL
       OR to_regclass(
           'public.assay_sample_type_compatibilities'
       ) IS NULL
       OR to_regclass(
           'public.assay_sample_type_candidates'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 207 requires the migration 206 catalog tables';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_class AS catalog
        WHERE catalog.oid IN (
            'public.assay_sample_type_catalog_revisions'::REGCLASS,
            'public.assay_sample_type_reviews'::REGCLASS,
            'public.assay_sample_type_compatibilities'::REGCLASS,
            'public.assay_sample_type_candidates'::REGCLASS
        )
          AND NOT catalog.relrowsecurity
    ) THEN
        RAISE EXCEPTION
            'Migration 207 requires RLS on every compatibility catalog table';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polrelid IN (
            'public.assay_sample_type_catalog_revisions'::REGCLASS,
            'public.assay_sample_type_reviews'::REGCLASS,
            'public.assay_sample_type_compatibilities'::REGCLASS,
            'public.assay_sample_type_candidates'::REGCLASS
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 207 expected compatibility catalog policies to be absent';
    END IF;
END;
$baseline$;

DROP POLICY IF EXISTS "Service role can inspect compatibility revisions"
ON public.assay_sample_type_catalog_revisions;
CREATE POLICY "Service role can inspect compatibility revisions"
ON public.assay_sample_type_catalog_revisions
FOR SELECT
TO service_role
USING (((SELECT auth.jwt()) ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "Service role can inspect compatibility reviews"
ON public.assay_sample_type_reviews;
CREATE POLICY "Service role can inspect compatibility reviews"
ON public.assay_sample_type_reviews
FOR SELECT
TO service_role
USING (((SELECT auth.jwt()) ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "Service role can inspect compatibility entries"
ON public.assay_sample_type_compatibilities;
CREATE POLICY "Service role can inspect compatibility entries"
ON public.assay_sample_type_compatibilities
FOR SELECT
TO service_role
USING (((SELECT auth.jwt()) ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "Service role can inspect compatibility candidates"
ON public.assay_sample_type_candidates;
CREATE POLICY "Service role can inspect compatibility candidates"
ON public.assay_sample_type_candidates
FOR SELECT
TO service_role
USING (((SELECT auth.jwt()) ->> 'role') = 'service_role');

COMMENT ON POLICY "Service role can inspect compatibility revisions"
ON public.assay_sample_type_catalog_revisions
IS 'Allows read-only operational inspection by service_role; manager APIs will use future guarded RPCs.';

COMMENT ON POLICY "Service role can inspect compatibility reviews"
ON public.assay_sample_type_reviews
IS 'Allows read-only operational inspection by service_role; manager APIs will use future guarded RPCs.';

COMMENT ON POLICY "Service role can inspect compatibility entries"
ON public.assay_sample_type_compatibilities
IS 'Allows read-only operational inspection by service_role; manager APIs will use future guarded RPCs.';

COMMENT ON POLICY "Service role can inspect compatibility candidates"
ON public.assay_sample_type_candidates
IS 'Allows read-only operational inspection by service_role; manager APIs will use future guarded RPCs.';

DO $verification$
DECLARE
    v_table_name TEXT;
    v_qualified_table TEXT;
    v_policy_count INTEGER;
BEGIN
    SELECT count(*)
    INTO v_policy_count
    FROM pg_policy
    WHERE polrelid IN (
        'public.assay_sample_type_catalog_revisions'::REGCLASS,
        'public.assay_sample_type_reviews'::REGCLASS,
        'public.assay_sample_type_compatibilities'::REGCLASS,
        'public.assay_sample_type_candidates'::REGCLASS
    )
      AND polcmd = 'r'
      AND polroles = ARRAY['service_role'::REGROLE::OID]
      AND polwithcheck IS NULL
      AND position('auth.jwt()' IN pg_get_expr(polqual, polrelid)) > 0
      AND position(
          'service_role' IN pg_get_expr(polqual, polrelid)
      ) > 0;

    IF v_policy_count <> 4
       OR (
           SELECT count(*)
           FROM pg_policy
           WHERE polrelid IN (
               'public.assay_sample_type_catalog_revisions'::REGCLASS,
               'public.assay_sample_type_reviews'::REGCLASS,
               'public.assay_sample_type_compatibilities'::REGCLASS,
               'public.assay_sample_type_candidates'::REGCLASS
           )
       ) <> 4
    THEN
        RAISE EXCEPTION
            'Migration 207 compatibility catalog policy verification failed';
    END IF;

    FOREACH v_table_name IN ARRAY ARRAY[
        'assay_sample_type_catalog_revisions',
        'assay_sample_type_reviews',
        'assay_sample_type_compatibilities',
        'assay_sample_type_candidates'
    ]
    LOOP
        v_qualified_table := format('public.%I', v_table_name);

        IF NOT has_table_privilege(
            'service_role',
            v_qualified_table,
            'SELECT'
        )
           OR has_table_privilege(
               'service_role',
               v_qualified_table,
               'INSERT'
           )
           OR has_table_privilege(
               'service_role',
               v_qualified_table,
               'UPDATE'
           )
           OR has_table_privilege(
               'service_role',
               v_qualified_table,
               'DELETE'
           )
           OR has_table_privilege(
               'authenticated',
               v_qualified_table,
               'SELECT'
           )
           OR has_table_privilege(
               'anon',
               v_qualified_table,
               'SELECT'
           )
        THEN
            RAISE EXCEPTION
                'Migration 207 catalog privilege verification failed for %',
                v_qualified_table;
        END IF;
    END LOOP;
END;
$verification$;

COMMIT;
