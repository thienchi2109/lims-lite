# PostgreSQL Full-Text Search Setup Guide

## Overview

This guide explains how PostgreSQL full-text search (FTS) is implemented in CDC-LIMS for Vietnamese-language content search with diacritic-insensitive matching.

## What is Full-Text Search?

Full-text search allows natural language queries against textual data, providing:

- **Relevance ranking** (ts_rank) - Results sorted by relevance score
- **Stemming and normalization** - "testing" matches "test", "tests", etc.
- **Language support** - Vietnamese diacritic handling via `unaccent()`
- **Performance** - GIN indexes provide sub-50ms query times for 10k+ rows

## Architecture Components

### 1. tsvector Column

A `tsvector` is a sorted list of distinct lexemes (normalized words) optimized for search.

```sql
-- Sample tsvector content
'blood':3 'patient':2 'sample':1 'urgent':4
```

Each number indicates the position of the lexeme in the original text.

### 2. GIN Index

**GIN (Generalized Inverted Index)** provides fast full-text search by indexing lexemes.

```sql
CREATE INDEX samples_search_idx
ON samples USING GIN(search_vector);
```

**Performance characteristics:**
- Query time: O(log n) - Fast lookups
- Index size: 15-30% of table size
- Update cost: Higher than B-tree (batch updates recommended)

### 3. Automatic Triggers

Triggers keep `search_vector` synchronized with source columns:

```sql
CREATE TRIGGER samples_search_update
BEFORE INSERT OR UPDATE OF sample_id, description ON samples
FOR EACH ROW EXECUTE FUNCTION update_search_vector_samples();
```

**Important:** Only trigger on relevant columns to minimize overhead.

### 4. Search Functions

RPC functions provide application-level search interface:

```sql
CREATE FUNCTION search_samples(
    search_query TEXT,
    max_results INT DEFAULT 20
)
RETURNS TABLE (id UUID, sample_id TEXT, rank REAL)
LANGUAGE plpgsql
SECURITY INVOKER;
```

**SECURITY INVOKER** ensures RLS policies are enforced (critical for compliance).

## Vietnamese Language Support

### The unaccent Extension

`unaccent()` removes diacritical marks from text, making "Máu" and "Mau" return identical results.

```sql
-- Install extension (migration 068)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Usage
SELECT unaccent('Huyết thanh');  -- Returns: Huyet thanh
```

### Search Vector Creation

Apply `unaccent()` during indexing:

```sql
NEW.search_vector := to_tsvector(
    'simple',  -- Use 'simple' dictionary (no stemming)
    unaccent(
        COALESCE(NEW.sample_id, '') || ' ' ||
        COALESCE(NEW.description, '')
    )
);
```

**Why 'simple' dictionary?**
- Vietnamese is not supported by PostgreSQL's language-specific dictionaries
- 'simple' provides basic lexeme extraction without stemming
- `unaccent()` handles Vietnamese normalization

### Query Processing

Apply `unaccent()` during query:

```sql
plainto_tsquery('simple', unaccent('Huyết thanh'))
```

This ensures queries match indexed content regardless of diacritics.

## Query Syntax

### plainto_tsquery() (Recommended)

**Safe for user input** - Automatically escapes special characters.

```sql
SELECT * FROM search_samples('C++ programming', 10);
-- Works without syntax errors
```

**Limitations:**
- No AND/OR operators
- No phrase search
- Treats all words as AND by default

### to_tsquery() (Advanced)

**Requires careful input sanitization** - Allows operators but can cause syntax errors.

```sql
-- Valid syntax
to_tsquery('simple', 'blood & urgent')  -- AND
to_tsquery('simple', 'blood | serum')   -- OR
to_tsquery('simple', 'blood & !urgent') -- NOT

-- Invalid syntax (user input can break this)
to_tsquery('simple', 'C++')  -- Syntax error!
```

**Recommendation:** Use `plainto_tsquery()` for all user-facing search features.

## Ranking Results

### ts_rank Function

Calculates relevance score based on lexeme frequency and position:

```sql
SELECT
    sample_id,
    ts_rank(search_vector, query) as rank
FROM samples,
     plainto_tsquery('simple', unaccent('blood')) query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

**Rank values:**
- 0.0 to 1.0 (typical range)
- Higher = more relevant
- Depends on lexeme frequency and document length

### Weighted Ranking (Optional)

Assign different weights to columns:

```sql
ts_rank_cd(
    setweight(to_tsvector('simple', sample_id), 'A') ||      -- High priority
    setweight(to_tsvector('simple', description), 'B') ||    -- Medium priority
    setweight(to_tsvector('simple', notes), 'C'),            -- Low priority
    query
)
```

**Weight labels:** A (highest), B, C, D (lowest)

## Implementation Patterns

### Adding Search to a Table

**Step 1: Add tsvector column**
```sql
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS search_vector tsvector;
```

**Step 2: Create trigger function**
```sql
CREATE OR REPLACE FUNCTION update_search_vector_clients()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector := to_tsvector(
        'simple',
        unaccent(
            COALESCE(NEW.name, '') || ' ' ||
            COALESCE(NEW.phone, '') || ' ' ||
            COALESCE(NEW.address, '')
        )
    );
    RETURN NEW;
END;
$$;
```

**Step 3: Create trigger**
```sql
DROP TRIGGER IF EXISTS clients_search_update ON clients;
CREATE TRIGGER clients_search_update
BEFORE INSERT OR UPDATE OF name, phone, address ON clients
FOR EACH ROW EXECUTE FUNCTION update_search_vector_clients();
```

**Step 4: Create GIN index**
```sql
-- Development (fast, locks table)
CREATE INDEX IF NOT EXISTS clients_search_idx
ON clients USING GIN(search_vector);

-- Production (slow, no locks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS clients_search_idx
ON clients USING GIN(search_vector);
```

**Step 5: Backfill existing data**
```sql
UPDATE clients SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(name, '') || ' ' ||
        COALESCE(phone, '') || ' ' ||
        COALESCE(address, '')
    )
)
WHERE search_vector IS NULL;  -- Idempotent
```

**Step 6: Create search function**
```sql
CREATE OR REPLACE FUNCTION search_clients(
    search_query TEXT,
    max_results INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.phone,
        ts_rank(c.search_vector, query) as rank
    FROM clients c,
         plainto_tsquery('simple', unaccent(search_query)) query
    WHERE c.search_vector @@ query
      AND c.deleted_at IS NULL
    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

GRANT EXECUTE ON FUNCTION search_clients TO authenticated;
```

### Global Search Pattern

Search across multiple entity types:

```sql
CREATE OR REPLACE FUNCTION global_search(
    search_query TEXT,
    max_results INT DEFAULT 20
)
RETURNS TABLE (
    entity_type TEXT,
    entity_id UUID,
    display_text TEXT,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    WITH all_results AS (
        SELECT 'sample'::TEXT as entity_type, id, sample_id as display_text, ts_rank(search_vector, query) as rank
        FROM samples, plainto_tsquery('simple', unaccent(search_query)) query
        WHERE search_vector @@ query AND deleted_at IS NULL

        UNION ALL

        SELECT 'client'::TEXT, id, name, ts_rank(search_vector, query)
        FROM clients, plainto_tsquery('simple', unaccent(search_query)) query
        WHERE search_vector @@ query AND deleted_at IS NULL

        UNION ALL

        SELECT 'assay'::TEXT, id, name, ts_rank(search_vector, query)
        FROM assay_definitions, plainto_tsquery('simple', unaccent(search_query)) query
        WHERE search_vector @@ query AND deleted_at IS NULL
    )
    SELECT * FROM all_results
    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;
```

## Performance Optimization

### Index Size Monitoring

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
    pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size
FROM pg_indexes
WHERE indexname LIKE '%_search_idx'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

**Expected overhead:** 15-30% of table size.

### Query Performance Monitoring

```sql
-- Enable query timing
\timing on

-- Test query performance
SELECT COUNT(*) FROM search_samples('blood', 100);

-- Expected: < 50ms for tables with 10k+ rows
```

### Index Maintenance

GIN indexes are automatically maintained by PostgreSQL. For large batch operations:

```sql
-- Disable autovacuum before bulk inserts
ALTER TABLE samples SET (autovacuum_enabled = false);

-- Perform bulk operation
INSERT INTO samples (...) VALUES (...);

-- Re-enable autovacuum
ALTER TABLE samples SET (autovacuum_enabled = true);

-- Manual vacuum
VACUUM ANALYZE samples;
```

## Troubleshooting

### Issue: Search returns no results

**Diagnosis:**
```sql
-- Check if search_vector is populated
SELECT sample_id, search_vector FROM samples LIMIT 5;

-- Should show tsvector content like: 'blood':1 'sample':2
```

**Solution:**
```sql
-- Manually trigger search_vector update
UPDATE samples SET search_vector = to_tsvector(
    'simple',
    unaccent(COALESCE(sample_id, '') || ' ' || COALESCE(description, ''))
);
```

### Issue: Vietnamese search not working

**Diagnosis:**
```sql
-- Check if unaccent extension is installed
SELECT * FROM pg_extension WHERE extname = 'unaccent';

-- Test unaccent function
SELECT unaccent('Huyết thanh');  -- Should return "Huyet thanh"
```

**Solution:**
```sql
-- Install unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Issue: Slow query performance

**Diagnosis:**
```sql
-- Check if GIN index exists
SELECT * FROM pg_indexes WHERE tablename = 'samples' AND indexname LIKE '%_search_idx';

-- Check query plan
EXPLAIN ANALYZE
SELECT * FROM search_samples('blood', 10);

-- Look for "Bitmap Index Scan on samples_search_idx"
```

**Solution:**
```sql
-- Create index if missing
CREATE INDEX CONCURRENTLY samples_search_idx
ON samples USING GIN(search_vector);

-- Rebuild index if corrupted
REINDEX INDEX CONCURRENTLY samples_search_idx;
```

### Issue: RLS violation errors

**Diagnosis:**
```sql
-- Check if function uses SECURITY INVOKER
SELECT proname, prosecdef
FROM pg_proc
WHERE proname LIKE 'search_%';

-- prosecdef should be 'f' (false) for SECURITY INVOKER
```

**Solution:**
```sql
-- Recreate function with SECURITY INVOKER
CREATE OR REPLACE FUNCTION search_samples(...)
RETURNS TABLE (...)
LANGUAGE plpgsql
SECURITY INVOKER  -- Critical for RLS enforcement
AS $$ ... $$;
```

## Testing

### SQL Test Suite

See `tests/search.test.sql` for comprehensive test scenarios:

1. **ts_rank ranking** - Verify relevant results rank higher
2. **Empty query handling** - Test with empty strings, whitespace
3. **RLS enforcement** - Test with analyst and manager roles
4. **Vietnamese diacritics** - Test "Máu" vs "Mau" return same results
5. **Global search** - Test cross-entity search
6. **Performance** - Verify queries complete in < 50ms

### Manual Testing Checklist

- [ ] Sample search by ID
- [ ] Sample search by client name
- [ ] Client search by contact info
- [ ] Assay search by method name
- [ ] Audit log search (manager only)
- [ ] Analyst denied audit log search
- [ ] Global search across entities
- [ ] Vietnamese query with diacritics
- [ ] Vietnamese query without diacritics
- [ ] Empty query returns empty results
- [ ] Search performance < 50ms for 10k samples

## Migration to Production

See `docs/DEPLOYMENT_SEARCH.md` for complete production deployment guide with zero downtime using CREATE INDEX CONCURRENTLY.

**Key differences:**

| Feature | Development | Production |
|---------|-------------|------------|
| CREATE INDEX | Regular (fast, locks table) | CONCURRENTLY (slow, no locks) |
| Downtime | Acceptable | Zero downtime required |
| Transaction support | Inside BEGIN...COMMIT | Cannot use transactions |
| Backfill strategy | One-time UPDATE | Idempotent with WHERE clause |

## Reference

### SQL Functions

- `to_tsvector(config, text)` - Convert text to tsvector
- `plainto_tsquery(config, text)` - Convert text to tsquery (safe)
- `to_tsquery(config, text)` - Convert text to tsquery (advanced)
- `ts_rank(tsvector, tsquery)` - Calculate relevance rank
- `ts_rank_cd(tsvector, tsquery)` - Rank with cover density
- `unaccent(text)` - Remove diacritical marks

### Operators

- `@@` - Match operator: `search_vector @@ query`
- `||` - Concatenate tsvectors: `vec1 || vec2`

### Configuration

- `'simple'` - Basic lexeme extraction, no stemming
- `'english'` - English stemming rules
- `'vietnamese'` - Not supported in PostgreSQL core

### Index Types

- **GIN (Generalized Inverted Index)** - Fast search, slower updates
- **GiST (Generalized Search Tree)** - Slower search, faster updates

**Recommendation:** Use GIN for LIMS workloads (read-heavy).

## See Also

- [PostgreSQL Full-Text Search Documentation](https://www.postgresql.org/docs/current/textsearch.html)
- [PostgreSQL unaccent Extension](https://www.postgresql.org/docs/current/unaccent.html)
- `docs/DEPLOYMENT_SEARCH.md` - Production deployment guide
- `supabase/migrations/075_create_search_functions.sql` - Search function implementations
- `CLAUDE.md` - Search patterns reference
