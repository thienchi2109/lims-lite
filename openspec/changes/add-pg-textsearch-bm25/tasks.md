## 1. Infrastructure Setup

- [ ] 1.1 Create `Dockerfile.postgres` with multi-stage build
  - Stage 1: Rust builder with cargo-pgrx
  - Stage 2: Supabase Postgres base with compiled extension
- [ ] 1.2 Update `docker-compose.yml` to build postgres from Dockerfile
  - Change `image:` to `build:` configuration
  - Add build context and dockerfile path
- [ ] 1.3 Create `.dockerignore` entries for postgres build
  - Exclude node_modules, .next, etc. from build context
- [ ] 1.4 Test container build locally
  - Run `docker compose build postgres`
  - Verify extension files are present in container
- [ ] 1.5 Document build process in `docs/DOCKER_SETUP.md`
  - Add pg_textsearch build instructions
  - Document expected build time (5-10 minutes first build)

## 2. Database Migrations - Extension Installation

- [ ] 2.1 Create migration `0XX_install_pg_textsearch.sql`
  - Install textsearch extension
  - Verify extension version
  - Grant necessary permissions
- [ ] 2.2 Apply migration to development database
  ```powershell
  Get-Content supabase\migrations\0XX_install_pg_textsearch.sql | docker exec -i lims-postgres psql -U postgres -d postgres
  ```
- [ ] 2.3 Verify extension installation
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'textsearch';
  ```

## 3. Database Migrations - Search Indexes

- [ ] 3.1 Create migration `0XX_create_search_indexes.sql`
  - samples_search_idx on (sample_id, description)
  - clients_search_idx on (name, contact_name, phone, email, address)
  - assays_search_idx on (name, description)
  - results_search_idx on (value, comments)
  - audit_logs_search_idx on (action, old_data, new_data)
- [ ] 3.2 Configure BM25 parameters
  - k1 = 1.2 (term frequency saturation)
  - b = 0.75 (length normalization)
  - text_config = 'simple' (initial, Vietnamese-friendly)
- [ ] 3.3 Apply migration and verify indexes
  ```sql
  SELECT * FROM textsearch.indexes;
  ```

## 4. Database Migrations - Search Functions

- [ ] 4.1 Create migration `0XX_create_search_functions.sql`
  - `search_samples(query TEXT, limit_count INT)` - SECURITY INVOKER
  - `search_clients(query TEXT, limit_count INT)` - SECURITY INVOKER
  - `search_assays(query TEXT, limit_count INT)` - SECURITY INVOKER
  - `search_results(query TEXT, limit_count INT)` - SECURITY INVOKER
  - `search_audit_logs(query TEXT, limit_count INT)` - Manager only
  - `global_search(query TEXT, limit_count INT)` - Combined results
- [ ] 4.2 Add RLS-compliant result filtering
  - Respect existing sample RLS policies
  - Filter out soft-deleted records
  - Return only columns needed for display
- [ ] 4.3 Add manager-only check for audit_logs search
  ```sql
  IF get_user_role() != 'manager' THEN
      RAISE EXCEPTION 'Access denied: manager role required';
  END IF;
  ```
- [ ] 4.4 Grant EXECUTE permissions to authenticated role
- [ ] 4.5 Run security tests
  ```powershell
  docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
  ```

## 5. Application Integration - Server Actions

- [ ] 5.1 Create `src/app/actions/search.ts`
  - `searchSamples(query: string)` Server Action
  - `searchClients(query: string)` Server Action
  - `searchAssays(query: string)` Server Action
  - `searchResults(query: string)` Server Action
  - `searchAuditLogs(query: string)` Server Action (manager only)
  - `globalSearch(query: string)` Server Action
- [ ] 5.2 Add Zod validation schemas
  - SearchQuerySchema (min 2 chars, max 200 chars, sanitized)
  - SearchResultSchema per entity type
- [ ] 5.3 Add error handling and logging
  - Log search queries for analytics (without PII)
  - Handle empty results gracefully

## 6. Application Integration - Data Layer

- [ ] 6.1 Create `src/lib/data/search.ts`
  - Type definitions for search results
  - Search result transformers
  - Score normalization utilities
- [ ] 6.2 Add TanStack Query hooks (optional)
  - `useSearchSamples(query: string)`
  - `useGlobalSearch(query: string)`
  - Configure appropriate staleTime and cacheTime

## 7. Application Integration - UI Components

- [ ] 7.1 Create `src/components/global-search.tsx`
  - Search input with debouncing (300ms)
  - Results dropdown with entity grouping
  - Keyboard navigation support (arrow keys, Enter, Escape)
  - Vietnamese UI labels (reference vietnamese_dictionary.md)
- [ ] 7.2 Create `src/components/search-result-item.tsx`
  - Entity-specific result display
  - BM25 score indicator (optional)
  - Link to entity detail page
- [ ] 7.3 Integrate global search into navigation
  - Add to analyst dashboard header
  - Add to manager dashboard header
  - Keyboard shortcut (Cmd/Ctrl + K)

## 8. Vietnamese Localization

- [ ] 8.1 Add search-related terms to `docs/vietnamese_dictionary.md`
  - "Tim kiem" (Search)
  - "Ket qua tim kiem" (Search results)
  - "Khong tim thay ket qua" (No results found)
  - "Dang tim kiem..." (Searching...)
- [ ] 8.2 Update UI components with Vietnamese labels
- [ ] 8.3 Test with Vietnamese input queries

## 9. Testing

- [ ] 9.1 Create SQL test file `tests/search.test.sql`
  - Test BM25 ranking (relevant results ranked higher)
  - Test empty query handling
  - Test RLS enforcement
  - Test manager-only audit search
- [ ] 9.2 Manual testing checklist
  - [ ] Sample search by ID
  - [ ] Sample search by client name
  - [ ] Client search by contact info
  - [ ] Assay search by method name
  - [ ] Audit log search (manager only)
  - [ ] Analyst denied audit log search
  - [ ] Global search across entities
  - [ ] Vietnamese query input
  - [ ] Empty query returns empty results
- [ ] 9.3 Run typecheck and lint
  ```bash
  npm run typecheck && npm run lint
  ```

## 10. Documentation

- [ ] 10.1 Update `CLAUDE.md` with search-related patterns
  - Search function signatures
  - BM25 index configuration
- [ ] 10.2 Create `docs/SEARCH_SETUP.md`
  - pg_textsearch overview
  - Index configuration reference
  - Query syntax examples
  - Troubleshooting guide
- [ ] 10.3 Update `README.md` with search feature overview

## 11. Deployment Verification

- [ ] 11.1 Build production Docker image
  ```bash
  docker compose build --no-cache postgres
  ```
- [ ] 11.2 Deploy to staging environment
- [ ] 11.3 Run smoke tests on staging
  - Verify extension loaded
  - Verify indexes created
  - Test search functionality
- [ ] 11.4 Monitor for performance issues
  - Index build time
  - Query latency
  - Memory usage
