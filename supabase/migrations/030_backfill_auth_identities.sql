-- Migration 030: Backfill auth.identities for seeded users
-- Security Impact: Low
-- Changes: Inserts email identities for existing auth.users to enable password logins on newer GoTrue versions

SET search_path TO auth, public;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id, email
        FROM auth.users
    LOOP
        INSERT INTO auth.identities (
            id,
            provider_id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        )
        VALUES (
            uuid_generate_v4(),
            r.id::TEXT,
            r.id,
            jsonb_build_object('sub', r.id::TEXT, 'email', r.email),
            'email',
            NOW(),
            NOW(),
            NOW()
        )
        ON CONFLICT (provider, provider_id) DO NOTHING;
    END LOOP;
END $$;

-- Validate security posture
SELECT * FROM public.run_security_tests();
