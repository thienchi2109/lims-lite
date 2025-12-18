## Why

CDC-LIMS lacks full-text search capability, forcing users to rely on exact-match filters when searching samples, clients, assays, results, and audit logs. Users need to efficiently search across entities using partial text matches, Vietnamese keywords, and natural language queries.

## What Changes

- Add PostgreSQL **built-in full-text search** using `tsvector`, `ts_rank()`, and GIN indexes
- Create `search_vector` columns on samples, clients, assay_definitions, results, and audit_logs tables
- Implement automatic index updates via triggers (zero maintenance required)
- Create search RPC functions with RLS-compliant result filtering
- Add global search endpoint combining results across entity types
- Restrict audit_logs search to manager role only (compliance requirement)
- Install `unaccent` extension for Vietnamese diacritic-insensitive search
- **NON-BREAKING**: No external dependencies, uses standard PostgreSQL features

**Rationale for built-in search over BM25:**
- Production-proven since PostgreSQL 8.3 (2008) - battle-tested reliability
- Zero maintenance (automatic index updates via triggers)
- Native RLS integration (no complex JOINs required)
- Sub-second performance for LIMS workloads (<100k samples)
- Vietnamese language support included via `unaccent` extension
- Simple implementation (5x faster to ship than BM25)

**Why not BM25:**
- LIMS users search to **FIND** records, not **RANK** thousands of results
- Dataset is small (10k-100k samples vs millions of web documents)
- Built-in search provides 90% of value with 10% of complexity
- BM25 can be added later if proven necessary (non-breaking change)

## Impact

- Affected specs: NEW capability `search-capability` (full-text search across LIMS entities)
- Affected code:
  - `supabase/migrations/0XX_install_unaccent.sql` (install unaccent extension)
  - `supabase/migrations/0XX_add_search_to_samples.sql` (tsvector column, GIN index, trigger)
  - `supabase/migrations/0XX_add_search_to_clients.sql` (same pattern)
  - `supabase/migrations/0XX_add_search_to_assays.sql` (same pattern)
  - `supabase/migrations/0XX_add_search_to_results.sql` (same pattern)
  - `supabase/migrations/0XX_add_search_to_audit_logs.sql` (same pattern)
  - `supabase/migrations/0XX_create_search_functions.sql` (RLS-compliant search functions)
  - `src/app/actions/search.ts` (search Server Actions)
  - `src/components/global-search.tsx` (UI component)
  - `src/lib/data/search.ts` (data fetching utilities)
