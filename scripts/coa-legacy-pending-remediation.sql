\set ON_ERROR_STOP on

\if :{?report_id}
\else
    DO $required$
    BEGIN
        RAISE EXCEPTION 'report_id is required';
    END;
    $required$;
\endif

\if :{?accountable_user_id}
\else
    DO $required$
    BEGIN
        RAISE EXCEPTION 'accountable_user_id is required';
    END;
    $required$;
\endif

\if :{?reason}
\else
    DO $required$
    BEGIN
        RAISE EXCEPTION 'reason is required';
    END;
    $required$;
\endif

\if :{?approval_reference}
\else
    DO $required$
    BEGIN
        RAISE EXCEPTION 'approval_reference is required';
    END;
    $required$;
\endif

\if :{?stale_before}
\else
    DO $required$
    BEGIN
        RAISE EXCEPTION
            'stale_before is required as the approved stale criterion';
    END;
    $required$;
\endif

\if :{?commit_remediation}
\else
    \set commit_remediation false
\endif

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = public, extensions;

SELECT set_config(
    'request.jwt.claim.sub',
    :'accountable_user_id',
    true
);
SELECT set_config(
    'lims.coa_remediation_report_id',
    :'report_id',
    true
);
SELECT set_config(
    'lims.coa_remediation_reason',
    :'reason',
    true
);
SELECT set_config(
    'lims.coa_remediation_approval_reference',
    :'approval_reference',
    true
);
SELECT set_config(
    'lims.coa_remediation_stale_before',
    :'stale_before',
    true
);
SELECT set_config(
    'lims.coa_remediation_audited_reason',
    current_setting('lims.coa_remediation_reason')
        || ' | Approval reference: '
        || current_setting('lims.coa_remediation_approval_reference'),
    true
);

CREATE TEMP TABLE coa_legacy_pending_before
(LIKE public.coa_reports INCLUDING ALL)
ON COMMIT DROP;

INSERT INTO coa_legacy_pending_before
SELECT *
FROM public.coa_reports
WHERE id = :'report_id'::uuid
FOR UPDATE;

DO $validate$
DECLARE
    target_report RECORD;
    approved_stale_before TIMESTAMPTZ :=
        current_setting('lims.coa_remediation_stale_before')::timestamptz;
    remediation_reason TEXT :=
        current_setting('lims.coa_remediation_reason');
    approval_reference TEXT :=
        current_setting('lims.coa_remediation_approval_reference');
    accountable_user UUID :=
        current_setting('request.jwt.claim.sub')::uuid;
BEGIN
    SELECT *
    INTO target_report
    FROM pg_temp.coa_legacy_pending_before;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'CoA report % was not found',
            current_setting('lims.coa_remediation_report_id');
    END IF;

    IF target_report.status <> 'pending' THEN
        RAISE EXCEPTION
            'CoA report % must be pending; current status is %',
            target_report.id,
            target_report.status;
    END IF;

    IF approved_stale_before >
       clock_timestamp() - INTERVAL '15 minutes' THEN
        RAISE EXCEPTION
            'Approved stale cutoff must be at least 15 minutes old';
    END IF;

    IF GREATEST(
        target_report.created_at,
        target_report.updated_at,
        target_report.generated_at
    ) >= approved_stale_before THEN
        RAISE EXCEPTION
            'CoA report % may be active and does not satisfy the approved '
            'stale criterion (latest activity %, cutoff %). Escalate active '
            'generation instead of remediating it.',
            target_report.id,
            GREATEST(
                target_report.created_at,
                target_report.updated_at,
                target_report.generated_at
            ),
            approved_stale_before;
    END IF;

    IF NULLIF(BTRIM(remediation_reason), '') IS NULL THEN
        RAISE EXCEPTION 'Remediation reason must not be blank';
    END IF;

    IF NULLIF(BTRIM(approval_reference), '') IS NULL THEN
        RAISE EXCEPTION 'Approval reference must not be blank';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = accountable_user
          AND deleted_at IS NULL
          AND role IN ('analyst', 'manager')
    ) THEN
        RAISE EXCEPTION
            'Accountable user % must be an active analyst or manager',
            accountable_user;
    END IF;
END;
$validate$;

UPDATE public.coa_reports
SET status = 'failed',
    error_message =
        current_setting('lims.coa_remediation_audited_reason'),
    updated_at = clock_timestamp()
WHERE id = current_setting('lims.coa_remediation_report_id')::uuid;

DO $verify_audit$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.audit_logs
        WHERE table_name = 'coa_reports'
          AND record_id =
              current_setting('lims.coa_remediation_report_id')::uuid
          AND operation = 'UPDATE'
          AND changed_by = current_setting('request.jwt.claim.sub')::uuid
          AND old_values ->> 'status' = 'pending'
          AND new_values ->> 'status' = 'failed'
          AND new_values ->> 'error_message' =
              current_setting('lims.coa_remediation_audited_reason')
          AND changed_at >= transaction_timestamp()
    ) THEN
        RAISE EXCEPTION
            'Expected CoA remediation audit row was not recorded';
    END IF;
END;
$verify_audit$;

WITH remediation_audit AS (
    SELECT *
    FROM public.audit_logs
    WHERE table_name = 'coa_reports'
      AND record_id =
          current_setting('lims.coa_remediation_report_id')::uuid
      AND operation = 'UPDATE'
      AND changed_by = current_setting('request.jwt.claim.sub')::uuid
      AND old_values ->> 'status' = 'pending'
      AND new_values ->> 'status' = 'failed'
      AND new_values ->> 'error_message' =
          current_setting('lims.coa_remediation_audited_reason')
      AND changed_at >= transaction_timestamp()
    ORDER BY changed_at DESC, id DESC
    LIMIT 1
)
SELECT jsonb_build_object(
    'evidence_type', 'coa_legacy_remediation',
    'report_id', current_report.id,
    'accountable_user_id', remediation_audit.changed_by,
    'old_status', remediation_audit.old_values ->> 'status',
    'new_status', remediation_audit.new_values ->> 'status',
    'reason', current_setting('lims.coa_remediation_reason'),
    'approval_reference',
        current_setting('lims.coa_remediation_approval_reference'),
    'audited_reason',
        remediation_audit.new_values ->> 'error_message',
    'preserved', jsonb_build_object(
        'id', before_report.id = current_report.id,
        'sample_id',
            before_report.sample_id = current_report.sample_id,
        'version', before_report.version = current_report.version,
        'source_submission_id',
            before_report.source_submission_id IS NOT DISTINCT FROM
                current_report.source_submission_id,
        'signature_id',
            before_report.signature_id IS NOT DISTINCT FROM
                current_report.signature_id,
        'artifact_fields',
            before_report.file_path IS NOT DISTINCT FROM
                current_report.file_path
            AND before_report.file_hash IS NOT DISTINCT FROM
                current_report.file_hash
            AND before_report.generated_at IS NOT DISTINCT FROM
                current_report.generated_at
            AND before_report.created_at IS NOT DISTINCT FROM
                current_report.created_at
            AND before_report.deleted_at IS NOT DISTINCT FROM
                current_report.deleted_at
            AND before_report.superseded_by IS NOT DISTINCT FROM
                current_report.superseded_by
    )
)::text
FROM pg_temp.coa_legacy_pending_before AS before_report
JOIN public.coa_reports AS current_report
  ON current_report.id = before_report.id
CROSS JOIN remediation_audit;

\if :commit_remediation
    COMMIT;
\else
    \echo 'Dry run complete: transaction rolled back'
    ROLLBACK;
\endif
