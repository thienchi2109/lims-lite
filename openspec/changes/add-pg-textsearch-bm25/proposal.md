## Why

CDC-LIMS lacks full-text search capability, forcing users to rely on exact-match filters when searching samples, clients, assays, and audit logs. The built-in PostgreSQL `ts_rank` function does not account for term frequency saturation, making it susceptible to keyword stuffing and producing suboptimal relevance ranking.

## What Changes

- Add pg_textsearch (Timescale's BM25 Rust extension) to the PostgreSQL container via a custom Dockerfile
- Create BM25 search indexes on samples, clients, assay_definitions, and audit_logs tables
- Implement search RPC functions with RLS-compliant result filtering
- Add global search endpoint combining results across entity types
- Restrict audit_logs search to manager role only (compliance requirement)
- Update docker-compose.yml to use custom Postgres image with pg_textsearch
- **BREAKING**: Existing `lims-postgres` container must be rebuilt with new base image

## Impact

- Affected specs: NEW capability `search-capability` (full-text search across LIMS entities)
- Affected code:
  - `docker-compose.yml` (postgres service configuration)
  - `Dockerfile.postgres` (NEW - custom Postgres build with pg_textsearch)
  - `supabase/migrations/0XX_install_pg_textsearch.sql` (extension + indexes)
  - `supabase/migrations/0XX_create_search_functions.sql` (RPC functions)
  - `src/app/actions/search.ts` (search Server Actions)
  - `src/components/global-search.tsx` (UI component)
  - `src/lib/data/search.ts` (data fetching utilities)
