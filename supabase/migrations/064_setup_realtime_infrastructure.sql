-- Migration 064: Setup Supabase Realtime Infrastructure
-- Security Impact: Low
-- Changes: Create _realtime schema and supabase_realtime publication

-- Create _realtime schema for Realtime server metadata
CREATE SCHEMA IF NOT EXISTS _realtime;

-- Grant usage on _realtime schema to postgres
GRANT USAGE ON SCHEMA _realtime TO postgres;

-- Create supabase_realtime publication for tracking changes
CREATE PUBLICATION supabase_realtime;

-- Add samples table to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.samples;

-- Add comment explaining the publication
COMMENT ON PUBLICATION supabase_realtime IS 'Publication for Supabase Realtime subscriptions. Tables added to this publication will broadcast changes to subscribed clients.';
