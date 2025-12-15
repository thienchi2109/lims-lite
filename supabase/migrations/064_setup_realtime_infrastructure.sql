-- Migration 064: Setup Supabase Realtime Infrastructure
-- Security Impact: Low
-- Changes: Ensure _realtime schema and supabase_realtime publication exist

SET search_path TO public;

-- Create _realtime schema for Realtime server metadata
CREATE SCHEMA IF NOT EXISTS _realtime;

-- Grant usage on _realtime schema to postgres
GRANT USAGE ON SCHEMA _realtime TO postgres;

-- Create supabase_realtime publication for tracking changes (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Add samples table to the publication (idempotent)
DO $$
BEGIN
    IF to_regclass('public.samples') IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'samples'
        ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.samples;
    END IF;
END $$;

-- Add comment explaining the publication
COMMENT ON PUBLICATION supabase_realtime IS 'Publication for Supabase Realtime subscriptions. Tables added to this publication will broadcast changes to subscribed clients.';
