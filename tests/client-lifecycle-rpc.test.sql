-- Rollback-only runtime coverage for migration 216.
-- Applies manager/analyst claims, exercises lifecycle/adjudication RPCs, and
-- proves every fixture and audit mutation is removed by the final ROLLBACK.

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE FUNCTION pg_temp.assert_client_lifecycle(
    p_condition BOOLEAN,
    p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT COALESCE(p_condition, FALSE) THEN
        RAISE EXCEPTION 'client lifecycle runtime assertion failed: %',
            p_message;
    END IF;
END;
$$;

DO $contract$
BEGIN
    IF to_regprocedure(
        'public.get_client_lifecycle_manager_v1(text,text,integer,integer)'
    ) IS NULL
       OR to_regprocedure(
           'public.get_client_lifecycle_detail_manager_v1(uuid)'
       ) IS NULL
       OR to_regprocedure(
           'public.deactivate_client_v1(uuid,timestamp with time zone,text)'
       ) IS NULL
       OR to_regprocedure(
           'public.restore_client_v1(uuid,timestamp with time zone,text)'
       ) IS NULL
       OR to_regprocedure(
           'public.correct_client_identity_v1(uuid,timestamp with time zone,text,text,date,text,text,text)'
       ) IS NULL
       OR to_regprocedure(
           'public.adjudicate_client_collision_v1(uuid,uuid,timestamp with time zone,timestamp with time zone,text,text,text)'
       ) IS NULL
       OR to_regclass(
           'public.client_collision_adjudications'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 216 client lifecycle RPCs are missing';
    END IF;
END;
$contract$;

DO $runtime$
DECLARE
    v_manager_id UUID := '95110000-0000-0000-0000-000000000001';
    v_analyst_id UUID := '95110000-0000-0000-0000-000000000002';
    v_client_id UUID := '95110000-0000-0000-0000-000000000011';
    v_collision_id UUID := '95110000-0000-0000-0000-000000000012';
    v_conflict_id UUID := '95110000-0000-0000-0000-000000000013';
    v_correction_conflict_id UUID :=
        '95110000-0000-0000-0000-000000000014';
    v_raw_conflict_id UUID := '95110000-0000-0000-0000-000000000015';
    v_trusted_client_id UUID := '95110000-0000-0000-0000-000000000016';
    v_trusted_collision_id UUID :=
        '95110000-0000-0000-0000-000000000017';
    v_restricted_client_id UUID :=
        '95110000-0000-0000-0000-000000000018';
    v_restricted_candidate_id UUID :=
        '95110000-0000-0000-0000-000000000019';
    v_restricted_sample_id UUID :=
        '95110000-0000-0000-0000-000000000020';
    v_confidential_assay_id UUID;
    v_restricted_sample_type_id UUID;
    v_restricted_sample_type_name TEXT;
    v_restricted_result_id UUID :=
        '95110000-0000-0000-0000-000000000022';
    v_client_updated_at TIMESTAMPTZ;
    v_collision_updated_at TIMESTAMPTZ;
    v_conflict_updated_at TIMESTAMPTZ;
    v_raw_conflict_updated_at TIMESTAMPTZ;
    v_trusted_client_updated_at TIMESTAMPTZ;
    v_trusted_collision_updated_at TIMESTAMPTZ;
    v_after_deactivate TIMESTAMPTZ;
    v_after_restore TIMESTAMPTZ;
    v_result JSONB;
    v_manager_data JSONB;
    v_detail JSONB;
    v_collision_evidence_level TEXT;
    v_linked_client_id UUID;
    v_linked_updated_at TIMESTAMPTZ;
    v_linked_after_deactivate TIMESTAMPTZ;
    v_sample_links_before UUID[];
    v_sample_links_after UUID[];
    v_analyst_denied BOOLEAN := FALSE;
    v_analyst_detail_denied BOOLEAN := FALSE;
    v_analyst_mutation_denied BOOLEAN := FALSE;
    v_reason_denied BOOLEAN := FALSE;
    v_null_collision_type_denied BOOLEAN := FALSE;
    v_null_disposition_denied BOOLEAN := FALSE;
    v_trusted_distinct_denied BOOLEAN := FALSE;
    v_stale_denied BOOLEAN := FALSE;
    v_raw_identity_conflict_denied BOOLEAN := FALSE;
    v_restore_conflict_denied BOOLEAN := FALSE;
    v_inactive_history_conflict_denied BOOLEAN := FALSE;
    v_correction_conflict_denied BOOLEAN := FALSE;
    v_audit_failure_denied BOOLEAN := FALSE;
    v_adjudication_denied BOOLEAN := FALSE;
    v_adjudication_immutable BOOLEAN := FALSE;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_manager_id, 'issue111-phase2-manager@lims.local'),
        (v_analyst_id, 'issue111-phase2-analyst@lims.local')
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
    VALUES
        (
            v_manager_id,
            'issue111_phase2_manager',
            'Issue 111 Phase 2 Manager',
            'manager',
            'issue111-phase2-manager@lims.local',
            TRUE,
            NULL
        ),
        (
            v_analyst_id,
            'issue111_phase2_analyst',
            'Issue 111 Phase 2 Analyst',
            'analyst',
            'issue111-phase2-analyst@lims.local',
            FALSE,
            NULL
        )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address,
        created_at,
        updated_at
    )
    VALUES
        (
            v_client_id,
            '951100001001',
            'Issue 111 Phase Two Client A',
            DATE '1980-01-11',
            'Nam',
            '0951101001',
            'Rollback fixture',
            clock_timestamp() - INTERVAL '2 hours',
            clock_timestamp() - INTERVAL '2 hours'
        ),
        (
            v_collision_id,
            'LEGACY-ISSUE111-COLLISION',
            'Issue 111 Phase Two Client B',
            DATE '1981-01-11',
            'Nữ',
            '0951101002',
            'Rollback fixture',
            clock_timestamp() - INTERVAL '2 hours',
            clock_timestamp() - INTERVAL '2 hours'
        )
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.clients
    SET id_card_num = 'LEGACY-ISSUE111-COLLISION'
    WHERE id = v_client_id;

    SELECT
        max(updated_at) FILTER (WHERE id = v_client_id),
        max(updated_at) FILTER (WHERE id = v_collision_id)
    INTO v_client_updated_at, v_collision_updated_at
    FROM public.clients
    WHERE id IN (v_client_id, v_collision_id);

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_analyst_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, TRUE);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);

    BEGIN
        PERFORM public.get_client_lifecycle_manager_v1(
            'all',
            NULL,
            25,
            0
        );
    EXCEPTION
        WHEN SQLSTATE 'P1110' THEN
            v_analyst_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_analyst_denied,
        'analyst must be denied lifecycle manager data'
    );

    BEGIN
        PERFORM public.get_client_lifecycle_detail_manager_v1(v_client_id);
    EXCEPTION
        WHEN SQLSTATE 'P1110' THEN
            v_analyst_detail_denied := TRUE;
    END;

    BEGIN
        PERFORM public.deactivate_client_v1(
            v_client_id,
            v_client_updated_at,
            'Analyst không được thay đổi vòng đời'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1110' THEN
            v_analyst_mutation_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_analyst_detail_denied AND v_analyst_mutation_denied,
        'analyst must be denied lifecycle detail and mutations'
    );

    BEGIN
        PERFORM public.adjudicate_client_collision_v1(
            v_client_id,
            v_collision_id,
            v_client_updated_at,
            v_collision_updated_at,
            'government_identity',
            'confirmed_distinct',
            'Hai hồ sơ thuộc hai khách hàng khác nhau'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1110' THEN
            v_adjudication_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_adjudication_denied,
        'analyst must be denied collision adjudication'
    );

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_manager_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_manager_id::TEXT, TRUE);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);

    BEGIN
        PERFORM public.adjudicate_client_collision_v1(
            v_client_id,
            v_collision_id,
            v_client_updated_at,
            v_collision_updated_at,
            NULL,
            'correction_required',
            'Thiếu loại xung đột phải bị từ chối'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1111' THEN
            v_null_collision_type_denied := TRUE;
    END;

    BEGIN
        PERFORM public.adjudicate_client_collision_v1(
            v_client_id,
            v_collision_id,
            v_client_updated_at,
            v_collision_updated_at,
            'government_identity',
            NULL,
            'Thiếu kết luận xử lý phải bị từ chối'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1111' THEN
            v_null_disposition_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_null_collision_type_denied AND v_null_disposition_denied,
        'adjudication must reject null collision type and disposition'
    );

    v_manager_data := public.get_client_lifecycle_manager_v1(
        'all',
        'Issue 111 Phase Two Client A',
        25,
        0
    );

    PERFORM pg_temp.assert_client_lifecycle(
        v_manager_data #>> '{clients,0,id}' = v_client_id::TEXT
            AND v_manager_data #>> '{clients,0,maskedIdentity}'
                = '*********************SION'
            AND v_manager_data #>> '{clients,0,maskedPhone}'
                = '******1001'
            AND (v_manager_data #> '{clients,0,collisionReasons}')
                ? 'government_identity'
            AND v_manager_data #>>
                '{clients,0,collisionCandidates,0,id}'
                = v_collision_id::TEXT
            AND v_manager_data #>>
                '{clients,0,collisionCandidates,0,evidenceLevel}'
                = 'legacy_identity'
            AND v_manager_data #>>
                '{clients,0,collisionCandidates,0,maskedIdentity}'
                = '*********************SION',
        'manager list must mask PII and expose collision category only'
    );

    v_detail := public.get_client_lifecycle_detail_manager_v1(v_client_id);
    PERFORM pg_temp.assert_client_lifecycle(
        v_detail ->> 'idCardNum' = 'LEGACY-ISSUE111-COLLISION'
            AND v_detail ->> 'phone' = '0951101001',
        'manager detail must expose the selected full identity only'
    );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address
    )
    VALUES
        (
            v_trusted_client_id,
            '951100001050',
            'Issue 111 Phase Two Trusted A',
            DATE '1985-01-11',
            'Nam',
            '0951101050',
            'Rollback fixture'
        ),
        (
            v_trusted_collision_id,
            '951100001050',
            'Issue 111 Phase Two Trusted B',
            DATE '1986-01-11',
            'Nữ',
            '0951101051',
            'Rollback fixture'
        );

    SELECT
        max(updated_at) FILTER (WHERE id = v_trusted_client_id),
        max(updated_at) FILTER (WHERE id = v_trusted_collision_id)
    INTO v_trusted_client_updated_at, v_trusted_collision_updated_at
    FROM public.clients
    WHERE id IN (v_trusted_client_id, v_trusted_collision_id);

    SELECT candidate.evidence_level
    INTO v_collision_evidence_level
    FROM public.get_client_collision_candidates_v1(v_trusted_client_id)
        AS candidate
    WHERE candidate.related_client_id = v_trusted_collision_id
      AND candidate.collision_type = 'government_identity';

    BEGIN
        PERFORM public.adjudicate_client_collision_v1(
            v_trusted_client_id,
            v_trusted_collision_id,
            v_trusted_client_updated_at,
            v_trusted_collision_updated_at,
            'government_identity',
            'confirmed_distinct',
            'Định danh tin cậy trùng nhau phải yêu cầu hiệu chỉnh'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1111' THEN
            v_trusted_distinct_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_collision_evidence_level = 'trusted'
            AND v_trusted_distinct_denied,
        'trusted government identity cannot be adjudicated as distinct'
    );

    v_result := public.adjudicate_client_collision_v1(
        v_client_id,
        v_collision_id,
        v_client_updated_at,
        v_collision_updated_at,
        'government_identity',
        'confirmed_distinct',
        'Hai hồ sơ thuộc hai khách hàng khác nhau'
    );

    PERFORM pg_temp.assert_client_lifecycle(
        (v_result ->> 'clientId')::UUID = v_client_id
            AND (v_result ->> 'relatedClientId')::UUID =
                v_collision_id
            AND v_result ->> 'disposition' = 'confirmed_distinct'
            AND (v_result ->> 'adjudicatedAt')::TIMESTAMPTZ
                IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM public.client_collision_adjudications
                WHERE id = (v_result ->> 'id')::UUID
                  AND client_id = LEAST(v_client_id, v_collision_id)
                  AND related_client_id =
                      GREATEST(v_client_id, v_collision_id)
                  AND collision_type = 'government_identity'
                  AND disposition = 'confirmed_distinct'
                   AND adjudicated_by = v_manager_id
                   AND evidence #>> '{client,maskedIdentity}'
                       = '*********************SION'
                  AND evidence::TEXT NOT LIKE '%0951101001%'
            )
            AND EXISTS (
                SELECT 1
                FROM public.audit_logs
                WHERE table_name =
                    'client_collision_adjudications'
                  AND record_id = (v_result ->> 'id')::UUID
                  AND operation = 'CLIENT_COLLISION_ADJUDICATED'
                  AND new_values ->> 'reason' =
                      'Hai hồ sơ thuộc hai khách hàng khác nhau'
                  AND changed_by = v_manager_id
            )
            AND (
                SELECT count(*)
                FROM public.clients
                WHERE id IN (v_client_id, v_collision_id)
            ) = 2,
        'adjudication must preserve UUIDs and persist masked immutable evidence'
    );

    v_manager_data := public.get_client_lifecycle_manager_v1(
        'collision',
        'Issue 111 Phase Two Client A',
        25,
        0
    );
    PERFORM pg_temp.assert_client_lifecycle(
        jsonb_array_length(v_manager_data -> 'clients') = 0,
        'confirmed distinct evidence must clear only the unchanged collision'
    );

    BEGIN
        UPDATE public.client_collision_adjudications
        SET reason = 'Không được sửa quyết định đã ghi nhận'
        WHERE id = (v_result ->> 'id')::UUID;
    EXCEPTION
        WHEN SQLSTATE '55000' THEN
            v_adjudication_immutable := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_adjudication_immutable,
        'adjudication records must be immutable'
    );

    BEGIN
        PERFORM public.deactivate_client_v1(
            v_client_id,
            v_client_updated_at,
            'ngắn'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1111' THEN
            v_reason_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_reason_denied,
        'deactivation must require a meaningful reason'
    );

    v_result := public.deactivate_client_v1(
        v_client_id,
        v_client_updated_at,
        'Ngừng hoạt động theo hồ sơ thử nghiệm'
    );
    v_after_deactivate := (v_result ->> 'updatedAt')::TIMESTAMPTZ;

    PERFORM pg_temp.assert_client_lifecycle(
        (v_result ->> 'id')::UUID = v_client_id
            AND v_result ->> 'status' = 'inactive'
            AND EXISTS (
                SELECT 1
                FROM public.clients
                WHERE id = v_client_id
                  AND deleted_at IS NOT NULL
                  AND deleted_by = v_manager_id
                  AND deletion_reason =
                      'Ngừng hoạt động theo hồ sơ thử nghiệm'
            )
            AND EXISTS (
                SELECT 1
                FROM public.audit_logs
                WHERE table_name = 'clients'
                  AND record_id = v_client_id
                  AND operation = 'CLIENT_DEACTIVATED'
                  AND new_values ->> 'reason' =
                      'Ngừng hoạt động theo hồ sơ thử nghiệm'
                  AND changed_by = v_manager_id
            ),
        'deactivation must retain UUID and persist actor, reason, and audit'
    );

    BEGIN
        PERFORM public.restore_client_v1(
            v_client_id,
            v_after_deactivate - INTERVAL '1 microsecond',
            'Khôi phục bằng phiên bản cũ'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1113' THEN
            v_stale_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_stale_denied,
        'stale restore request must fail closed'
    );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address
    )
    VALUES (
        v_raw_conflict_id,
        'LEGACY-ISSUE111-COLLISION',
        'Issue 111 Phase Two Raw Conflict',
        DATE '1982-01-10',
        'Khác',
        '0951101098',
        'Rollback fixture'
    );

    SELECT updated_at
    INTO v_raw_conflict_updated_at
    FROM public.clients
    WHERE id = v_raw_conflict_id;

    BEGIN
        PERFORM public.restore_client_v1(
            v_client_id,
            v_after_deactivate,
            'Khôi phục khi định danh cũ còn xung đột'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1114' THEN
            v_raw_identity_conflict_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_raw_identity_conflict_denied,
        'restore must fail on an unadjudicated raw legacy identity conflict'
    );

    PERFORM public.adjudicate_client_collision_v1(
        v_client_id,
        v_raw_conflict_id,
        v_after_deactivate,
        v_raw_conflict_updated_at,
        'government_identity',
        'confirmed_distinct',
        'Hai định danh cũ trùng nhau nhưng thuộc hai khách hàng khác nhau'
    );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address
    )
    VALUES (
        v_conflict_id,
        '951100001003',
        'Issue 111 Phase Two Conflict',
        DATE '1982-01-11',
        'Khác',
        '+84951101001',
        'Rollback fixture'
    );

    BEGIN
        PERFORM public.restore_client_v1(
            v_client_id,
            v_after_deactivate,
            'Khôi phục khi còn xung đột'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1114' THEN
            v_restore_conflict_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_restore_conflict_denied,
        'restore must fail on an active phone conflict'
    );

    UPDATE public.clients
    SET deleted_at = clock_timestamp(),
        deleted_by = v_manager_id,
        deletion_reason = 'Giữ bản ghi lịch sử để kiểm tra xung đột'
    WHERE id = v_conflict_id;

    BEGIN
        PERFORM public.restore_client_v1(
            v_client_id,
            v_after_deactivate,
            'Khôi phục khi xung đột lịch sử còn tồn tại'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1114' THEN
            v_inactive_history_conflict_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_inactive_history_conflict_denied,
        'restore must fail on an inactive historical phone conflict'
    );

    SELECT updated_at
    INTO v_conflict_updated_at
    FROM public.clients
    WHERE id = v_conflict_id;

    PERFORM public.adjudicate_client_collision_v1(
        v_client_id,
        v_conflict_id,
        v_after_deactivate,
        v_conflict_updated_at,
        'phone',
        'confirmed_distinct',
        'Hai hồ sơ dùng số điện thoại chung nhưng là hai người khác nhau'
    );

    v_result := public.restore_client_v1(
        v_client_id,
        v_after_deactivate,
        'Khôi phục sau khi xác nhận hai hồ sơ riêng biệt'
    );
    v_after_restore := (v_result ->> 'updatedAt')::TIMESTAMPTZ;

    PERFORM pg_temp.assert_client_lifecycle(
        (v_result ->> 'id')::UUID = v_client_id
            AND v_result ->> 'status' = 'active'
            AND EXISTS (
                SELECT 1
                FROM public.clients
                WHERE id = v_client_id
                  AND deleted_at IS NULL
                  AND deleted_by IS NULL
                  AND deletion_reason IS NULL
            )
            AND EXISTS (
                SELECT 1
                FROM public.audit_logs
                WHERE table_name = 'clients'
                  AND record_id = v_client_id
                  AND operation = 'CLIENT_RESTORED'
                  AND new_values ->> 'reason' =
                      'Khôi phục sau khi xác nhận hai hồ sơ riêng biệt'
            ),
        'restore must reactivate the same UUID and audit its reason'
    );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address
    )
    VALUES (
        v_correction_conflict_id,
        '951100001099',
        'Issue 111 Phase Two Identity Owner',
        DATE '1982-02-11',
        'Khác',
        '0951101099',
        'Rollback fixture'
    );

    BEGIN
        PERFORM public.correct_client_identity_v1(
            v_client_id,
            v_after_restore,
            '951100001099',
            'Issue 111 Phase Two Client Corrected',
            DATE '1980-01-12',
            'Nam',
            '0951101012',
            'Hiệu chỉnh sang định danh đang được giữ chỗ'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1114' THEN
            v_correction_conflict_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_lifecycle(
        v_correction_conflict_denied,
        'correction must reject an identity reserved by another UUID'
    );

    v_result := public.correct_client_identity_v1(
        v_client_id,
        v_after_restore,
        '951100001012',
        'Issue 111 Phase Two Client Corrected',
        DATE '1980-01-12',
        'Nam',
        '0951101012',
        'Hiệu chỉnh theo giấy tờ gốc đã xác minh'
    );

    PERFORM pg_temp.assert_client_lifecycle(
        (v_result ->> 'id')::UUID = v_client_id
            AND EXISTS (
                SELECT 1
                FROM public.clients
                WHERE id = v_client_id
                  AND id_card_num = '951100001012'
                  AND name = 'Issue 111 Phase Two Client Corrected'
                  AND phone = '0951101012'
            )
            AND EXISTS (
                SELECT 1
                FROM public.audit_logs
                WHERE table_name = 'clients'
                  AND record_id = v_client_id
                  AND operation = 'CLIENT_IDENTITY_CORRECTED'
                  AND new_values ->> 'reason' =
                      'Hiệu chỉnh theo giấy tờ gốc đã xác minh'
                  AND NOT new_values ? 'id_card_num'
                  AND NOT new_values ? 'phone'
            ),
        'correction must keep UUID and write PII-minimized audit metadata'
    );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address
    )
    VALUES
        (
            v_restricted_client_id,
            '951100001060',
            'Issue 111 Phase Two Restricted Visible',
            DATE '1987-01-11',
            'Nam',
            '+84951101060',
            'Rollback fixture'
        ),
        (
            v_restricted_candidate_id,
            '951100001061',
            'Issue 111 Phase Two Restricted Hidden',
            DATE '1988-01-11',
            'Nữ',
            '0951101060',
            'Rollback fixture'
        );

    SELECT
        compatibility.assay_definition_id,
        compatibility.sample_type_id,
        sample_type.name
    INTO
        v_confidential_assay_id,
        v_restricted_sample_type_id,
        v_restricted_sample_type_name
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_sample_type_catalog_revisions AS revision
      ON revision.id = compatibility.revision_id
     AND revision.status = 'published'
    JOIN public.assay_sample_type_reviews AS review
      ON review.revision_id = compatibility.revision_id
     AND review.assay_definition_id = compatibility.assay_definition_id
     AND review.disposition = 'configured'
    JOIN public.assay_definitions AS assay_definition
      ON assay_definition.id = compatibility.assay_definition_id
     AND assay_definition.deleted_at IS NULL
     AND NOT assay_definition.is_confidential
    JOIN public.sample_types AS sample_type
      ON sample_type.id = compatibility.sample_type_id
     AND sample_type.deleted_at IS NULL
    WHERE compatibility.removed_at IS NULL
      AND compatibility.assay_compatibility_generation =
          assay_definition.compatibility_generation
      AND compatibility.sample_type_compatibility_generation =
          sample_type.compatibility_generation
    ORDER BY compatibility.created_at
    LIMIT 1;

    PERFORM pg_temp.assert_client_lifecycle(
        v_confidential_assay_id IS NOT NULL
            AND v_restricted_sample_type_id IS NOT NULL,
        'restricted evidence fixture requires one current configured pair'
    );

    INSERT INTO public.samples (
        id,
        sample_id,
        client_id,
        client_name,
        status,
        received_by,
        sample_type_id,
        type,
        sample_quality
    )
    VALUES (
        v_restricted_sample_id,
        'ISSUE111-P2-RESTRICTED',
        v_restricted_candidate_id,
        'Issue 111 Phase Two Restricted Hidden',
        'review',
        v_analyst_id,
        v_restricted_sample_type_id,
        v_restricted_sample_type_name,
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
    VALUES (
        v_restricted_result_id,
        v_restricted_sample_id,
        v_confidential_assay_id,
        '1',
        'pending',
        v_analyst_id,
        clock_timestamp()
    );

    UPDATE public.assay_definitions
    SET is_confidential = TRUE
    WHERE id = v_confidential_assay_id;

    UPDATE public.users
    SET can_access_confidential = FALSE
    WHERE id = v_manager_id;

    v_manager_data := public.get_client_lifecycle_manager_v1(
        'all',
        'Issue 111 Phase Two Restricted Visible',
        25,
        0
    );

    PERFORM pg_temp.assert_client_lifecycle(
        v_manager_data #>> '{clients,0,id}' = v_restricted_client_id::TEXT
            AND jsonb_array_length(
                v_manager_data #> '{clients,0,collisionReasons}'
            ) = 1
            AND (v_manager_data #> '{clients,0,collisionReasons}')
                ? 'restricted'
            AND NOT (
                (v_manager_data #> '{clients,0,collisionReasons}')
                ? 'phone'
            )
            AND jsonb_array_length(
                v_manager_data #> '{clients,0,collisionCandidates}'
            ) = 0,
        'restricted collision evidence must not disclose the matching attribute'
    );

    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = v_manager_id;

    CREATE FUNCTION pg_temp.fail_client_lifecycle_audit()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $audit_failure$
    BEGIN
        IF NEW.operation = 'CLIENT_DEACTIVATED' THEN
            RAISE EXCEPTION 'forced lifecycle audit failure';
        END IF;
        RETURN NEW;
    END;
    $audit_failure$;

    CREATE TRIGGER force_client_lifecycle_audit_failure
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION pg_temp.fail_client_lifecycle_audit();

    SELECT updated_at
    INTO v_client_updated_at
    FROM public.clients
    WHERE id = v_client_id;

    BEGIN
        PERFORM public.deactivate_client_v1(
            v_client_id,
            v_client_updated_at,
            'Buộc lỗi audit để kiểm tra rollback'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1116' THEN
            v_audit_failure_denied := TRUE;
    END;

    DROP TRIGGER force_client_lifecycle_audit_failure
    ON public.audit_logs;
    DROP FUNCTION pg_temp.fail_client_lifecycle_audit();

    PERFORM pg_temp.assert_client_lifecycle(
        v_audit_failure_denied
            AND EXISTS (
                SELECT 1
                FROM public.clients
                WHERE id = v_client_id
                  AND deleted_at IS NULL
            )
            AND NOT EXISTS (
                SELECT 1
                FROM public.audit_logs
                WHERE table_name = 'clients'
                  AND record_id = v_client_id
                  AND operation = 'CLIENT_DEACTIVATED'
                  AND new_values ->> 'reason' =
                      'Buộc lỗi audit để kiểm tra rollback'
            ),
        'audit failure must roll back the lifecycle mutation atomically'
    );

    SELECT client.id, client.updated_at
    INTO v_linked_client_id, v_linked_updated_at
    FROM public.clients AS client
    WHERE client.deleted_at IS NULL
      AND EXISTS (
          SELECT 1
          FROM public.samples
          WHERE samples.client_id = client.id
      )
      AND client.id NOT IN (
          v_client_id,
          v_collision_id,
          v_conflict_id,
          v_correction_conflict_id,
          v_raw_conflict_id,
          v_trusted_client_id,
          v_trusted_collision_id,
          v_restricted_client_id,
          v_restricted_candidate_id
      )
    ORDER BY client.id
    LIMIT 1;

    SELECT array_agg(id ORDER BY id)
    INTO v_sample_links_before
    FROM public.samples
    WHERE client_id = v_linked_client_id;

    v_result := public.deactivate_client_v1(
        v_linked_client_id,
        v_linked_updated_at,
        'Kiểm tra giữ nguyên liên kết lịch sử'
    );
    v_linked_after_deactivate :=
        (v_result ->> 'updatedAt')::TIMESTAMPTZ;

    PERFORM public.restore_client_v1(
        v_linked_client_id,
        v_linked_after_deactivate,
        'Khôi phục sau kiểm tra liên kết lịch sử'
    );

    SELECT array_agg(id ORDER BY id)
    INTO v_sample_links_after
    FROM public.samples
    WHERE client_id = v_linked_client_id;

    PERFORM pg_temp.assert_client_lifecycle(
        v_linked_client_id IS NOT NULL
            AND v_sample_links_before IS NOT NULL
            AND v_sample_links_before = v_sample_links_after,
        'deactivate/restore must never rewrite historical sample links'
    );
END;
$runtime$;

SELECT 'client lifecycle RPC rollback tests passed' AS result;

ROLLBACK;
