-- User-authorized restoration of the seven original accession options.
-- Data only: audited manager INSERTs under RLS; no compatibility publication.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.sample_types IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE actor_id CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    IF (SELECT count(*) FROM public.sample_types) <> 1 OR NOT EXISTS (
        SELECT 1 FROM public.sample_types
        WHERE import_code = 'LM-000001' AND name = 'Máu' AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Sample type baseline changed; repeat preflight';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.users u JOIN auth.users a ON a.id = u.id
        WHERE u.id = actor_id AND u.role = 'manager' AND a.deleted_at IS NULL
          AND (a.banned_until IS NULL OR a.banned_until <= now())
    ) THEN
        RAISE EXCEPTION 'Active system manager required';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.sample_types'::REGCLASS
          AND tgname = 'audit_sample_types_trigger' AND tgenabled = 'O'
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
    ) THEN
        RAISE EXCEPTION 'Enabled sample type audit trigger required';
    END IF;
    PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', actor_id, 'role', 'authenticated')::TEXT, true);
END;
$$;
SET LOCAL ROLE authenticated;
INSERT INTO public.sample_types (name) VALUES
    ('Dịch niệu đạo/âm đạo'),
    ('Nước tiểu'),
    ('Phết tế bào âm đạo'),
    ('Ngoáy trực tràng/hậu môn'),
    ('Phân'),
    ('Nước'),
    ('Thực phẩm');
DO $$
BEGIN
    IF (SELECT count(*) FROM public.sample_types WHERE deleted_at IS NULL) <> 8 THEN
        RAISE EXCEPTION 'Expected eight active sample types';
    END IF;
END;
$$;
COMMIT;
