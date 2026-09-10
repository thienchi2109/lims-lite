-- Regression: analysts can read all eight original accession sample types.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $$
DECLARE analyst_id UUID;
BEGIN
    SELECT id INTO analyst_id FROM public.users WHERE role = 'analyst' LIMIT 1;
    IF analyst_id IS NULL THEN RAISE EXCEPTION 'Analyst identity required'; END IF;
    PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', analyst_id, 'role', 'authenticated')::TEXT, true);
END;
$$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE missing_names TEXT;
BEGIN
    SELECT string_agg(expected.name, ', ' ORDER BY expected.name)
    INTO missing_names
    FROM (VALUES ('Máu'), ('Dịch niệu đạo/âm đạo'), ('Nước tiểu'),
        ('Phết tế bào âm đạo'), ('Ngoáy trực tràng/hậu môn'), ('Phân'),
        ('Nước'), ('Thực phẩm')) expected(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.sample_types actual
        WHERE actual.name = expected.name AND actual.deleted_at IS NULL
    );
    IF missing_names IS NOT NULL THEN
        RAISE EXCEPTION 'SAMPLE_TYPE_OPTIONS_MISSING: %', missing_names;
    END IF;
END;
$$;
ROLLBACK;
