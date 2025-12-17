## Context

CDC-LIMS currently has no full-text search capability. Users must rely on exact-match filters (sample ID prefix, status dropdown) which is inefficient for:
- Finding samples by partial client name or description
- Searching test catalog by method keywords
- Finding results by value or comments (e.g., "positive culture")
- Investigating audit logs during compliance audits
- Cross-entity discovery (finding related samples, clients, results, and assays)

PostgreSQL's built-in full-text search provides production-proven capabilities with:
- `tsvector` for tokenized document representation
- `tsquery` for query parsing
- `ts_rank()` for relevance scoring
- GIN/GiST indexes for performance
- Automatic index updates via triggers
- Vietnamese language support

This eliminates the need for external search services or complex BM25 implementations.

## Goals / Non-Goals

### Goals
- Provide full-text search across LIMS core entities (samples, clients, assays, results, audit_logs)
- Maintain RLS compliance (search results respect existing row-level security policies)
- Support Vietnamese text through PostgreSQL language configurations
- Enable future enhancements (phrase search, synonyms, ranking weights)
- Keep infrastructure simple (use PostgreSQL built-in features only)
- Zero external dependencies (no extensions, no external services)

### Non-Goals
- BM25 ranking algorithm (PostgreSQL's `ts_rank` is sufficient for LIMS)
- Semantic/embedding-based search (phase 2 with pgvector if needed)
- Real-time search-as-you-type (initial implementation uses submit-based search)
- External search services (Elasticsearch, Meilisearch, Typesense)
- Full audit log search for analysts (manager-only due to compliance)
- Complex relevance tuning (start simple, iterate based on user feedback)

## Decisions

### Decision: PostgreSQL built-in full-text search

**Why built-in search over BM25 implementations:**

| Aspect | Built-in Search | BM25 (plpgsql_bm25) | BM25 (pg_textsearch) |
|--------|----------------|---------------------|---------------------|
| **Setup** | Add tsvector column, create trigger | Install SQL functions, manual index refresh | Requires PostgreSQL 17+ (incompatible) |
| **Performance** | ~10ms for 10k rows (GIN index) | ~100ms for 10k rows | ~1-2ms (but unusable) |
| **Maintenance** | Zero (automatic updates) | High (manual refresh via pg_cron) | N/A (can't use) |
| **Production readiness** | Proven since PG 8.3 (2008) | Experimental/PoC | v0.1.1-dev (not production) |
| **Vietnamese support** | Built-in language configs | Manual stopwords list | N/A |
| **RLS integration** | Native (same table) | Complex (JOIN required) | N/A |

**Trade-off analysis:**

**BM25 advantages:**
- Better ranking for keyword stuffing scenarios (term frequency saturation)
- Industry standard for web search engines

**Built-in search advantages:**
- ✅ Zero setup complexity (no external code)
- ✅ Automatic index updates (no manual refresh)
- ✅ Production-proven for 15+ years
- ✅ Native RLS integration
- ✅ Vietnamese language support included
- ✅ Sub-second performance for LIMS workloads

**Why BM25 doesn't matter for LIMS:**
- LIMS users search to **FIND** records, not **RANK** thousands of results
- Dataset is small (10k-100k samples vs millions of web documents)
- Search queries are infrequent (few times per day vs thousands per second)
- Keyword stuffing is not a concern (controlled data entry)

**Verdict:** Built-in search provides 90% of the value with 10% of the complexity. Ship it first, iterate if users complain about relevance.

### Decision: tsvector column approach

**Implementation strategy:**

Add `search_vector tsvector` column to each searchable table with automatic trigger updates:

```sql
-- Add search column
ALTER TABLE samples
ADD COLUMN search_vector tsvector;

-- Create GIN index
-- Development: Use regular CREATE INDEX
-- Production: Use CREATE INDEX CONCURRENTLY to avoid table locks
CREATE INDEX samples_search_idx
ON samples USING GIN(search_vector);

-- Auto-update trigger
CREATE TRIGGER samples_search_update
BEFORE INSERT OR UPDATE ON samples
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(
    search_vector,
    'pg_catalog.english',  -- Start with English, add Vietnamese later
    sample_id,
    description
);
```

**Why tsvector column vs expression index:**

| Approach | Pros | Cons |
|----------|------|------|
| **tsvector column** (selected) | Fast query (pre-computed), simple trigger | Extra column storage |
| Expression index | No extra column | Slower (computed on-the-fly) |

**Trade-off accepted:** Small storage overhead (<5% for text columns) is worth the query performance gain.

### Decision: Vietnamese language support

PostgreSQL supports Vietnamese through:

1. **Simple dictionary (unaccented):**
   ```sql
   -- Remove Vietnamese diacritics for broader matching
   SELECT to_tsvector('simple', unaccent('Huyết thanh'));
   -- Result: 'huyet':1 'thanh':2
   ```

2. **English dictionary with Vietnamese stopwords:**
   ```sql
   -- Use English tokenization, add Vietnamese stopwords later
   SELECT to_tsvector('english', 'Huyết thanh sinh học');
   ```

**Strategy:**
1. Start with `'simple'` dictionary + `unaccent()` for diacritic-insensitive search
2. Add Vietnamese stopwords file if needed (và, của, được, etc.)
3. Evaluate custom dictionary post-deployment based on user feedback

**Installation:**
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Decision: Index strategy

Create GIN indexes on each searchable table:

| Table | Indexed Columns | Index Name | Language Config |
|-------|----------------|------------|-----------------|
| samples | sample_id, description | samples_search_idx | simple + unaccent |
| clients | name, contact_name, address | clients_search_idx | simple + unaccent |
| assay_definitions | name, method_name, description | assays_search_idx | simple + unaccent |
| results | value, comments | results_search_idx | simple + unaccent |
| audit_logs | action, old_data::text, new_data::text | audit_logs_search_idx | simple + unaccent |

**GIN vs GiST:**
- **GIN** (selected): Faster queries, slower updates, larger index
- **GiST**: Faster updates, slower queries, smaller index

**Rationale:** LIMS workloads have infrequent writes and frequent reads. GIN is optimal.

### Decision: RLS enforcement in search

**Built-in search automatically inherits RLS policies** because search happens on the same table:

```sql
CREATE OR REPLACE FUNCTION search_samples(search_query TEXT, max_results INT DEFAULT 20)
RETURNS TABLE(id UUID, sample_id TEXT, description TEXT, rank REAL)
LANGUAGE sql
SECURITY INVOKER  -- Inherits caller's permissions
AS $$
    SELECT
        id,
        sample_id,
        description,
        ts_rank(search_vector, query) AS rank
    FROM samples, to_tsquery('simple', search_query) query
    WHERE search_vector @@ query
      AND deleted_at IS NULL  -- RLS policies automatically applied
    ORDER BY rank DESC
    LIMIT max_results;
$$;
```

**Important notes:**
- Search functions MUST use `SECURITY INVOKER` to respect caller's role
- No JOIN required (unlike BM25 implementations)
- RLS policies on `samples` table automatically apply

### Decision: Manager-only audit log search

Audit log search is restricted to managers due to compliance sensitivity:

```sql
-- RLS policy on audit_logs table (already exists)
CREATE POLICY "Only managers can search audit logs"
ON audit_logs FOR SELECT
USING (get_user_role() = 'manager');

-- Search function validates role implicitly through RLS
CREATE OR REPLACE FUNCTION search_audit_logs(search_query TEXT, max_results INT DEFAULT 20)
RETURNS TABLE(id UUID, action TEXT, old_data JSONB, new_data JSONB, rank REAL)
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT
        id,
        action,
        old_data,
        new_data,
        ts_rank(search_vector, query) AS rank
    FROM audit_logs, to_tsquery('simple', search_query) query
    WHERE search_vector @@ query
      AND deleted_at IS NULL  -- RLS automatically enforces manager-only access
    ORDER BY rank DESC
    LIMIT max_results;
$$;
```

## Risks / Trade-offs

### Risk: Ranking quality vs BM25
- **Impact**: Low - PostgreSQL's `ts_rank` may produce less optimal ranking than BM25
- **Mitigation**:
  - LIMS users search to find, not rank (top 20 results is sufficient)
  - Can tune ranking with `ts_rank_cd()` (cover density) if needed
  - Can add ranking weights to prioritize certain fields
  - Accept "good enough" ranking, iterate if users complain
  - BM25 can be added later if proven necessary (without breaking changes)

### Risk: Vietnamese diacritic handling
- **Impact**: Low - Users may search with or without diacritics
- **Mitigation**:
  - Use `unaccent()` for diacritic-insensitive search
  - Test with real Vietnamese LIMS data
  - Collect user feedback on search quality
  - Add custom dictionary if needed

### Risk: Query syntax complexity
- **Impact**: Low - Users must learn search syntax (AND, OR, NOT)
- **Mitigation**:
  - Use `plainto_tsquery()` for simple space-separated queries
  - Add UI hints for advanced syntax
  - Document search examples in user guide
  - Start simple, add advanced features based on demand

### Risk: Storage overhead for tsvector columns
- **Impact**: Very Low - ~5% increase in table size
- **Mitigation**:
  - LIMS databases are small (<100k samples)
  - Storage is cheap compared to developer time
  - Monitor table sizes in production
  - Worth the query performance gain

## Migration Plan

### Phase 1: Install unaccent extension (5 minutes)

```sql
-- Migration XXX: Install unaccent extension for Vietnamese search
-- Description: Enables diacritic-insensitive search

SET search_path TO public;

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Test
SELECT unaccent('Huyết thanh');  -- Expected: "Huyet thanh"
```

### Phase 2: Add tsvector columns and triggers (Day 1)

```sql
-- Migration XXX: Add full-text search to samples

SET search_path TO public;

-- Add tsvector column
ALTER TABLE samples
ADD COLUMN search_vector tsvector;

-- Create GIN index
CREATE INDEX samples_search_idx
ON samples USING GIN(search_vector);

-- Create trigger function (reusable for all tables)
CREATE OR REPLACE FUNCTION update_search_vector_simple()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Combine columns and apply unaccent
    NEW.search_vector := to_tsvector(
        'simple',
        unaccent(
            COALESCE(NEW.sample_id, '') || ' ' ||
            COALESCE(NEW.description, '')
        )
    );
    RETURN NEW;
END;
$$;

-- Create trigger
-- NOTE: Only trigger on relevant column changes to reduce overhead
CREATE TRIGGER samples_search_update
BEFORE INSERT OR UPDATE OF sample_id, description ON samples
FOR EACH ROW EXECUTE FUNCTION update_search_vector_simple();

-- Backfill existing data
UPDATE samples SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(sample_id, '') || ' ' ||
        COALESCE(description, '')
    )
);
```

**Repeat for other tables:**
- `clients` (name, contact_name, address)
- `assay_definitions` (name, method_name, description)
- `results` (value, comments)
- `audit_logs` (action, old_data::text, new_data::text)

**IMPORTANT - Exclude search_vector from audit logs:**

Since `search_vector` is auto-generated and doesn't represent user changes, it should be excluded from audit log change diffs to reduce noise:

```sql
-- Update audit trigger function to exclude search_vector
-- This assumes you have an audit trigger function that captures old_data/new_data JSONB
-- Modify the function to exclude search_vector column:

CREATE OR REPLACE FUNCTION trigger_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_row JSONB;
    new_row JSONB;
BEGIN
    -- Convert rows to JSONB, excluding search_vector
    IF TG_OP = 'DELETE' THEN
        old_row := to_jsonb(OLD) - 'search_vector';
        new_row := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        old_row := to_jsonb(OLD) - 'search_vector';
        new_row := to_jsonb(NEW) - 'search_vector';
    ELSIF TG_OP = 'INSERT' THEN
        old_row := NULL;
        new_row := to_jsonb(NEW) - 'search_vector';
    END IF;

    -- Insert audit log entry
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        user_id
    ) VALUES (
        TG_TABLE_NAME::TEXT,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        old_row,
        new_row,
        auth.uid()
    );

    RETURN NEW;
END;
$$;
```

**Rationale:** `search_vector` changes on every update (even when only timestamps change). Including it in audit logs creates excessive noise without providing compliance value.

### Phase 3: Create search functions (Day 1)

```sql
-- Migration XXX: Create search functions

SET search_path TO public;

-- Search samples
CREATE OR REPLACE FUNCTION search_samples(search_query TEXT, max_results INT DEFAULT 20)
RETURNS TABLE(id UUID, sample_id TEXT, description TEXT, rank REAL)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT
        id,
        sample_id,
        description,
        ts_rank(search_vector, query) AS rank
    FROM samples, plainto_tsquery('simple', unaccent(search_query)) query
    WHERE search_vector @@ query
      AND deleted_at IS NULL
    ORDER BY rank DESC
    LIMIT max_results;
$$;

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION search_samples TO authenticated;

-- Similar functions for:
-- search_clients(search_query TEXT, max_results INT)
-- search_assays(search_query TEXT, max_results INT)
-- search_results(search_query TEXT, max_results INT)
-- search_audit_logs(search_query TEXT, max_results INT)  -- RLS enforces manager-only
```

### Phase 4: Application Integration (Day 2-3)

1. Create search Server Actions (`src/app/actions/search.ts`)
2. Add search data fetching utilities (`src/lib/data/search.ts`)
3. Build global search UI component (`src/components/global-search.tsx`)
4. Integrate with existing navigation (Cmd+K shortcut)

### Phase 5: Testing and Tuning (Day 3)

1. Test with Vietnamese sample data
2. Verify RLS policies are enforced
3. Check search performance (should be <50ms)
4. Tune ranking if needed:
   ```sql
   -- Advanced: Use weighted ranking
   ts_rank_cd(
       setweight(to_tsvector('simple', sample_id), 'A') ||  -- High priority
       setweight(to_tsvector('simple', description), 'B'),  -- Lower priority
       query
   )
   ```

### Migration Security Best Practices

Following the project's Migration Security Checklist (CLAUDE.md):

**1. Always use DROP POLICY IF EXISTS before CREATE POLICY:**

```sql
-- BAD: Creates duplicate policies if migration is re-run
CREATE POLICY "policy_name" ON table_name ...

-- GOOD: Ensures clean state
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ON table_name ...
```

**2. Always run security tests after migration:**

```bash
# Apply migration
Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Run security tests (MANDATORY)
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"

# Verify all tests passed
# If any test fails, investigate immediately before proceeding
```

**3. Verify policy state after migration:**

```bash
# Check that old policies are removed and new policies exist
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass ORDER BY polname;"

# Verify policy includes role checks (for critical operations)
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass AND polcmd = 'a';"
```

**4. Index creation considerations:**

```sql
-- Development: Regular index creation (fast, but locks table)
CREATE INDEX samples_search_idx ON samples USING GIN(search_vector);

-- Production: Concurrent index creation (slower, but no table lock)
-- Use this when applying migrations to live databases with active users
CREATE INDEX CONCURRENTLY samples_search_idx ON samples USING GIN(search_vector);
```

**Note:** This search implementation does NOT create or modify RLS policies (search functions inherit existing policies via SECURITY INVOKER), so policy verification is less critical. However, the audit log exclusion changes (Phase 2) DO modify trigger functions and should be tested thoroughly.

### Rollback Procedure

If issues arise:

1. **Application layer**: Remove search UI/actions (no data loss)
2. **Database layer**: Drop columns and functions
   ```sql
   -- Drop search functions
   DROP FUNCTION IF EXISTS search_samples CASCADE;
   DROP FUNCTION IF EXISTS search_clients CASCADE;
   DROP FUNCTION IF EXISTS search_assays CASCADE;
   DROP FUNCTION IF EXISTS search_results CASCADE;
   DROP FUNCTION IF EXISTS search_audit_logs CASCADE;

   -- Drop triggers and columns (if needed)
   DROP TRIGGER IF EXISTS samples_search_update ON samples;
   ALTER TABLE samples DROP COLUMN IF EXISTS search_vector;
   DROP INDEX IF EXISTS samples_search_idx;

   -- Drop helper function
   DROP FUNCTION IF EXISTS update_search_vector_simple CASCADE;

   -- Drop extension (if no other features use it)
   DROP EXTENSION IF EXISTS unaccent CASCADE;
   ```

Data remains intact; only search capability is removed.

## Performance Expectations

**Expected query performance (GIN index):**
- 10k samples: ~10-20ms
- 100k samples: ~50-100ms
- 1M samples: ~200-500ms

**LIMS typical workload:**
- Dataset size: 10k-100k samples
- Expected performance: **<50ms** (well within acceptable range)

**Index size overhead:**
- tsvector storage: ~10-20% of text column size
- GIN index: ~50% of tsvector size
- Total overhead: ~15-30% (acceptable)

## Open Questions

1. **Search result pagination**: Use offset-based or cursor-based pagination for large result sets?
2. **Vietnamese stopwords**: Should we create custom Vietnamese stopwords list immediately or wait for feedback?
3. **Rate limiting**: Should global search have rate limits to prevent abuse?
4. **Ranking weights**: Should we prioritize sample_id matches over description matches?
5. **Phrase search**: Should we support exact phrase matching with quotes (e.g., "huyết thanh")?

## Future Enhancements (Phase 2+)

If users request better search quality:

1. **Weighted ranking**: Prioritize certain fields (e.g., sample_id > description)
2. **Phrase search**: Support exact phrase matching with quotes
3. **Synonym support**: Map common terms (e.g., "blood" → "huyết")
4. **Fuzzy matching**: Typo tolerance via trigram similarity
5. **BM25 ranking**: Add plpgsql_bm25 if proven necessary (non-breaking change)
6. **Semantic search**: Add pgvector for embedding-based search (requires separate planning)

**Philosophy:** Start simple, iterate based on real user feedback. Don't over-engineer.

## References

- PostgreSQL Full-Text Search: https://www.postgresql.org/docs/current/textsearch.html
- Vietnamese tokenization: https://www.postgresql.org/docs/current/unaccent.html
- GIN vs GiST indexes: https://www.postgresql.org/docs/current/textsearch-indexes.html
- ts_rank documentation: https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING
