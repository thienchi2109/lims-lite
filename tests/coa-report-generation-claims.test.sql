-- COA REPORT GENERATION CLAIM REGRESSION TEST
-- Verifies one worker owns each generation attempt and all report transitions
-- stay behind authenticated, claim-bound RPCs.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/coa-report-generation-claims.test.sql

\set ON_ERROR_STOP on
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_analyst_id UUID := '92000000-0000-0000-0000-000000000001';
    v_manager_id UUID := '92000000-0000-0000-0000-000000000002';
    v_other_manager_id UUID := '92000000-0000-0000-0000-000000000003';
    v_analyst_signature_id UUID := '92000000-0000-0000-0000-000000000011';
    v_signature_id UUID := '92000000-0000-0000-0000-000000000012';
    v_other_manager_signature_id UUID := '92000000-0000-0000-0000-000000000013';
    v_sample_id UUID := '92000000-0000-0000-0000-000000000040';
    v_other_sample_id UUID := '92000000-0000-0000-0000-000000000041';
    v_submission_id UUID := '92000000-0000-0000-0000-000000000060';
    v_tied_result_ids UUID[];
    v_report JSONB;
    v_second_claim JSONB;
    v_report_id UUID;
    v_claim_id UUID;
    v_reclaimed_claim_id UUID;
    v_missing_profile_denied BOOLEAN := FALSE;
    v_analyst_regeneration_denied BOOLEAN := FALSE;
    v_direct_update_denied BOOLEAN := FALSE;
    v_missing_signature_denied BOOLEAN := FALSE;
    v_unrelated_signature_denied BOOLEAN := FALSE;
    v_inactive_signature_denied BOOLEAN := FALSE;
    v_deleted_signature_denied BOOLEAN := FALSE;
    v_null_restore_denied BOOLEAN := FALSE;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_analyst_id, 'issue-90-claims-analyst@lims.local'),
        (v_manager_id, 'issue-90-claims-manager@lims.local'),
        (v_other_manager_id, 'issue-90-claims-secondary-manager@lims.local');

    INSERT INTO public.users (id, username, full_name, role)
    VALUES
        (
            v_analyst_id,
            'issue90_claims_analyst',
            'Issue 90 Claims Analyst',
            'analyst'
        ),
        (
            v_manager_id,
            'issue90_claims_manager',
            'Issue 90 Claims Manager',
            'manager'
        ),
        (
            v_other_manager_id,
            'issue90_claims_secondary_manager',
            'Issue 90 Claims Secondary Manager',
            'manager'
        );

    INSERT INTO public.user_signatures (
        id,
        user_id,
        signature_path,
        signature_hash,
        file_size,
        mime_type,
        is_active
    )
    VALUES
        (
            v_analyst_signature_id,
            v_analyst_id,
            'issue-90/claims-analyst.png',
            encode(digest('issue-90-claims-analyst', 'sha256'), 'hex'),
            1,
            'image/png',
            TRUE
        ),
        (
            v_signature_id,
            v_manager_id,
            'issue-90/claims-manager.png',
            encode(digest('issue-90-claims-manager', 'sha256'), 'hex'),
            1,
            'image/png',
            TRUE
        );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone
    )
    VALUES (
        '92000000-0000-0000-0000-000000000020',
        '090920000001',
        'Issue 90 Generation Claims Client',
        DATE '1992-09-20',
        'Nam',
        '0909200001'
    );

    INSERT INTO public.assay_definitions (
        id,
        name,
        units,
        is_confidential,
        normal_range,
        method_name
    )
    VALUES
        (
            '92000000-0000-0000-0000-000000000031',
            'Issue 90 Generation Claims Assay A',
            'mg/L',
            FALSE,
            '1-10',
            'Claims Method A'
        ),
        (
            '92000000-0000-0000-0000-000000000032',
            'Issue 90 Generation Claims Assay B',
            'mg/L',
            FALSE,
            '2-20',
            'Claims Method B'
        );

    INSERT INTO public.samples (
        id,
        sample_id,
        client_id,
        client_name,
        status,
        received_by,
        type,
        completed_at,
        sample_quality
    )
    VALUES
        (
            v_sample_id,
            'ISSUE90-COA-GENERATION-CLAIMS',
            '92000000-0000-0000-0000-000000000020',
            'Issue 90 Generation Claims Client',
            'completed',
            v_analyst_id,
            'Máu',
            TIMESTAMPTZ '2026-07-21 02:00:00+00',
            TRUE
        ),
        (
            v_other_sample_id,
            'ISSUE90-COA-GENERATION-UNRELATED',
            '92000000-0000-0000-0000-000000000020',
            'Issue 90 Generation Claims Client',
            'received',
            v_analyst_id,
            'Máu',
            NULL,
            TRUE
        );

    INSERT INTO public.results (
        id,
        sample_id,
        assay_id,
        value,
        status,
        entered_by,
        approved_by,
        approved_at
    )
    VALUES
        (
            '92000000-0000-0000-0000-000000000051',
            v_sample_id,
            '92000000-0000-0000-0000-000000000031',
            '5',
            'approved',
            v_analyst_id,
            v_manager_id,
            TIMESTAMPTZ '2026-07-21 02:05:00+00'
        ),
        (
            '92000000-0000-0000-0000-000000000052',
            v_sample_id,
            '92000000-0000-0000-0000-000000000032',
            '10',
            'approved',
            v_analyst_id,
            v_manager_id,
            TIMESTAMPTZ '2026-07-21 02:06:00+00'
        );

    INSERT INTO public.sample_submissions (
        id,
        sample_id,
        user_id,
        signature_id,
        submission_number,
        signature_meaning
    )
    VALUES (
        v_submission_id,
        v_sample_id,
        v_analyst_id,
        v_analyst_signature_id,
        1,
        'I certify I performed these tests and entered these results accurately'
    );

    UPDATE public.user_signatures
    SET is_active = FALSE
    WHERE user_id = v_other_manager_id
      AND is_active;

    INSERT INTO public.user_signatures (
        id,
        user_id,
        signature_path,
        signature_hash,
        file_size,
        mime_type,
        is_active
    )
    VALUES (
        v_other_manager_signature_id,
        v_other_manager_id,
        'claim-test/other-manager-signature.png',
        encode(digest('other-manager-signature', 'sha256'), 'hex'),
        1,
        'image/png',
        TRUE
    );

    SELECT ARRAY_AGG(result.id ORDER BY result.id DESC)
    INTO v_tied_result_ids
    FROM (
        SELECT id
        FROM public.results
        WHERE sample_id = v_sample_id
        ORDER BY id DESC
        LIMIT 2
    ) AS result;

    UPDATE public.results
    SET approved_at = TIMESTAMPTZ '2026-07-11 00:00:00+00',
        approved_by = CASE
            WHEN id = v_tied_result_ids[1] THEN v_manager_id
            ELSE v_other_manager_id
        END
    WHERE id = ANY(v_tied_result_ids);

    INSERT INTO public.result_reference_assessments (
        submission_id,
        result_id,
        assessment,
        assay_name,
        result_value,
        unit,
        method_name,
        reference_range,
        analyst_id
    )
    SELECT
        v_submission_id,
        result.id,
        'within_reference_range',
        assay.name,
        COALESCE(result.value, ''),
        assay.units,
        assay.method_name,
        assay.normal_range,
        submission.user_id
    FROM public.results AS result
    JOIN public.assay_definitions AS assay
      ON assay.id = result.assay_id
    JOIN public.sample_submissions AS submission
      ON submission.id = v_submission_id
    WHERE result.sample_id = v_sample_id
    ON CONFLICT (submission_id, result_id) DO NOTHING;

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_manager_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        v_manager_id::TEXT,
        TRUE
    );

    EXECUTE 'SET LOCAL ROLE authenticated';
    v_report := public.queue_coa_report_for_generation(v_sample_id, 920001);
    v_report_id := (v_report ->> 'report_id')::UUID;
    v_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE
       OR v_claim_id IS NULL THEN
        RAISE EXCEPTION 'First queue caller must own a generation claim';
    END IF;

    v_second_claim :=
        public.queue_coa_report_for_generation(v_sample_id, 920001);

    IF (v_second_claim ->> 'claimed')::BOOLEAN IS DISTINCT FROM FALSE
       OR v_second_claim ->> 'generation_claim_id' IS NOT NULL THEN
        RAISE EXCEPTION 'Pending report must not grant a second worker claim';
    END IF;

    IF public.fail_coa_report_generation(
        v_report_id,
        gen_random_uuid(),
        'Wrong claim',
        FALSE
    ) THEN
        RAISE EXCEPTION 'Wrong generation claim must not mutate the report';
    END IF;

    BEGIN
        PERFORM public.complete_coa_report_generation(
            v_report_id,
            v_claim_id,
            'claim-test/missing-signature.html',
            encode(digest('missing-signature', 'sha256'), 'hex'),
            NULL
        );
    EXCEPTION
        WHEN invalid_parameter_value THEN
            v_missing_signature_denied := TRUE;
    END;

    IF NOT v_missing_signature_denied THEN
        RAISE EXCEPTION
            'Completion must reject a missing approver signature';
    END IF;

    BEGIN
        PERFORM public.complete_coa_report_generation(
            v_report_id,
            v_claim_id,
            'claim-test/unrelated-signature.html',
            encode(digest('unrelated-signature', 'sha256'), 'hex'),
            v_other_manager_signature_id
        );
    EXCEPTION
        WHEN invalid_parameter_value THEN
            v_unrelated_signature_denied := TRUE;
    END;

    IF NOT v_unrelated_signature_denied THEN
        RAISE EXCEPTION
            'Completion must reject an active signature owned by another user';
    END IF;

    EXECUTE 'RESET ROLE';

    UPDATE public.user_signatures
    SET is_active = FALSE
    WHERE id = v_signature_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        PERFORM public.complete_coa_report_generation(
            v_report_id,
            v_claim_id,
            'claim-test/inactive-signature.html',
            encode(digest('inactive-signature', 'sha256'), 'hex'),
            v_signature_id
        );
    EXCEPTION
        WHEN invalid_parameter_value THEN
            v_inactive_signature_denied := TRUE;
    END;

    IF NOT v_inactive_signature_denied THEN
        RAISE EXCEPTION
            'Completion must reject an inactive approver signature';
    END IF;

    EXECUTE 'RESET ROLE';

    UPDATE public.user_signatures
    SET is_active = TRUE,
        deleted_at = NOW()
    WHERE id = v_signature_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        PERFORM public.complete_coa_report_generation(
            v_report_id,
            v_claim_id,
            'claim-test/deleted-signature.html',
            encode(digest('deleted-signature', 'sha256'), 'hex'),
            v_signature_id
        );
    EXCEPTION
        WHEN invalid_parameter_value THEN
            v_deleted_signature_denied := TRUE;
    END;

    IF NOT v_deleted_signature_denied THEN
        RAISE EXCEPTION
            'Completion must reject a deleted approver signature';
    END IF;

    EXECUTE 'RESET ROLE';

    UPDATE public.user_signatures
    SET deleted_at = NULL
    WHERE id = v_signature_id;

    UPDATE public.coa_reports
    SET generation_claimed_at = NOW() - INTERVAL '16 minutes'
    WHERE id = v_report_id;

    EXECUTE 'SET LOCAL ROLE authenticated';

    IF public.complete_coa_report_generation(
        v_report_id,
        v_claim_id,
        'claim-test/expired.html',
        encode(digest('expired', 'sha256'), 'hex'),
        v_signature_id
    ) IS NOT NULL THEN
        RAISE EXCEPTION 'Expired claim must not complete a CoA report';
    END IF;

    IF public.fail_coa_report_generation(
        v_report_id,
        v_claim_id,
        'Expired claim',
        FALSE
    ) THEN
        RAISE EXCEPTION 'Expired claim must not fail a CoA report';
    END IF;

    v_report := public.queue_coa_report_for_generation(v_sample_id, 920001);
    v_reclaimed_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE
       OR v_report ->> 'previous_status' IS NOT NULL
       OR v_reclaimed_claim_id IS NULL
       OR v_reclaimed_claim_id = v_claim_id THEN
        RAISE EXCEPTION 'Expired generation claims must be reclaimable';
    END IF;

    IF NOT public.fail_coa_report_generation(
        v_report_id,
        v_reclaimed_claim_id,
        'Synthetic initial generation failure',
        FALSE
    ) THEN
        RAISE EXCEPTION 'Initial generation failure must be recorded';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.coa_reports
        WHERE id = v_report_id
          AND status = 'failed'
          AND generation_claim_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Initial generation failure must clear its claim and become failed';
    END IF;

    v_report := public.queue_coa_report_for_generation(v_sample_id, 920001);
    v_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE
       OR v_report ->> 'previous_status' <> 'failed'
       OR v_claim_id IS NULL THEN
        RAISE EXCEPTION 'Failed retry must preserve failed previous status';
    END IF;

    EXECUTE 'RESET ROLE';

    UPDATE public.coa_reports
    SET generation_claimed_at = NOW() - INTERVAL '16 minutes'
    WHERE id = v_report_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    v_report := public.queue_coa_report_for_generation(v_sample_id, 920001);
    v_reclaimed_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE
       OR v_report ->> 'previous_status' <> 'failed'
       OR v_reclaimed_claim_id IS NULL
       OR v_reclaimed_claim_id = v_claim_id THEN
        RAISE EXCEPTION
            'Expired failed retry must preserve failed previous status';
    END IF;

    IF public.fail_coa_report_generation(
        v_report_id,
        v_claim_id,
        'Superseded claim',
        FALSE
    ) THEN
        RAISE EXCEPTION 'Reclaim must invalidate the previous generation token';
    END IF;

    IF public.complete_coa_report_generation(
        v_report_id,
        v_reclaimed_claim_id,
        'claim-test/ready.html',
        encode(digest('ready', 'sha256'), 'hex'),
        v_signature_id
    ) IS NULL THEN
        RAISE EXCEPTION
            'Owning worker must complete with the active approver signature';
    END IF;

    v_report := public.claim_coa_report_regeneration(v_sample_id, 920001);
    v_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE
       OR v_report ->> 'previous_status' <> 'ready'
       OR v_claim_id IS NULL THEN
        RAISE EXCEPTION
            'Manager regeneration must preserve the previous ready status';
    END IF;

    v_second_claim :=
        public.claim_coa_report_regeneration(v_sample_id, 920001);

    IF (v_second_claim ->> 'claimed')::BOOLEAN IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION
            'Active regeneration claim must not grant a second claim';
    END IF;

    EXECUTE 'RESET ROLE';

    UPDATE public.coa_reports
    SET generation_claimed_at = NOW() - INTERVAL '16 minutes'
    WHERE id = v_report_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    v_report := public.claim_coa_report_regeneration(v_sample_id, 920001);
    v_reclaimed_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE
       OR v_report ->> 'previous_status' <> 'ready'
       OR v_reclaimed_claim_id IS NULL
       OR v_reclaimed_claim_id = v_claim_id THEN
        RAISE EXCEPTION
            'Expired regeneration claims must preserve and reclaim ready state';
    END IF;

    BEGIN
        PERFORM public.fail_coa_report_generation(
            v_report_id,
            v_reclaimed_claim_id,
            'Ambiguous regeneration failure',
            NULL
        );
    EXCEPTION
        WHEN invalid_parameter_value THEN
            v_null_restore_denied := TRUE;
    END;

    IF NOT v_null_restore_denied THEN
        RAISE EXCEPTION
            'Failure transition must reject a NULL restoration decision';
    END IF;

    IF NOT public.fail_coa_report_generation(
        v_report_id,
        v_reclaimed_claim_id,
        'Synthetic regeneration failure',
        TRUE
    ) THEN
        RAISE EXCEPTION
            'Owning worker must restore a failed ready regeneration';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.coa_reports
        WHERE id = v_report_id
          AND status = 'ready'
          AND signature_id = v_signature_id
          AND generation_claim_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Failed regeneration must restore ready metadata and clear its claim';
    END IF;

    BEGIN
        UPDATE public.coa_reports
        SET sample_id = v_other_sample_id
        WHERE id = v_report_id;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_direct_update_denied := TRUE;
    END;

    IF NOT v_direct_update_denied THEN
        RAISE EXCEPTION
            'Authenticated users must not update CoA metadata directly';
    END IF;

    EXECUTE 'RESET ROLE';

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', gen_random_uuid(),
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        (current_setting('request.jwt.claims', TRUE)::JSONB ->> 'sub'),
        TRUE
    );

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        PERFORM public.queue_coa_report_for_generation(
            v_sample_id,
            920002
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_missing_profile_denied := TRUE;
    END;

    IF NOT v_missing_profile_denied THEN
        RAISE EXCEPTION
            'Authenticated JWT without an active public.users profile must be denied';
    END IF;

    EXECUTE 'RESET ROLE';

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_analyst_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        v_analyst_id::TEXT,
        TRUE
    );

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        PERFORM public.claim_coa_report_regeneration(
            v_sample_id,
            920001
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_analyst_regeneration_denied := TRUE;
    END;

    IF NOT v_analyst_regeneration_denied THEN
        RAISE EXCEPTION 'Analysts must not claim CoA regeneration';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'coa-report-generation-claims: ok' AS result;
