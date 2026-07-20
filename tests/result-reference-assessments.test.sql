-- RESULT REFERENCE ASSESSMENTS DATABASE REGRESSION SUITE
-- Verifies the assessment-aware submission RPC and immutable assessment snapshots.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/result-reference-assessments.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_analyst_id UUID := 'a1000000-0000-0000-0000-000000000001'::UUID;
    v_client_id UUID := 'a1000000-0000-0000-0000-000000000002'::UUID;
    v_assay_one_id UUID := 'a1000000-0000-0000-0000-000000000003'::UUID;
    v_assay_two_id UUID := 'a1000000-0000-0000-0000-000000000004'::UUID;
    v_sample_success_id UUID := 'a1000000-0000-0000-0000-000000000005'::UUID;
    v_sample_invalid_id UUID := 'a1000000-0000-0000-0000-000000000006'::UUID;
    v_sample_stale_id UUID := 'a1000000-0000-0000-0000-000000000007'::UUID;
    v_sample_foreign_id UUID := 'a1000000-0000-0000-0000-000000000008'::UUID;
    v_success_result_one_id UUID := 'a1000000-0000-0000-0000-000000000009'::UUID;
    v_success_result_two_id UUID := 'a1000000-0000-0000-0000-000000000010'::UUID;
    v_invalid_result_one_id UUID := 'a1000000-0000-0000-0000-000000000011'::UUID;
    v_invalid_result_two_id UUID := 'a1000000-0000-0000-0000-000000000012'::UUID;
    v_stale_result_id UUID := 'a1000000-0000-0000-0000-000000000013'::UUID;
    v_foreign_result_id UUID := 'a1000000-0000-0000-0000-000000000014'::UUID;
    v_response JSONB;
    v_first_submission_id UUID;
    v_second_submission_id UUID;
    v_snapshot_id UUID;
    v_result_one_revision TIMESTAMPTZ;
    v_result_two_revision TIMESTAMPTZ;
    v_invalid_result_one_revision TIMESTAMPTZ;
    v_invalid_result_two_revision TIMESTAMPTZ;
    v_stale_result_revision TIMESTAMPTZ;
    v_foreign_result_revision TIMESTAMPTZ;
    v_assay_one_revision TIMESTAMPTZ;
    v_assay_two_revision TIMESTAMPTZ;
    v_snapshot_count INTEGER;
    v_submission_count INTEGER;
    v_rows_changed INTEGER;
    v_insert_denied BOOLEAN := FALSE;
    v_update_denied BOOLEAN := FALSE;
    v_delete_denied BOOLEAN := FALSE;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES (v_analyst_id, 'result-assessment-analyst@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id,
        username,
        full_name,
        role,
        email,
        can_access_confidential,
        deleted_at
    )
    VALUES (
        v_analyst_id,
        'result_assessment_analyst',
        'Result Assessment Analyst',
        'analyst',
        'result-assessment-analyst@lims.local',
        FALSE,
        NULL
    )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        email = EXCLUDED.email,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

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
        'a1000000-0000-0000-0000-000000000015'::UUID,
        v_analyst_id,
        'signatures/result-assessment-analyst.png',
        'result-assessment-signature-hash',
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
        v_client_id,
        'result-assessment-client',
        'Result Assessment Client',
        DATE '1990-01-01',
        'Nam',
        '0900000000'
    );

    INSERT INTO public.assay_definitions (
        id,
        name,
        units,
        method_name,
        normal_range
    )
    VALUES
        (
            v_assay_one_id,
            'Result Assessment Assay One',
            'mg/dL',
            'Method One',
            '10-20'
        ),
        (
            v_assay_two_id,
            'Result Assessment Assay Two',
            'mmol/L',
            'Method Two',
            '3-7'
        );

    INSERT INTO public.samples (
        id,
        sample_id,
        client_id,
        client_name,
        status,
        received_by,
        type,
        sample_quality
    )
    VALUES
        (
            v_sample_success_id,
            'RESULT-ASSESSMENT-SUCCESS',
            v_client_id,
            'Result Assessment Client',
            'in_progress',
            v_analyst_id,
            'Nước',
            TRUE
        ),
        (
            v_sample_invalid_id,
            'RESULT-ASSESSMENT-INVALID',
            v_client_id,
            'Result Assessment Client',
            'in_progress',
            v_analyst_id,
            'Nước',
            TRUE
        ),
        (
            v_sample_stale_id,
            'RESULT-ASSESSMENT-STALE',
            v_client_id,
            'Result Assessment Client',
            'in_progress',
            v_analyst_id,
            'Nước',
            TRUE
        ),
        (
            v_sample_foreign_id,
            'RESULT-ASSESSMENT-FOREIGN',
            v_client_id,
            'Result Assessment Client',
            'in_progress',
            v_analyst_id,
            'Nước',
            TRUE
        );

    INSERT INTO public.results (
        id,
        sample_id,
        assay_id,
        value,
        status,
        entered_by,
        entered_at
    )
    VALUES
        (
            v_success_result_one_id,
            v_sample_success_id,
            v_assay_one_id,
            '11.5',
            'entered',
            v_analyst_id,
            NOW()
        ),
        (
            v_success_result_two_id,
            v_sample_success_id,
            v_assay_two_id,
            '4.2',
            'entered',
            v_analyst_id,
            NOW()
        ),
        (
            v_invalid_result_one_id,
            v_sample_invalid_id,
            v_assay_one_id,
            '12.5',
            'entered',
            v_analyst_id,
            NOW()
        ),
        (
            v_invalid_result_two_id,
            v_sample_invalid_id,
            v_assay_two_id,
            '5.2',
            'entered',
            v_analyst_id,
            NOW()
        ),
        (
            v_stale_result_id,
            v_sample_stale_id,
            v_assay_one_id,
            '13.5',
            'entered',
            v_analyst_id,
            NOW()
        ),
        (
            v_foreign_result_id,
            v_sample_foreign_id,
            v_assay_two_id,
            '6.2',
            'entered',
            v_analyst_id,
            NOW()
        );

    SELECT updated_at
    INTO v_result_one_revision
    FROM public.results
    WHERE id = v_success_result_one_id;

    SELECT updated_at
    INTO v_result_two_revision
    FROM public.results
    WHERE id = v_success_result_two_id;

    SELECT updated_at
    INTO v_invalid_result_one_revision
    FROM public.results
    WHERE id = v_invalid_result_one_id;

    SELECT updated_at
    INTO v_invalid_result_two_revision
    FROM public.results
    WHERE id = v_invalid_result_two_id;

    SELECT updated_at
    INTO v_stale_result_revision
    FROM public.results
    WHERE id = v_stale_result_id;

    SELECT updated_at
    INTO v_foreign_result_revision
    FROM public.results
    WHERE id = v_foreign_result_id;

    SELECT updated_at
    INTO v_assay_one_revision
    FROM public.assay_definitions
    WHERE id = v_assay_one_id;

    SELECT updated_at
    INTO v_assay_two_revision
    FROM public.assay_definitions
    WHERE id = v_assay_two_id;

    SET LOCAL ROLE authenticated;
    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        TRUE
    );

    v_response := public.submit_sample_for_review_with_assessments(
        v_sample_success_id,
        jsonb_build_array(
            jsonb_build_object(
                'result_id', v_success_result_one_id,
                'assessment', 'within_reference_range',
                'result_updated_at', v_result_one_revision,
                'assay_updated_at', v_assay_one_revision,
                'assay_name', 'tampered',
                'result_value', 'tampered'
            ),
            jsonb_build_object(
                'result_id', v_success_result_two_id,
                'assessment', 'outside_reference_range',
                'result_updated_at', v_result_two_revision,
                'assay_updated_at', v_assay_two_revision,
                'unit', 'tampered',
                'reference_range', 'tampered'
            )
        )
    );

    RESET ROLE;

    v_first_submission_id := (v_response ->> 'submission_id')::UUID;

    IF v_response ->> 'new_status' <> 'review' OR v_first_submission_id IS NULL THEN
        RAISE EXCEPTION 'assessment-aware submission did not return the signed review submission';
    END IF;

    SELECT COUNT(*)
    INTO v_snapshot_count
    FROM public.result_reference_assessments
    WHERE submission_id = v_first_submission_id;

    IF v_snapshot_count <> 2 THEN
        RAISE EXCEPTION 'expected two immutable snapshots, got %', v_snapshot_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.result_reference_assessments
        WHERE submission_id = v_first_submission_id
          AND result_id = v_success_result_one_id
          AND assessment = 'within_reference_range'
          AND assay_name = 'Result Assessment Assay One'
          AND result_value = '11.5'
          AND unit = 'mg/dL'
          AND method_name = 'Method One'
          AND reference_range = '10-20'
          AND analyst_id = v_analyst_id
    ) THEN
        RAISE EXCEPTION 'first snapshot did not use locked server-side result and assay values';
    END IF;

    SELECT id
    INTO v_snapshot_id
    FROM public.result_reference_assessments
    WHERE submission_id = v_first_submission_id
      AND result_id = v_success_result_one_id;

    IF NOT EXISTS (
        SELECT 1
        FROM public.audit_logs
        WHERE table_name = 'result_reference_assessments'
          AND record_id = v_snapshot_id
          AND operation = 'INSERT'
    ) THEN
        RAISE EXCEPTION 'assessment snapshot insert was not audited';
    END IF;

    SET LOCAL ROLE authenticated;

    BEGIN
        INSERT INTO public.result_reference_assessments (
            submission_id,
            result_id,
            assessment,
            assay_name,
            result_value,
            analyst_id
        )
        VALUES (
            v_first_submission_id,
            v_success_result_one_id,
            'within_reference_range',
            'tampered',
            'tampered',
            v_analyst_id
        );
        RAISE EXCEPTION 'direct snapshot insert unexpectedly succeeded';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_insert_denied := TRUE;
    END;

    BEGIN
        UPDATE public.result_reference_assessments
        SET assessment = 'outside_reference_range'
        WHERE id = v_snapshot_id;
        GET DIAGNOSTICS v_rows_changed = ROW_COUNT;

        IF v_rows_changed <> 0 THEN
            RAISE EXCEPTION 'direct snapshot update unexpectedly changed % row(s)', v_rows_changed;
        END IF;

        v_update_denied := TRUE;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_update_denied := TRUE;
    END;

    BEGIN
        DELETE FROM public.result_reference_assessments
        WHERE id = v_snapshot_id;
        GET DIAGNOSTICS v_rows_changed = ROW_COUNT;

        IF v_rows_changed <> 0 THEN
            RAISE EXCEPTION 'direct snapshot delete unexpectedly changed % row(s)', v_rows_changed;
        END IF;

        v_delete_denied := TRUE;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_delete_denied := TRUE;
    END;

    RESET ROLE;

    IF NOT v_insert_denied OR NOT v_update_denied OR NOT v_delete_denied THEN
        RAISE EXCEPTION 'one or more direct assessment snapshot writes were not denied';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.result_reference_assessments
        WHERE id = v_snapshot_id
          AND assessment = 'within_reference_range'
    ) THEN
        RAISE EXCEPTION 'direct write altered the immutable assessment snapshot';
    END IF;

    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        TRUE
    );
    SET LOCAL ROLE authenticated;

    BEGIN
        PERFORM public.submit_sample_for_review_with_assessments(
            v_sample_invalid_id,
            jsonb_build_array(
                jsonb_build_object(
                    'result_id', v_invalid_result_one_id,
                    'assessment', 'within_reference_range',
                    'result_updated_at', v_invalid_result_one_revision,
                    'assay_updated_at', v_assay_one_revision
                )
            )
        );
        RAISE EXCEPTION 'incomplete assessment payload unexpectedly succeeded';
    EXCEPTION
        WHEN others THEN
            IF SQLERRM = 'incomplete assessment payload unexpectedly succeeded' THEN
                RAISE;
            END IF;
    END;

    BEGIN
        PERFORM public.submit_sample_for_review_with_assessments(
            v_sample_invalid_id,
            jsonb_build_array(
                jsonb_build_object(
                    'result_id', v_invalid_result_one_id,
                    'assessment', 'within_reference_range',
                    'result_updated_at', v_invalid_result_one_revision,
                    'assay_updated_at', v_assay_one_revision
                ),
                jsonb_build_object(
                    'result_id', v_invalid_result_one_id,
                    'assessment', 'outside_reference_range',
                    'result_updated_at', v_invalid_result_one_revision,
                    'assay_updated_at', v_assay_one_revision
                ),
                jsonb_build_object(
                    'result_id', v_invalid_result_two_id,
                    'assessment', 'within_reference_range',
                    'result_updated_at', v_invalid_result_two_revision,
                    'assay_updated_at', v_assay_two_revision
                )
            )
        );
        RAISE EXCEPTION 'duplicate assessment payload unexpectedly succeeded';
    EXCEPTION
        WHEN others THEN
            IF SQLERRM = 'duplicate assessment payload unexpectedly succeeded' THEN
                RAISE;
            END IF;
    END;

    BEGIN
        PERFORM public.submit_sample_for_review_with_assessments(
            v_sample_invalid_id,
            jsonb_build_array(
                jsonb_build_object(
                    'result_id', v_invalid_result_one_id,
                    'assessment', 'not_an_assessment',
                    'result_updated_at', v_invalid_result_one_revision,
                    'assay_updated_at', v_assay_one_revision
                ),
                jsonb_build_object(
                    'result_id', v_foreign_result_id,
                    'assessment', 'within_reference_range',
                    'result_updated_at', v_foreign_result_revision,
                    'assay_updated_at', v_assay_two_revision
                )
            )
        );
        RAISE EXCEPTION 'invalid or foreign assessment payload unexpectedly succeeded';
    EXCEPTION
        WHEN others THEN
            IF SQLERRM = 'invalid or foreign assessment payload unexpectedly succeeded' THEN
                RAISE;
            END IF;
    END;

    RESET ROLE;

    SELECT COUNT(*)
    INTO v_submission_count
    FROM public.sample_submissions
    WHERE sample_id = v_sample_invalid_id;

    IF v_submission_count <> 0
       OR EXISTS (
           SELECT 1
           FROM public.result_reference_assessments AS assessment
           JOIN public.sample_submissions AS submission
             ON submission.id = assessment.submission_id
           WHERE submission.sample_id = v_sample_invalid_id
       )
       OR (SELECT status FROM public.samples WHERE id = v_sample_invalid_id) <> 'in_progress' THEN
        RAISE EXCEPTION 'invalid assessment payload did not roll back all submission state';
    END IF;

    SET LOCAL ROLE authenticated;
    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        TRUE
    );

    BEGIN
        PERFORM public.submit_sample_for_review_with_assessments(
            v_sample_stale_id,
            jsonb_build_array(
                jsonb_build_object(
                    'result_id', v_stale_result_id,
                    'assessment', 'within_reference_range',
                    'result_updated_at', v_stale_result_revision - INTERVAL '1 microsecond',
                    'assay_updated_at', v_assay_one_revision
                )
            )
        );
        RAISE EXCEPTION 'stale assessment payload unexpectedly succeeded';
    EXCEPTION
        WHEN others THEN
            IF SQLERRM = 'stale assessment payload unexpectedly succeeded' THEN
                RAISE;
            END IF;
    END;

    RESET ROLE;

    IF EXISTS (
        SELECT 1
        FROM public.sample_submissions
        WHERE sample_id = v_sample_stale_id
    )
       OR (SELECT status FROM public.samples WHERE id = v_sample_stale_id) <> 'in_progress' THEN
        RAISE EXCEPTION 'stale assessment payload did not fail closed';
    END IF;

    UPDATE public.samples
    SET status = 'in_progress',
        rejection_reason = 'Rework required',
        rejected_at = NOW(),
        rejected_by = v_analyst_id
    WHERE id = v_sample_success_id;

    UPDATE public.results
    SET value = '11.6',
        updated_at = NOW() + INTERVAL '2 minutes'
    WHERE id = v_success_result_one_id;

    SELECT updated_at
    INTO v_result_one_revision
    FROM public.results
    WHERE id = v_success_result_one_id;

    SET LOCAL ROLE authenticated;
    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        TRUE
    );

    v_response := public.submit_sample_for_review_with_assessments(
        v_sample_success_id,
        jsonb_build_array(
            jsonb_build_object(
                'result_id', v_success_result_one_id,
                'assessment', 'outside_reference_range',
                'result_updated_at', v_result_one_revision,
                'assay_updated_at', v_assay_one_revision
            ),
            jsonb_build_object(
                'result_id', v_success_result_two_id,
                'assessment', 'outside_reference_range',
                'result_updated_at', v_result_two_revision,
                'assay_updated_at', v_assay_two_revision
            )
        )
    );

    RESET ROLE;

    v_second_submission_id := (v_response ->> 'submission_id')::UUID;

    IF v_second_submission_id IS NULL
       OR v_response ->> 'new_status' <> 'review' THEN
        RAISE EXCEPTION 'resubmission did not return the signed review submission';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.sample_submissions
        WHERE id = v_first_submission_id
          AND superseded_by = v_second_submission_id
    ) THEN
        RAISE EXCEPTION 'resubmission did not preserve the signed submission chain';
    END IF;

    IF (SELECT COUNT(*)
        FROM public.result_reference_assessments
        WHERE submission_id IN (v_first_submission_id, v_second_submission_id)) <> 4 THEN
        RAISE EXCEPTION 'resubmission did not preserve complete immutable snapshot history';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.result_reference_assessments
        WHERE submission_id = v_first_submission_id
          AND result_id = v_success_result_one_id
          AND result_value = '11.5'
          AND assessment = 'within_reference_range'
    ) THEN
        RAISE EXCEPTION 'resubmission rewrote the prior assessment snapshot';
    END IF;
END $$;

ROLLBACK;

SELECT 'result-reference-assessments: ok' AS result;
