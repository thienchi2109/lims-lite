-- Migration 159: Add immutable result reference assessment snapshots
-- Security Impact: HIGH
-- Changes:
--   - Adds append-only assessment snapshots for signed sample submissions.
--   - Denies direct client writes through table privileges and RLS.
--   - Audits every accepted snapshot insert for 21 CFR Part 11 traceability.

SET search_path TO public, extensions;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typnamespace = 'public'::regnamespace
          AND typname = 'result_reference_assessment'
    ) THEN
        CREATE TYPE public.result_reference_assessment AS ENUM (
            'within_reference_range',
            'outside_reference_range'
        );
    END IF;
END;
$$;

COMMENT ON TYPE public.result_reference_assessment
IS 'Analyst-recorded assessment of a submitted result against its displayed reference range.';

CREATE TABLE IF NOT EXISTS public.result_reference_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL
        REFERENCES public.sample_submissions(id) ON DELETE RESTRICT,
    result_id UUID NOT NULL
        REFERENCES public.results(id) ON DELETE RESTRICT,
    assessment public.result_reference_assessment NOT NULL,
    assay_name TEXT NOT NULL,
    result_value TEXT NOT NULL,
    unit TEXT,
    method_name TEXT,
    reference_range TEXT,
    analyst_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_result_reference_assessment
        UNIQUE (submission_id, result_id)
);

CREATE INDEX IF NOT EXISTS idx_result_reference_assessments_submission_id
ON public.result_reference_assessments (submission_id);

CREATE INDEX IF NOT EXISTS idx_result_reference_assessments_result_id
ON public.result_reference_assessments (result_id);

COMMENT ON TABLE public.result_reference_assessments
IS 'Immutable, audited analyst assessments and result display snapshots linked to signed sample submissions.';
COMMENT ON COLUMN public.result_reference_assessments.assessment
IS 'Manual analyst assessment; the server never infers this value from a reference range.';
COMMENT ON COLUMN public.result_reference_assessments.assay_name
IS 'Assay name copied from the locked assay definition at submission time.';
COMMENT ON COLUMN public.result_reference_assessments.result_value
IS 'Result value copied from the locked result row at submission time.';
COMMENT ON COLUMN public.result_reference_assessments.unit
IS 'Assay unit copied from the locked assay definition at submission time.';
COMMENT ON COLUMN public.result_reference_assessments.method_name
IS 'Assay-owned method text copied from the locked assay definition at submission time.';
COMMENT ON COLUMN public.result_reference_assessments.reference_range
IS 'Displayed assay reference range copied from the locked assay definition at submission time.';
COMMENT ON COLUMN public.result_reference_assessments.analyst_id
IS 'Analyst identity from the authenticated signed submission workflow.';
COMMENT ON COLUMN public.result_reference_assessments.assessed_at
IS 'Timestamp when the analyst assessment became part of the signed submission.';

ALTER TABLE public.result_reference_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Analysts and managers can view assessment snapshots"
ON public.result_reference_assessments;

CREATE POLICY "Analysts and managers can view assessment snapshots"
ON public.result_reference_assessments
FOR SELECT
TO authenticated
USING (
    (SELECT public.get_user_role()) = 'manager'::public.user_role
    OR (
        (SELECT public.get_user_role()) = 'analyst'::public.user_role
        AND EXISTS (
            SELECT 1
            FROM public.sample_submissions AS submission
            WHERE submission.id = result_reference_assessments.submission_id
              AND submission.user_id = (SELECT auth.uid())
        )
    )
);

COMMENT ON POLICY "Analysts and managers can view assessment snapshots"
ON public.result_reference_assessments
IS 'Managers retain the current submission-read scope; analysts read only snapshots from their own signed submissions.';

REVOKE ALL ON TABLE public.result_reference_assessments
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.result_reference_assessments TO authenticated;

DROP TRIGGER IF EXISTS audit_result_reference_assessments_trigger
ON public.result_reference_assessments;

CREATE TRIGGER audit_result_reference_assessments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.result_reference_assessments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

COMMENT ON TRIGGER audit_result_reference_assessments_trigger
ON public.result_reference_assessments
IS 'Creates an audit record for every assessment snapshot event required by 21 CFR Part 11.';

CREATE OR REPLACE FUNCTION public.prevent_result_reference_assessment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    RAISE EXCEPTION 'Result reference assessments are immutable'
        USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS prevent_result_reference_assessment_mutation
ON public.result_reference_assessments;

CREATE TRIGGER prevent_result_reference_assessment_mutation
BEFORE UPDATE OR DELETE ON public.result_reference_assessments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_result_reference_assessment_mutation();

COMMENT ON FUNCTION public.prevent_result_reference_assessment_mutation()
IS 'Enforces append-only assessment snapshot history even for SECURITY DEFINER workflows.';

DO $$
DECLARE
    v_rls_enabled BOOLEAN;
    v_write_policy_count INTEGER;
    v_insert_granted BOOLEAN;
BEGIN
    SELECT relrowsecurity
    INTO v_rls_enabled
    FROM pg_class
    WHERE oid = 'public.result_reference_assessments'::regclass;

    SELECT COUNT(*)
    INTO v_write_policy_count
    FROM pg_policy
    WHERE polrelid = 'public.result_reference_assessments'::regclass
      AND polcmd IN ('a', 'w', 'd');

    SELECT has_table_privilege(
        'authenticated',
        'public.result_reference_assessments',
        'INSERT'
    )
    INTO v_insert_granted;

    IF NOT v_rls_enabled OR v_write_policy_count <> 0 OR v_insert_granted THEN
        RAISE EXCEPTION 'Migration 159 verification failed';
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
