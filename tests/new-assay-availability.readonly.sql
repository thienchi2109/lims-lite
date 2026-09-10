-- Incident regression: newly created CT-000295/CT-000296 must be available
-- through the analyst's published catalog. No catalog or assay data is changed.
\set ON_ERROR_STOP on
BEGIN READ ONLY;

DO $$
DECLARE
    analyst_id UUID;
    catalog JSONB;
    missing_codes TEXT;
BEGIN
    SELECT id INTO analyst_id
    FROM public.users
    WHERE role = 'analyst'
    LIMIT 1;
    IF analyst_id IS NULL THEN
        RAISE EXCEPTION 'PRECONDITION: analyst identity required';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', analyst_id::TEXT, true);
    catalog := public.get_published_assay_sample_type_catalog(NULL);
    IF catalog->>'revisionNumber' IS NULL THEN
        RAISE EXCEPTION 'PRECONDITION: published revision required';
    END IF;

    SELECT string_agg(expected.code, ', ' ORDER BY expected.code)
    INTO missing_codes
    FROM (VALUES ('CT-000295'), ('CT-000296')) AS expected(code)
    WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(catalog->'assays') AS entry
        WHERE entry->>'importCode' = expected.code
    );
    IF missing_codes IS NOT NULL THEN
        RAISE EXCEPTION 'NEW_ASSAY_AVAILABILITY: absent from published revision %: %',
            catalog->>'revisionNumber', missing_codes;
    END IF;
    RAISE NOTICE 'PASS: both incident assays appear in the analyst published catalog';
END;
$$;

ROLLBACK;
