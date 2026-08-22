-- Issue #111 Phase 3: adjudicate the two bounded legacy identifier groups.
--
-- This operational script uses the existing Phase 2 manager RPC. It fails
-- closed unless production still has exactly two untrusted duplicate groups
-- with group sizes 2 and 3 (four pairwise decisions). Output is aggregate-only.

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';
SET LOCAL max_parallel_workers_per_gather = 0;

LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.samples IN SHARE MODE;

CREATE TEMP TABLE phase3_legacy_identifier_groups
ON COMMIT DROP
AS
SELECT
    id_card_num AS legacy_identifier,
    count(*) AS group_size
FROM public.clients
WHERE public.normalize_client_government_identity_v1(id_card_num) IS NULL
  AND btrim(id_card_num) <> ''
  AND id_card_num !~* '^BACKFILL-'
GROUP BY id_card_num
HAVING count(*) > 1;

CREATE TEMP TABLE phase3_legacy_identifier_pairs
ON COMMIT DROP
AS
SELECT
    first_client.id AS first_client_id,
    second_client.id AS second_client_id,
    first_client.updated_at AS first_updated_at,
    second_client.updated_at AS second_updated_at
FROM phase3_legacy_identifier_groups AS legacy_group
JOIN public.clients AS first_client
  ON first_client.id_card_num = legacy_group.legacy_identifier
JOIN public.clients AS second_client
  ON second_client.id_card_num = legacy_group.legacy_identifier
 AND first_client.id < second_client.id;

CREATE UNIQUE INDEX phase3_legacy_identifier_pairs_id
ON phase3_legacy_identifier_pairs (
    first_client_id,
    second_client_id
);

CREATE TEMP TABLE phase3_adjudication_audit_snapshot
ON COMMIT DROP
AS
SELECT id
FROM public.audit_logs;

CREATE UNIQUE INDEX phase3_adjudication_audit_snapshot_id
ON phase3_adjudication_audit_snapshot (id);

DO $adjudicate$
DECLARE
    v_manager_id UUID;
    v_expected_group_count BIGINT;
    v_expected_pair_count BIGINT;
    v_expected_group_sizes BIGINT[];
    v_uuid_digest_before TEXT;
    v_uuid_digest_after TEXT;
    v_raw_digest_before TEXT;
    v_raw_digest_after TEXT;
    v_sample_link_digest_before TEXT;
    v_sample_link_digest_after TEXT;
    v_adjudicated_pair_count BIGINT;
    v_adjudication_audit_count BIGINT;
    v_remaining_unresolved_pairs BIGINT;
    v_evidence_level TEXT;
    v_result JSONB;
    v_pair RECORD;
BEGIN
    SELECT
        count(*),
        array_agg(group_size ORDER BY group_size)
    INTO
        v_expected_group_count,
        v_expected_group_sizes
    FROM phase3_legacy_identifier_groups;

    SELECT count(*)
    INTO v_expected_pair_count
    FROM phase3_legacy_identifier_pairs;

    IF v_expected_group_count <> 2
       OR v_expected_pair_count <> 4
       OR v_expected_group_sizes IS DISTINCT FROM ARRAY[2, 3]::BIGINT[]
    THEN
        RAISE EXCEPTION
            'Phase 3 adjudication baseline mismatch: groups %, sizes %, pairs %',
            v_expected_group_count,
            v_expected_group_sizes,
            v_expected_pair_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM phase3_legacy_identifier_groups AS legacy_group
        JOIN public.clients AS client
          ON client.id_card_num = legacy_group.legacy_identifier
        WHERE client.government_identity_trusted
           OR client.government_identity_type IS NOT NULL
           OR client.government_identity_value IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Phase 3 adjudication found trusted canonical identity evidence';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM phase3_legacy_identifier_groups AS legacy_group
        JOIN public.clients AS client
          ON client.id_card_num = legacy_group.legacy_identifier
        GROUP BY legacy_group.legacy_identifier
        HAVING count(DISTINCT (
            client.normalized_name,
            client.date_of_birth
        )) <> count(*)
    ) THEN
        RAISE EXCEPTION
            'Phase 3 adjudication found non-distinct name/date evidence';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.client_collision_adjudications AS adjudication
        JOIN phase3_legacy_identifier_pairs AS pair
          ON adjudication.client_id = pair.first_client_id
         AND adjudication.related_client_id = pair.second_client_id
        WHERE adjudication.collision_type = 'government_identity'
    ) THEN
        RAISE EXCEPTION
            'Phase 3 adjudication found an already-decided legacy pair';
    END IF;

    SELECT user_profile.id
    INTO v_manager_id
    FROM public.users AS user_profile
    JOIN auth.users AS auth_user
      ON auth_user.id = user_profile.id
    WHERE user_profile.role = 'manager'
      AND user_profile.deleted_at IS NULL
      AND user_profile.can_access_confidential
    ORDER BY user_profile.id
    LIMIT 1;

    IF v_manager_id IS NULL THEN
        RAISE EXCEPTION
            'Phase 3 adjudication requires an active confidential manager';
    END IF;

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

    SELECT md5(COALESCE(
        string_agg(client.id::TEXT, ',' ORDER BY client.id),
        ''
    ))
    INTO v_uuid_digest_before
    FROM public.clients AS client;

    SELECT md5(COALESCE(
        string_agg(to_jsonb(client)::TEXT, E'\n' ORDER BY client.id),
        ''
    ))
    INTO v_raw_digest_before
    FROM public.clients AS client;

    SELECT md5(COALESCE(
        string_agg(
            sample.id::TEXT || '|' || COALESCE(sample.client_id::TEXT, ''),
            ','
            ORDER BY sample.id
        ),
        ''
    ))
    INTO v_sample_link_digest_before
    FROM public.samples AS sample;

    FOR v_pair IN
        SELECT *
        FROM phase3_legacy_identifier_pairs
        ORDER BY first_client_id, second_client_id
    LOOP
        SELECT candidate.evidence_level
        INTO v_evidence_level
        FROM public.get_client_collision_candidates_v1(
            v_pair.first_client_id
        ) AS candidate
        WHERE candidate.related_client_id = v_pair.second_client_id
          AND candidate.collision_type = 'government_identity';

        IF v_evidence_level IS DISTINCT FROM 'legacy_identity' THEN
            RAISE EXCEPTION
                'Phase 3 adjudication pair is not a legacy identity collision';
        END IF;

        v_result := public.adjudicate_client_collision_v1(
            v_pair.first_client_id,
            v_pair.second_client_id,
            v_pair.first_updated_at,
            v_pair.second_updated_at,
            'government_identity',
            'confirmed_distinct',
            'Phase 3: định danh legacy trùng nhưng là các khách hàng riêng biệt'
        );

        IF v_result ->> 'disposition' IS DISTINCT FROM
            'confirmed_distinct'
        THEN
            RAISE EXCEPTION
                'Phase 3 adjudication RPC returned an unexpected disposition';
        END IF;
    END LOOP;

    SELECT count(*)
    INTO v_adjudicated_pair_count
    FROM public.client_collision_adjudications AS adjudication
    JOIN phase3_legacy_identifier_pairs AS pair
      ON adjudication.client_id = pair.first_client_id
     AND adjudication.related_client_id = pair.second_client_id
    WHERE adjudication.collision_type = 'government_identity'
      AND adjudication.disposition = 'confirmed_distinct'
      AND adjudication.adjudicated_by = v_manager_id;

    SELECT count(*)
    INTO v_adjudication_audit_count
    FROM public.audit_logs AS audit
    JOIN public.client_collision_adjudications AS adjudication
      ON adjudication.id = audit.record_id
    JOIN phase3_legacy_identifier_pairs AS pair
      ON adjudication.client_id = pair.first_client_id
     AND adjudication.related_client_id = pair.second_client_id
    LEFT JOIN phase3_adjudication_audit_snapshot AS existing_audit
      ON existing_audit.id = audit.id
    WHERE existing_audit.id IS NULL
      AND audit.table_name = 'client_collision_adjudications'
      AND audit.operation = 'CLIENT_COLLISION_ADJUDICATED'
      AND audit.changed_by = v_manager_id;

    SELECT count(*)
    INTO v_remaining_unresolved_pairs
    FROM phase3_legacy_identifier_pairs AS pair
    WHERE EXISTS (
        SELECT 1
        FROM public.get_client_collision_candidates_v1(
            pair.first_client_id
        ) AS candidate
        WHERE candidate.related_client_id = pair.second_client_id
          AND candidate.collision_type = 'government_identity'
    );

    SELECT md5(COALESCE(
        string_agg(client.id::TEXT, ',' ORDER BY client.id),
        ''
    ))
    INTO v_uuid_digest_after
    FROM public.clients AS client;

    SELECT md5(COALESCE(
        string_agg(to_jsonb(client)::TEXT, E'\n' ORDER BY client.id),
        ''
    ))
    INTO v_raw_digest_after
    FROM public.clients AS client;

    SELECT md5(COALESCE(
        string_agg(
            sample.id::TEXT || '|' || COALESCE(sample.client_id::TEXT, ''),
            ','
            ORDER BY sample.id
        ),
        ''
    ))
    INTO v_sample_link_digest_after
    FROM public.samples AS sample;

    IF v_uuid_digest_after IS DISTINCT FROM v_uuid_digest_before THEN
        RAISE EXCEPTION 'Phase 3 adjudication client UUID set changed';
    END IF;

    IF v_raw_digest_after IS DISTINCT FROM v_raw_digest_before THEN
        RAISE EXCEPTION 'Phase 3 adjudication client raw evidence changed';
    END IF;

    IF v_sample_link_digest_after IS DISTINCT FROM
        v_sample_link_digest_before
    THEN
        RAISE EXCEPTION 'Phase 3 adjudication sample history links changed';
    END IF;

    IF v_adjudicated_pair_count <> 4
       OR v_remaining_unresolved_pairs <> 0
    THEN
        RAISE EXCEPTION
            'Phase 3 adjudication pair reconciliation failed';
    END IF;

    IF v_adjudication_audit_count <> 4 THEN
        RAISE EXCEPTION
            'Phase 3 adjudication audit coverage is incomplete';
    END IF;
END;
$adjudicate$;

SELECT jsonb_build_object(
    'adjudicated_groups',
        (SELECT count(*) FROM phase3_legacy_identifier_groups),
    'adjudicated_pairs',
        (
            SELECT count(*)
            FROM public.client_collision_adjudications AS adjudication
            JOIN phase3_legacy_identifier_pairs AS pair
              ON adjudication.client_id = pair.first_client_id
             AND adjudication.related_client_id = pair.second_client_id
            WHERE adjudication.collision_type = 'government_identity'
              AND adjudication.disposition = 'confirmed_distinct'
        ),
    'remaining_unresolved_pairs',
        (
            SELECT count(*)
            FROM phase3_legacy_identifier_pairs AS pair
            WHERE EXISTS (
                SELECT 1
                FROM public.get_client_collision_candidates_v1(
                    pair.first_client_id
                ) AS candidate
                WHERE candidate.related_client_id =
                        pair.second_client_id
                  AND candidate.collision_type = 'government_identity'
            )
        )
) AS phase3_legacy_adjudication_checkpoint;

COMMIT;
