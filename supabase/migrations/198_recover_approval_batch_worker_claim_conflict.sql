-- Migration 198: Recover approval-batch worker claim conflict targeting
-- Security Impact: HIGH
-- Changes:
--   - Rewrites exactly two ambiguous migration 196 ON CONFLICT clauses.
--   - Targets approval_batch_item_attempts_event_key explicitly.
-- Migrations 196 and 197 are applied/attempted and immutable.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $recovery$
DECLARE
    v_definition TEXT;
    v_recovered_definition TEXT;
    v_pattern TEXT :=
        'ON CONFLICT[[:space:]]*\([[:space:]]*'
        || 'batch_item_id[[:space:]]*,[[:space:]]*'
        || 'attempt_number[[:space:]]*,[[:space:]]*'
        || 'event_type[[:space:]]*\)[[:space:]]*DO NOTHING';
    v_match_count INTEGER;
BEGIN
    IF to_regprocedure(
        'public.claim_approval_batch_items_worker(integer,integer)'
    ) IS NULL
       OR to_regprocedure(
           'public.test_approval_batch_worker_security()'
       ) IS NULL
       OR NOT public.test_approval_batch_worker_security()
    THEN
        RAISE EXCEPTION
            'Migration 198 requires the applied migration 196 worker contract';
    END IF;

    SELECT pg_get_functiondef(
        'public.claim_approval_batch_items_worker(integer,integer)'
            ::REGPROCEDURE
    )
    INTO v_definition;

    SELECT count(*)
    INTO v_match_count
    FROM regexp_matches(v_definition, v_pattern, 'g');

    IF v_match_count <> 2 THEN
        RAISE EXCEPTION
            'Migration 198 expected two ambiguous conflict clauses, found %',
            v_match_count;
    END IF;

    v_recovered_definition := regexp_replace(
        v_definition,
        v_pattern,
        'ON CONFLICT ON CONSTRAINT '
        || 'approval_batch_item_attempts_event_key DO NOTHING',
        'g'
    );

    EXECUTE v_recovered_definition;

    SELECT pg_get_functiondef(
        'public.claim_approval_batch_items_worker(integer,integer)'
            ::REGPROCEDURE
    )
    INTO v_definition;

    SELECT count(*)
    INTO v_match_count
    FROM regexp_matches(v_definition, v_pattern, 'g');

    IF v_match_count <> 0
       OR v_definition NOT ILIKE
           '%ON CONFLICT ON CONSTRAINT%'
           || 'approval_batch_item_attempts_event_key%'
       OR NOT public.test_approval_batch_worker_security()
    THEN
        RAISE EXCEPTION
            'Migration 198 claim conflict recovery verification failed';
    END IF;
END;
$recovery$;

COMMENT ON FUNCTION public.claim_approval_batch_items_worker(
    INTEGER,
    INTEGER
) IS 'Worker-only bounded SKIP LOCKED claims with explicit append-only attempt conflict targeting.';

NOTIFY pgrst, 'reload schema';

COMMIT;
