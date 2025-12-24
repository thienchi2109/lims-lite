-- Migration 094: Fix Realtime schema and create list_changes function
-- Security Impact: Low
-- Changes: Creates realtime schema and list_changes function required for Supabase Realtime v2
--
-- PROBLEM: The Supabase Realtime server v2 requires:
--   1. A 'realtime' schema (not '_realtime')
--   2. A 'realtime.list_changes' function with SET log_min_messages
--
-- The Realtime server attempts to auto-create these via migrations, but:
--   - The postgres user in Supabase Docker is NOT a superuser
--   - The SET log_min_messages clause requires superuser privileges
--   - Therefore the migration fails silently
--
-- SOLUTION: Pre-create the schema and function using supabase_admin (superuser)
-- This migration must be run as superuser before starting the Realtime service

SET search_path TO public;

-- Create the realtime schema if it doesn't exist
-- Note: The Realtime server needs 'realtime' NOT '_realtime'
CREATE SCHEMA IF NOT EXISTS realtime;
GRANT USAGE ON SCHEMA realtime TO postgres;
GRANT ALL ON SCHEMA realtime TO postgres;

-- Create the list_changes function
-- This function is called by the Realtime server to poll for changes
-- The SET log_min_messages is required to suppress noise during replication polling
CREATE OR REPLACE FUNCTION realtime.list_changes(
    publication name,
    slot_name name,
    max_changes int,
    max_record_bytes int
)
RETURNS setof realtime.wal_rls
LANGUAGE sql
SET log_min_messages TO 'fatal'
AS $$
    with pub as (
        select
            concat_ws(
                ',',
                case when bool_or(pubinsert) then 'insert' else null end,
                case when bool_or(pubupdate) then 'update' else null end,
                case when bool_or(pubdelete) then 'delete' else null end
            ) as w2j_actions,
            coalesce(
                string_agg(
                    realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
                    ','
                ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
                ''
            ) w2j_add_tables
        from
            pg_publication pp
            left join pg_publication_tables ppt
                on pp.pubname = ppt.pubname
        where
            pp.pubname = publication
        group by
            pp.pubname
        limit 1
    ),
    w2j as (
        select
            x.*, pub.w2j_add_tables
        from
            pub,
            pg_logical_slot_get_changes(
                slot_name, null, max_changes,
                'include-pk', 'true',
                'include-transaction', 'false',
                'include-timestamp', 'true',
                'include-type-oids', 'true',
                'format-version', '2',
                'actions', pub.w2j_actions,
                'add-tables', pub.w2j_add_tables
            ) x
    )
    select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
    from
        w2j,
        realtime.apply_rls(
            wal := w2j.data::jsonb,
            max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
$$;

-- Mark the migration as completed in the Realtime server's schema_migrations table
-- This prevents the Realtime server from trying to re-run this migration and failing
INSERT INTO realtime.schema_migrations (version, inserted_at)
VALUES (20230328144023, now())
ON CONFLICT DO NOTHING;

COMMENT ON FUNCTION realtime.list_changes IS 'Polls for database changes from the logical replication slot. Called by Supabase Realtime server. Requires superuser to create due to SET log_min_messages.';
