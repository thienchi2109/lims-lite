-- Read-only Phase 3 checkpoint. Output contains aggregate counts only.
-- Pass expected_unresolved_pairs=4 before adjudication and 0 after adjudication.

\set ON_ERROR_STOP on
\if :{?expected_unresolved_pairs}
\else
\set expected_unresolved_pairs 0
\endif

BEGIN READ ONLY;

SET LOCAL statement_timeout = '30s';
SET LOCAL max_parallel_workers_per_gather = 0;
SET LOCAL app.expected_unresolved_pairs = :'expected_unresolved_pairs';

\echo unresolved_pair_total = :expected_unresolved_pairs

WITH candidate_pairs AS (
    SELECT
        first_client.id AS first_client_id,
        second_client.id AS second_client_id,
        collision.collision_type,
        collision.evidence_level,
        (
            first_client.deleted_at IS NOT NULL
            OR second_client.deleted_at IS NOT NULL
        ) AS includes_inactive_history
    FROM public.clients AS first_client
    JOIN public.clients AS second_client
      ON first_client.id < second_client.id
    CROSS JOIN LATERAL (
        VALUES
            (
                'government_identity'::TEXT,
                CASE
                    WHEN first_client.government_identity_trusted
                         AND second_client.government_identity_trusted
                        THEN 'trusted'
                    ELSE 'legacy_identity'
                END,
                (
                    btrim(first_client.id_card_num) =
                        btrim(second_client.id_card_num)
                    AND btrim(first_client.id_card_num) <> ''
                    AND first_client.id_card_num !~* '^BACKFILL-'
                )
            ),
            (
                'phone'::TEXT,
                'trusted'::TEXT,
                (
                    first_client.normalized_phone IS NOT NULL
                    AND first_client.normalized_phone =
                        second_client.normalized_phone
                )
            ),
            (
                'name_date_of_birth'::TEXT,
                'trusted'::TEXT,
                (
                    first_client.normalized_name IS NOT NULL
                    AND first_client.normalized_name =
                        second_client.normalized_name
                    AND first_client.date_of_birth =
                        second_client.date_of_birth
                )
            )
    ) AS collision(collision_type, evidence_level, is_match)
    WHERE collision.is_match
      AND NOT public.is_client_collision_confirmed_distinct_v1(
          first_client.id,
          second_client.id,
          collision.collision_type
      )
),
projection_stats AS (
    SELECT
        count(*) AS client_rows,
        count(*) FILTER (
            WHERE government_identity_trusted
        ) AS trusted_government_identity_rows,
        count(*) FILTER (
            WHERE NOT government_identity_trusted
        ) AS untrusted_government_identity_rows,
        count(*) FILTER (
            WHERE normalized_phone IS NULL
        ) AS missing_phone_projection_rows,
        count(*) FILTER (
            WHERE normalized_name IS DISTINCT FROM
                    public.normalize_client_name_v1(name)
               OR normalized_phone IS DISTINCT FROM
                    public.normalize_client_phone_v1(phone)
               OR government_identity_value IS DISTINCT FROM
                    public.normalize_client_government_identity_v1(
                        id_card_num
                    )
               OR government_identity_type IS DISTINCT FROM
                    public.classify_client_government_identity_v1(
                        id_card_num
                    )
               OR government_identity_trusted IS DISTINCT FROM (
                    public.normalize_client_government_identity_v1(
                        id_card_num
                    ) IS NOT NULL
                  )
        ) AS projection_mismatch_rows
    FROM public.clients
),
pair_stats AS (
    SELECT
        count(*) FILTER (
            WHERE collision_type = 'government_identity'
        ) AS government_identity_pairs,
        count(*) FILTER (
            WHERE collision_type = 'government_identity'
              AND evidence_level = 'legacy_identity'
        ) AS legacy_government_identity_pairs,
        count(*) FILTER (
            WHERE collision_type = 'phone'
        ) AS phone_pairs,
        count(*) FILTER (
            WHERE collision_type = 'name_date_of_birth'
        ) AS name_date_of_birth_pairs,
        count(*) FILTER (
            WHERE includes_inactive_history
        ) AS inactive_history_pairs,
        count(*) AS unresolved_pair_total
    FROM candidate_pairs
)
SELECT jsonb_build_object(
    'client_rows', projection_stats.client_rows,
    'trusted_government_identity_rows',
        projection_stats.trusted_government_identity_rows,
    'untrusted_government_identity_rows',
        projection_stats.untrusted_government_identity_rows,
    'missing_phone_projection_rows',
        projection_stats.missing_phone_projection_rows,
    'projection_mismatch_rows',
        projection_stats.projection_mismatch_rows,
    'government_identity_pairs',
        pair_stats.government_identity_pairs,
    'legacy_government_identity_pairs',
        pair_stats.legacy_government_identity_pairs,
    'phone_pairs', pair_stats.phone_pairs,
    'name_date_of_birth_pairs',
        pair_stats.name_date_of_birth_pairs,
    'inactive_history_pairs',
        pair_stats.inactive_history_pairs,
    'unresolved_pair_total',
        pair_stats.unresolved_pair_total,
    'sample_link_rows',
        (SELECT count(*) FROM public.samples WHERE client_id IS NOT NULL),
    'adjudication_rows',
        (SELECT count(*) FROM public.client_collision_adjudications)
) AS phase3_client_identity_checkpoint
FROM projection_stats
CROSS JOIN pair_stats;

DO $checkpoint$
DECLARE
    v_projection_mismatch_rows BIGINT;
    v_unresolved_pair_total BIGINT;
    v_expected_unresolved_pairs BIGINT :=
        current_setting('app.expected_unresolved_pairs')::BIGINT;
BEGIN
    SELECT count(*)
    INTO v_projection_mismatch_rows
    FROM public.clients
    WHERE normalized_name IS DISTINCT FROM
            public.normalize_client_name_v1(name)
       OR normalized_phone IS DISTINCT FROM
            public.normalize_client_phone_v1(phone)
       OR government_identity_value IS DISTINCT FROM
            public.normalize_client_government_identity_v1(id_card_num)
       OR government_identity_type IS DISTINCT FROM
            public.classify_client_government_identity_v1(id_card_num)
       OR government_identity_trusted IS DISTINCT FROM (
            public.normalize_client_government_identity_v1(id_card_num)
                IS NOT NULL
          );

    WITH candidate_pairs AS (
        SELECT
            first_client.id AS first_client_id,
            second_client.id AS second_client_id,
            collision.collision_type
        FROM public.clients AS first_client
        JOIN public.clients AS second_client
          ON first_client.id < second_client.id
        CROSS JOIN LATERAL (
            VALUES
                (
                    'government_identity'::TEXT,
                    (
                        btrim(first_client.id_card_num) =
                            btrim(second_client.id_card_num)
                        AND btrim(first_client.id_card_num) <> ''
                        AND first_client.id_card_num !~* '^BACKFILL-'
                    )
                ),
                (
                    'phone'::TEXT,
                    (
                        first_client.normalized_phone IS NOT NULL
                        AND first_client.normalized_phone =
                            second_client.normalized_phone
                    )
                ),
                (
                    'name_date_of_birth'::TEXT,
                    (
                        first_client.normalized_name IS NOT NULL
                        AND first_client.normalized_name =
                            second_client.normalized_name
                        AND first_client.date_of_birth =
                            second_client.date_of_birth
                    )
                )
        ) AS collision(collision_type, is_match)
        WHERE collision.is_match
          AND NOT public.is_client_collision_confirmed_distinct_v1(
              first_client.id,
              second_client.id,
              collision.collision_type
          )
    )
    SELECT count(*)
    INTO v_unresolved_pair_total
    FROM candidate_pairs;

    IF v_projection_mismatch_rows <> 0 THEN
        RAISE EXCEPTION
            'Phase 3 checkpoint found % projection mismatches',
            v_projection_mismatch_rows;
    END IF;

    IF v_unresolved_pair_total <> v_expected_unresolved_pairs THEN
        RAISE EXCEPTION
            'Phase 3 checkpoint expected % unresolved pairs but found %',
            v_expected_unresolved_pairs,
            v_unresolved_pair_total;
    END IF;
END;
$checkpoint$;

ROLLBACK;
