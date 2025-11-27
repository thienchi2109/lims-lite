-- Insert users (without audit trigger issues)
ALTER TABLE public.users DISABLE TRIGGER audit_users_trigger;

INSERT INTO public.users (id, username, full_name, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'analyst', 'Test Analyst', 'analyst'),
('b0000000-0000-0000-0000-000000000001', 'manager', 'Test Manager', 'manager')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.users ENABLE TRIGGER audit_users_trigger;

-- Insert samples
DO $$
DECLARE
    analyst_id UUID := 'a0000000-0000-0000-0000-000000000001';
    i INTEGER;
BEGIN
    FOR i IN 1..20 LOOP
        INSERT INTO public.samples (sample_id, client_name, status, received_by, received_at)
        VALUES (
            'CDC-XN-' || TO_CHAR(CURRENT_DATE, 'DDMMYYYY') || '-' || LPAD(i::TEXT, 4, '0'),
            'Test Client ' || i,
            'received',
            analyst_id,
            CURRENT_TIMESTAMP - (i || ' hours')::INTERVAL
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Assign tests to first 5 samples
DO $$
DECLARE
    sample_rec RECORD;
    assay_rec RECORD;
BEGIN
    FOR sample_rec IN 
        SELECT id FROM public.samples 
        WHERE status = 'received'
        ORDER BY created_at DESC
        LIMIT 5
    LOOP
        FOR assay_rec IN 
            SELECT id FROM public.assay_definitions
        LOOP
            INSERT INTO public.results (sample_id, assay_id, status)
            VALUES (sample_rec.id, assay_rec.id, 'pending')
            ON CONFLICT DO NOTHING;
        END LOOP;

        UPDATE public.samples 
        SET status = 'assigned'
        WHERE id = sample_rec.id;
    END LOOP;
END $$;

-- Verify
SELECT 'Users:' as item, COUNT(*)::text as count FROM public.users
UNION ALL SELECT 'Samples:', COUNT(*)::text FROM public.samples
UNION ALL SELECT 'Results:', COUNT(*)::text FROM public.results;
