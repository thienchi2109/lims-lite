## 1. Database Migrations - Install unaccent Extension

- [ ] 1.1 Create migration `0XX_install_unaccent.sql`
  - Install unaccent extension for Vietnamese diacritic-insensitive search
  - Test with Vietnamese text
- [ ] 1.2 Apply migration to development database
  ```powershell
  Get-Content supabase\migrations\0XX_install_unaccent.sql | docker exec -i lims-postgres psql -U postgres -d postgres
  ```
- [ ] 1.3 Verify extension installation
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'unaccent';
  SELECT unaccent('Huyết thanh');  -- Should return "Huyet thanh"
  ```

## 2. Database Migrations - Add Search to Samples

- [ ] 2.1 Create migration `0XX_add_search_to_samples.sql`
  - Add `search_vector tsvector` column to samples table
  - Create GIN index `samples_search_idx`
  - Create trigger function `update_search_vector_simple()`
  - Create trigger `samples_search_update` on samples table
  - Backfill existing data
- [ ] 2.2 Apply migration to development database
  ```powershell
  Get-Content supabase\migrations\0XX_add_search_to_samples.sql | docker exec -i lims-postgres psql -U postgres -d postgres
  ```
- [ ] 2.3 Verify search column and index
  ```sql
  \d samples  -- Check for search_vector column
  SELECT * FROM pg_indexes WHERE tablename = 'samples' AND indexname = 'samples_search_idx';
  ```
- [ ] 2.4 Test trigger on insert/update
  ```sql
  INSERT INTO samples (sample_id, description) VALUES ('TEST-001', 'Huyết thanh');
  SELECT sample_id, search_vector FROM samples WHERE sample_id = 'TEST-001';
  -- Should show tsvector content
  ```

## 3. Database Migrations - Add Search to Other Tables

- [ ] 3.1 Create migration `0XX_add_search_to_clients.sql`
  - Add search_vector column, GIN index, trigger
  - Index columns: name, contact_name, address
- [ ] 3.2 Create migration `0XX_add_search_to_assays.sql`
  - Add search_vector column, GIN index, trigger
  - Index columns: name, method_name, description
- [ ] 3.3 Create migration `0XX_add_search_to_results.sql`
  - Add search_vector column, GIN index, trigger
  - Index columns: value, comments
- [ ] 3.4 Create migration `0XX_add_search_to_audit_logs.sql`
  - Add search_vector column, GIN index, trigger
  - Index columns: action, old_data::text, new_data::text
- [ ] 3.5 Apply all migrations to development database
- [ ] 3.6 Verify all indexes created
  ```sql
  SELECT tablename, indexname FROM pg_indexes
  WHERE indexname LIKE '%_search_idx'
  ORDER BY tablename;
  ```

## 4. Database Migrations - Search Functions

- [ ] 4.1 Create migration `0XX_create_search_functions.sql`
  - `search_samples(query TEXT, max_results INT DEFAULT 20)` - SECURITY INVOKER
  - `search_clients(query TEXT, max_results INT DEFAULT 20)` - SECURITY INVOKER
  - `search_assays(query TEXT, max_results INT DEFAULT 20)` - SECURITY INVOKER
  - `search_results(query TEXT, max_results INT DEFAULT 20)` - SECURITY INVOKER
  - `search_audit_logs(query TEXT, max_results INT DEFAULT 20)` - Manager only
  - `global_search(query TEXT, max_results INT DEFAULT 20)` - Combined results
- [ ] 4.2 Use `plainto_tsquery()` for simple query parsing
  - Automatically handles spaces and basic operators
  - Apply `unaccent()` to search queries
- [ ] 4.3 Add RLS-compliant result filtering
  - RLS policies automatically enforced (same table)
  - Filter out soft-deleted records (deleted_at IS NULL)
  - Return id, entity fields, and rank score
- [ ] 4.4 Grant EXECUTE permissions to authenticated role
  ```sql
  GRANT EXECUTE ON FUNCTION search_samples TO authenticated;
  -- Repeat for all search functions
  ```
- [ ] 4.5 Apply migration and test functions
  ```sql
  -- Test sample search
  SELECT * FROM search_samples('huyết thanh', 10);

  -- Test audit log search (should fail for non-managers)
  SET ROLE authenticated;
  SET request.jwt.claims TO '{"sub": "analyst-uuid", "role": "analyst"}';
  SELECT * FROM search_audit_logs('update');  -- Should fail or return empty
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
  - Return { data, error } pattern

## 6. Application Integration - Data Layer

- [ ] 6.1 Create `src/lib/data/search.ts`
  - Type definitions for search results (SearchSampleResult, etc.)
  - Search result transformers
  - Score normalization utilities (optional)
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
  - Show rank score (optional, for debugging)
- [ ] 7.2 Create `src/components/search-result-item.tsx`
  - Entity-specific result display
  - Link to entity detail page
  - Highlight matched terms (optional)
- [ ] 7.3 Integrate global search into navigation
  - Add to analyst dashboard header
  - Add to manager dashboard header
  - Keyboard shortcut (Cmd/Ctrl + K)

## 8. Vietnamese Localization

- [ ] 8.1 Add search-related terms to `docs/vietnamese_dictionary.md`
  - "Tìm kiếm" (Search)
  - "Kết quả tìm kiếm" (Search results)
  - "Không tìm thấy kết quả" (No results found)
  - "Đang tìm kiếm..." (Searching...)
  - "Tìm kiếm toàn bộ" (Global search)
- [ ] 8.2 Update UI components with Vietnamese labels
- [ ] 8.3 Test with Vietnamese input queries
  - Test with diacritics: "Huyết thanh"
  - Test without diacritics: "Huyet thanh"
  - Both should return same results

## 9. Testing

- [ ] 9.1 Create SQL test file `tests/search.test.sql`
  - Test ts_rank ranking (relevant results ranked higher)
  - Test empty query handling
  - Test RLS enforcement
  - Test manager-only audit search
  - Test Vietnamese diacritic handling
- [ ] 9.2 Manual testing checklist
  - [ ] Sample search by ID
  - [ ] Sample search by client name
  - [ ] Client search by contact info
  - [ ] Assay search by method name
  - [ ] Audit log search (manager only)
  - [ ] Analyst denied audit log search
  - [ ] Global search across entities
  - [ ] Vietnamese query input with diacritics
  - [ ] Vietnamese query input without diacritics
  - [ ] Empty query returns empty results
  - [ ] Search performance (<50ms for 10k samples)
- [ ] 9.3 Run typecheck and lint
  ```bash
  npm run typecheck && npm run lint
  ```
- [ ] 9.4 Run security tests
  ```powershell
  docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
  ```

## 10. Documentation

- [ ] 10.1 Update `CLAUDE.md` with search-related patterns
  - Search function signatures
  - tsvector/ts_rank usage
  - GIN index configuration
- [ ] 10.2 Create `docs/SEARCH_SETUP.md`
  - PostgreSQL full-text search overview
  - Index configuration reference
  - Query syntax examples (plainto_tsquery vs to_tsquery)
  - Vietnamese search configuration
  - Performance expectations
  - Troubleshooting guide
- [ ] 10.3 Update `README.md` with search feature overview

## 11. Performance Tuning (Optional - Post-Launch)

- [ ] 11.1 Monitor search performance in production
  - Track query latency (<50ms expected for LIMS workloads)
  - Track index size overhead (~15-30% expected)
- [ ] 11.2 Add weighted ranking if needed
  ```sql
  ts_rank_cd(
      setweight(to_tsvector('simple', sample_id), 'A') ||  -- High priority
      setweight(to_tsvector('simple', description), 'B'),  -- Lower priority
      query
  )
  ```
- [ ] 11.3 Add Vietnamese stopwords if needed
  - Create custom text search configuration
  - Add Vietnamese stopwords list (và, của, được, etc.)
- [ ] 11.4 Add phrase search if requested by users
  ```sql
  -- Support quotes for exact phrase matching
  to_tsquery('simple', '"huyết thanh"')
  ```

## 12. Deployment Verification

- [ ] 12.1 Run all migrations on staging environment
- [ ] 12.2 Run smoke tests on staging
  - Verify unaccent extension loaded
  - Verify search_vector columns exist
  - Verify GIN indexes created
  - Test search functionality
- [ ] 12.3 Monitor for performance issues
  - Query latency (should be <50ms)
  - Index size (should be <30% overhead)
  - Memory usage
- [ ] 12.4 Deploy to production
  - Run migrations during maintenance window
  - Verify search functionality post-deployment
