-- Migration 063: Enable Realtime for samples table
-- Security Impact: Low
-- Changes: Add public.samples to supabase_realtime publication for realtime notifications

SET search_path TO public;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'samples'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.samples;
        END IF;
    END IF;
END $$;

