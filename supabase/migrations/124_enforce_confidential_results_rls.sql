-- Migration 124: Enforce confidential HIV access on results RLS
-- Security Impact: High
-- Changes:
--   - Replaces public.results SELECT/INSERT/UPDATE policies with confidential-aware predicates
--   - Requires explicit confidential authorization for confidential assay result reads and writes
--   - Backfills seeded HIV assay definitions to is_confidential = TRUE
--   - Removes legacy overlapping result policies so no orphaned policy bypass remains

SET search_path TO public;

UPDATE public.assay_definitions
SET is_confidential = TRUE
WHERE name IN (
    'HIV Ag/Ab định tính',
    'HIV đo tải lượng hệ thống tự động',
    'HIV khẳng định',
    'HIV miễn dịch bán tự động'
)
  AND deleted_at IS NULL;

DROP POLICY IF EXISTS "Authenticated users can read results" ON public.results;
CREATE POLICY "Authenticated users can read results"
ON public.results FOR SELECT
USING (
    auth.uid() IS NOT NULL
    AND public.get_user_role() IN ('analyst', 'manager')
    AND (
        NOT EXISTS (
            SELECT 1
            FROM public.assay_definitions AS assay_definition
            WHERE assay_definition.id = results.assay_id
              AND assay_definition.is_confidential = TRUE
        )
        OR public.user_can_access_confidential()
    )
);

COMMENT ON POLICY "Authenticated users can read results" ON public.results
IS 'Authenticated users may read non-confidential results; confidential assay results require explicit confidential authorization.';

DROP POLICY IF EXISTS "Analysts can insert pending results" ON public.results;
DROP POLICY IF EXISTS "Managers can insert results" ON public.results;
DROP POLICY IF EXISTS "Analysts and managers can insert pending results" ON public.results;
DROP POLICY IF EXISTS "Analysts and managers can insert results" ON public.results;
CREATE POLICY "Analysts and managers can insert results"
ON public.results FOR INSERT
WITH CHECK (
    public.get_user_role() IN ('analyst', 'manager')
    AND (
        public.get_user_role() = 'manager'
        OR (
            public.get_user_role() = 'analyst'
            AND results.status = 'pending'
            AND EXISTS (
                SELECT 1
                FROM public.samples AS sample
                WHERE sample.id = results.sample_id
                  AND sample.deleted_at IS NULL
            )
        )
    )
    AND (
        NOT EXISTS (
            SELECT 1
            FROM public.assay_definitions AS assay_definition
            WHERE assay_definition.id = results.assay_id
              AND assay_definition.is_confidential = TRUE
        )
        OR public.user_can_access_confidential()
    )
);

COMMENT ON POLICY "Analysts and managers can insert results" ON public.results
IS 'Analysts and managers may insert results per existing workflow, but confidential assays require explicit confidential authorization.';

DROP POLICY IF EXISTS "Analysts can update non-review results" ON public.results;
DROP POLICY IF EXISTS "Managers can update results" ON public.results;
DROP POLICY IF EXISTS "Managers can manage all results" ON public.results;
DROP POLICY IF EXISTS "Analysts and managers can update results" ON public.results;
CREATE POLICY "Analysts and managers can update results"
ON public.results FOR UPDATE
USING (
    public.get_user_role() IN ('analyst', 'manager')
    AND (
        public.get_user_role() = 'manager'
        OR (
            public.get_user_role() = 'analyst'
            AND results.status <> 'approved'
            AND (
                SELECT sample.status
                FROM public.samples AS sample
                WHERE sample.id = results.sample_id
            ) NOT IN ('review', 'completed')
        )
    )
    AND (
        NOT EXISTS (
            SELECT 1
            FROM public.assay_definitions AS assay_definition
            WHERE assay_definition.id = results.assay_id
              AND assay_definition.is_confidential = TRUE
        )
        OR public.user_can_access_confidential()
    )
)
WITH CHECK (
    public.get_user_role() IN ('analyst', 'manager')
    AND (
        public.get_user_role() = 'manager'
        OR (
            public.get_user_role() = 'analyst'
            AND results.status <> 'approved'
            AND (
                SELECT sample.status
                FROM public.samples AS sample
                WHERE sample.id = results.sample_id
            ) NOT IN ('review', 'completed')
        )
    )
    AND (
        NOT EXISTS (
            SELECT 1
            FROM public.assay_definitions AS assay_definition
            WHERE assay_definition.id = results.assay_id
              AND assay_definition.is_confidential = TRUE
        )
        OR public.user_can_access_confidential()
    )
);

COMMENT ON POLICY "Analysts and managers can update results" ON public.results
IS 'Analysts and managers may update results per existing workflow, but confidential assays require explicit confidential authorization.';
