## 1. Database Migrations - Install unaccent Extension

- [x] 1.1 Create migration `068_install_unaccent.sql`
  - Install unaccent extension for Vietnamese diacritic-insensitive search
  - Test with Vietnamese text
- [x] 1.2 Apply migration to development database
  ```powershell
  Get-Content supabase\migrations\068_install_unaccent.sql | docker exec -i lims-postgres psql -U postgres -d postgres
  ```
- [x] 1.3 Verify extension installation
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'unaccent';
  SELECT unaccent('Huyết thanh');  -- Should return "Huyet thanh"
  ```

## 2. Database Migrations - Add Search to Samples

- [x] 2.1 Create migration `069_add_search_to_samples.sql`
  - Add `search_vector tsvector` column to samples table
  - Create GIN index `samples_search_idx` (use CONCURRENTLY for production)
  - Create trigger function `update_search_vector_samples()`
  - Create trigger `samples_search_update` on samples table (UPDATE OF sample_id, client_name, type, status, rejection_reason, received_at)
  - Backfill existing data
- [x] 2.2 Update audit trigger to exclude search_vector from change diffs
  - Modify `trigger_audit_log()` to exclude search_vector: `to_jsonb(OLD) - 'search_vector'`
  - Reduces audit log noise from automatic search_vector updates
- [x] 2.3 Apply migration to development database
  ```powershell
  Get-Content supabase\migrations\069_add_search_to_samples.sql | docker exec -i lims-postgres psql -U postgres -d postgres
  ```
- [x] 2.4 Verify search column and index
  ```sql
  \d samples  -- Check for search_vector column
  SELECT * FROM pg_indexes WHERE tablename = 'samples' AND indexname = 'samples_search_idx';
  ```
- [x] 2.5 Test trigger on insert/update
  ```sql
  INSERT INTO samples (sample_id, description) VALUES ('TEST-001', 'Huyết thanh');
  SELECT sample_id, search_vector FROM samples WHERE sample_id = 'TEST-001';
  -- Should show tsvector content
  ```
- [x] 2.6 Verify audit logs exclude search_vector
  ```sql
  UPDATE samples SET description = 'Updated description' WHERE sample_id = 'TEST-001';
  SELECT new_values FROM audit_logs WHERE table_name = 'samples' ORDER BY changed_at DESC LIMIT 1;
  -- Should NOT contain search_vector key
  ```

## 3. Database Migrations - Add Search to Other Tables

- [x] 3.1 Create migration `071_add_search_to_clients.sql`
  - Add search_vector column, GIN index (CONCURRENTLY for production), trigger
  - Index columns: name, phone, address, id_card_num, health_insurance_num
  - Note: audit_logs already excludes search_vector (migration 070)
- [x] 3.2 Create migration `072_add_search_to_assays.sql`
  - Add search_vector column, GIN index (CONCURRENTLY for production), trigger
  - Index columns: name, units
  - Note: audit_logs already excludes search_vector (migration 070)
- [x] 3.3 Create migration `073_add_search_to_results.sql`
  - Add search_vector column, GIN index (CONCURRENTLY for production), trigger
  - Index columns: value, status::text, approval_note
  - Note: audit_logs already excludes search_vector (migration 070)
- [x] 3.4 Create migration `074_add_search_to_audit_logs.sql`
  - Add search_vector column, GIN index (CONCURRENTLY for production), trigger
  - Index columns: operation, table_name, old_values::text, new_values::text
  - Note: audit_logs table does NOT need to exclude search_vector from its own audit (no recursion)
- [x] 3.5 Apply all migrations to development database
- [x] 3.6 Verify all indexes created
  ```sql
  SELECT tablename, indexname FROM pg_indexes
  WHERE indexname LIKE '%_search_idx'
  ORDER BY tablename;
  ```

## 4. Database Migrations - Search Functions

- [x] 4.1 Create migration `075_create_search_functions.sql`
  - `search_samples(query TEXT, max_results INT DEFAULT 20)` - SECURITY INVOKER
  - `search_clients(query TEXT, max_results INT DEFAULT 20)` - SECURITY INVOKER
  - `search_assays(query TEXT, max_results INT DEFAULT 20)` - SECURITY INVOKER
  - `search_results(query TEXT, max_results INT DEFAULT 20)` - SECURITY INVOKER
  - `search_audit_logs(query TEXT, max_results INT DEFAULT 20)` - Manager only
  - `global_search(query TEXT, max_results INT DEFAULT 20)` - Combined results
- [x] 4.2 Use `plainto_tsquery()` for query safety (NOT raw `to_tsquery()`)
  - Prevents syntax errors from user input (e.g., "C++" would break `to_tsquery()`)
  - Prevents potential injection attacks
  - Automatically handles spaces and basic operators
  - Apply `unaccent()` to search queries for Vietnamese support
  - Example: `plainto_tsquery('simple', unaccent(search_query))`
- [x] 4.3 Add RLS-compliant result filtering
  - RLS policies automatically enforced (same table)
  - Filter out soft-deleted records (deleted_at IS NULL for samples/assays)
  - Return id, entity fields, and rank score
- [x] 4.4 Grant EXECUTE permissions to authenticated role
  ```sql
  GRANT EXECUTE ON FUNCTION search_samples TO authenticated;
  -- Repeat for all search functions
  ```
- [x] 4.5 Apply migration and test functions
  ```sql
  -- Test sample search
  SELECT * FROM search_samples('huyết thanh', 10);

  -- Test audit log search (should fail for non-managers)
  SET ROLE authenticated;
  SET request.jwt.claims TO '{"sub": "analyst-uuid", "role": "analyst"}';
  SELECT * FROM search_audit_logs('update');  -- Should fail or return empty
  ```

## 5. Application Integration - Server Actions

- [x] 5.1 Create `src/app/actions/search.ts`
  - `searchSamples(query: string)` Server Action
  - `searchClients(query: string)` Server Action
  - `searchAssays(query: string)` Server Action
  - `searchResults(query: string)` Server Action
  - `searchAuditLogs(query: string)` Server Action (manager only)
  - `globalSearch(query: string)` Server Action
- [x] 5.2 Add Zod validation schemas
  - SearchQuerySchema (min 2 chars, max 200 chars, sanitized)
  - SearchResultSchema per entity type
- [x] 5.3 Add error handling and logging
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
  - **IMPORTANT**: For production/staging with active users, modify migrations to use `CREATE INDEX CONCURRENTLY`
  - Regular `CREATE INDEX` locks the table during index creation
  - `CREATE INDEX CONCURRENTLY` allows concurrent reads/writes but takes longer
  - Development: Use regular `CREATE INDEX` (faster)
  - Production/Staging: Use `CREATE INDEX CONCURRENTLY` (no downtime)
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
  - Run migrations during maintenance window (or use CONCURRENTLY)
  - Verify search functionality post-deployment
