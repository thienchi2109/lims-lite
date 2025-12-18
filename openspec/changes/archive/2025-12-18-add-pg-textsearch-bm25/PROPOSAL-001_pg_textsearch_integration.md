# OpenSpec Change Proposal: pg_textsearch Integration

**Proposal ID:** PROPOSAL-001
**Title:** Add pg_textsearch (BM25 Full-Text Search) to CDC-LIMS
**Author:** Architecture Team
**Status:** Draft
**Created:** 2025-12-17
**Last Updated:** 2025-12-17

---

## Executive Summary

This proposal outlines the integration of pg_textsearch, Timescale's Rust-based BM25 full-text search extension, into the CDC-LIMS self-hosted Supabase PostgreSQL infrastructure. The integration will provide superior full-text search capabilities compared to PostgreSQL's built-in `ts_rank`, enabling fast, relevance-ranked search across samples, clients, tests, and audit logs.

### Key Benefits

1. **BM25 Ranking Algorithm** - Industry-standard relevance ranking (same algorithm used by Elasticsearch)
2. **Superior Performance** - Memtable architecture for fast in-memory indexing
3. **Hybrid Search Ready** - Can combine with pgvector for future AI/semantic search features
4. **Compliance-Friendly** - Read-only search operations maintain audit integrity

### Scope

- Custom PostgreSQL Docker image with pg_textsearch extension
- Database migrations for search indexes and helper functions
- Search API endpoints for LIMS entities
- Integration with existing RLS policies

---

## 1. Problem Statement

### Current State

The CDC-LIMS system currently lacks sophisticated full-text search capabilities. Users must rely on:

1. **LIKE/ILIKE queries** - Slow, no relevance ranking, poor UX
2. **PostgreSQL built-in tsvector/ts_rank** - Basic functionality, limited relevance tuning
3. **Manual filtering** - Users manually scan through lists

### Pain Points

| Use Case | Current Approach | Limitation |
|----------|------------------|------------|
| Find sample by partial ID | `LIKE '%ABC%'` | No relevance, slow on large datasets |
| Search client names | Case-sensitive match | Misses variations, typos |
| Search audit logs | Text field filtering | Cannot search across multiple fields |
| Find test by method | Multiple JOINs | Complex queries, poor performance |

### Compliance Impact

For 21 CFR Part 11 compliance investigations, managers need to quickly search audit logs for specific actions, users, or records. Current search is inadequate for compliance audits.

---

## 2. Proposed Solution

### Technology Choice: pg_textsearch

**pg_textsearch** is a Rust-based PostgreSQL extension developed by Timescale that provides:

| Feature | Description |
|---------|-------------|
| BM25 Ranking | Okapi BM25 algorithm for relevance scoring |
| Memtable Architecture | Fast in-memory indexing with configurable spill threshold |
| Inverted Index | Efficient term-to-document mapping |
| Configurable Parameters | k1, b values for ranking tuning |
| Multi-language Support | Via text_config parameter |
| Hybrid Search | Compatible with pgvector for semantic search |

### Why Not Alternatives?

| Alternative | Reason Not Chosen |
|-------------|-------------------|
| Elasticsearch | Additional infrastructure, operational complexity, cost |
| PostgreSQL ts_rank | Inferior ranking quality, limited tuning |
| Meilisearch | External service, data synchronization overhead |
| Algolia | Cloud-only, cost, data sovereignty concerns |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Application                      │
│                    (Search Components)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ Server Actions
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgREST / Kong                           │
│                   (API Gateway)                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ SQL/RPC
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL 15 + pg_textsearch                   │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ textsearch_idx  │  │   RLS Policies  │                   │
│  │ (BM25 indexes)  │  │  (unchanged)    │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technical Design

### 3.1 Custom Docker Image

Since pg_textsearch is not included in the standard Supabase PostgreSQL image, we must create a custom image that:

1. Extends `supabase/postgres:15.8.1.085`
2. Installs Rust toolchain and build dependencies
3. Builds and installs pg_textsearch extension
4. Maintains all existing Supabase functionality

### 3.2 Extension Configuration

pg_textsearch provides several tunable parameters:

| Parameter | Default | Description | Recommended for LIMS |
|-----------|---------|-------------|---------------------|
| `k1` | 1.2 | Term frequency saturation | 1.2 (default) |
| `b` | 0.75 | Document length normalization | 0.75 (default) |
| `text_config` | 'english' | Language configuration | 'vietnamese' for Vietnamese content |
| `memtable_spill_threshold` | 800,000 | Posting entries before disk spill | 800,000 (default) |

### 3.3 Index Strategy

Create BM25 indexes on the following tables/columns:

| Table | Indexed Columns | Purpose |
|-------|-----------------|---------|
| `samples` | sample_id, client_name | Sample lookup |
| `clients` | name, contact_name, address | Client search |
| `assay_definitions` | name, description | Test catalog search |
| `methods` | name, description, procedure_reference | Method lookup |
| `results` | value (text), comments | Result search |
| `audit_logs` | operation, old_values, new_values | Compliance investigation |

### 3.4 RLS Compatibility

pg_textsearch operates at the SQL level and respects RLS policies. All search queries will:

1. Execute through authenticated user context
2. Apply existing RLS policies to filter results
3. Return only records the user is authorized to view

---

## 4. Implementation Plan

### Phase 1: Infrastructure Setup (Day 1-2)

**Step 1.1: Create Custom PostgreSQL Dockerfile**

**Files to create:**
- `docker/postgres/Dockerfile.pg_textsearch`

**Changes required:**
```dockerfile
# Base image: Supabase PostgreSQL 15
FROM supabase/postgres:15.8.1.085

# Install build dependencies
USER root
RUN apt-get update && apt-get install -y \
    build-essential \
    clang \
    libclang-dev \
    llvm-dev \
    pkg-config \
    libssl-dev \
    postgresql-server-dev-15 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Rust toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install cargo-pgrx (PostgreSQL extension toolkit)
RUN cargo install cargo-pgrx --version ~0.11.3 --locked

# Initialize pgrx for PostgreSQL 15
RUN cargo pgrx init --pg15 /usr/lib/postgresql/15/bin/pg_config

# Clone and build pg_textsearch
WORKDIR /tmp
RUN git clone --depth 1 https://github.com/timescale/pg_textsearch.git
WORKDIR /tmp/pg_textsearch
RUN cargo pgrx install --release --pg-config /usr/lib/postgresql/15/bin/pg_config

# Cleanup build dependencies (optional, reduces image size)
RUN apt-get remove -y build-essential clang libclang-dev llvm-dev \
    && apt-get autoremove -y \
    && rm -rf /tmp/pg_textsearch /root/.cargo /root/.rustup

# Switch back to postgres user
USER postgres

# Preload the extension (optional)
# RUN echo "shared_preload_libraries = 'pg_textsearch'" >> /etc/postgresql/postgresql.conf
```

**Validation:**
- Build image successfully: `docker build -t lims-postgres-textsearch:15 -f docker/postgres/Dockerfile.pg_textsearch docker/postgres/`
- Image size reasonable (< 1.5GB)
- Extension files present in image

**Risks:**
- Build may fail if Timescale changes repository structure
- Rust/pgrx version compatibility issues
- Image size increase (~500MB for Rust toolchain, reduced after cleanup)

**Estimated complexity:** High

---

**Step 1.2: Update docker-compose.yml**

**Files to modify:**
- `docker-compose.yml`

**Changes required:**
```yaml
services:
  postgres:
    # BEFORE:
    # image: supabase/postgres:15.8.1.085

    # AFTER:
    build:
      context: ./docker/postgres
      dockerfile: Dockerfile.pg_textsearch
    container_name: lims-postgres
    # ... rest of configuration unchanged
```

**Validation:**
- `docker compose up -d` starts successfully
- `docker compose ps` shows postgres as healthy
- Connect to database and verify extension is available

**Risks:**
- Existing data volumes must be compatible
- Build time increases first startup

**Estimated complexity:** Low

---

**Step 1.3: Add Docker Build Context Directory**

**Files to create:**
- `docker/postgres/.dockerignore`

**Changes required:**
```
# docker/postgres/.dockerignore
# Ignore unnecessary files during build
*.md
*.txt
.git
.gitignore
```

**Validation:**
- Build context is minimal
- Docker build succeeds

**Risks:** None

**Estimated complexity:** Low

---

### Phase 2: Extension Installation (Day 2)

**Step 2.1: Create Extension Installation Migration**

**Files to create:**
- `supabase/migrations/068_install_pg_textsearch.sql`

**Changes required:**
```sql
-- Migration 068: Install pg_textsearch Extension
-- Security Impact: None (extension installation only)
-- Changes: Enables pg_textsearch extension for BM25 full-text search

SET search_path TO public;

-- Install the extension (requires superuser, which postgres user has)
CREATE EXTENSION IF NOT EXISTS pg_textsearch;

-- Verify installation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_textsearch'
    ) THEN
        RAISE EXCEPTION 'pg_textsearch extension failed to install';
    END IF;

    RAISE NOTICE 'pg_textsearch extension installed successfully';
END$$;

-- Document the extension
COMMENT ON EXTENSION pg_textsearch IS
    'Timescale BM25 full-text search extension for CDC-LIMS';
```

**Validation:**
- Migration applies without errors
- `SELECT * FROM pg_extension WHERE extname = 'pg_textsearch';` returns one row

**Risks:**
- Extension not found if Dockerfile build failed
- Superuser permissions required

**Estimated complexity:** Low

---

### Phase 3: Search Indexes (Day 2-3)

**Step 3.1: Create BM25 Indexes Migration**

**Files to create:**
- `supabase/migrations/069_create_textsearch_indexes.sql`

**Changes required:**
```sql
-- Migration 069: Create BM25 Search Indexes
-- Security Impact: None (index creation only, respects RLS)
-- Changes: Creates pg_textsearch indexes for LIMS search functionality

SET search_path TO public;

-- ============================================================================
-- SAMPLES SEARCH INDEX
-- Purpose: Fast search on sample IDs and client names
-- ============================================================================

-- Create search index on samples table
-- Uses COALESCE to handle nullable fields
CREATE INDEX IF NOT EXISTS idx_samples_textsearch
ON public.samples
USING textsearch (
    sample_id || ' ' || COALESCE(client_name, '')
) WITH (
    text_config = 'english'
);

COMMENT ON INDEX idx_samples_textsearch IS
    'BM25 search index for sample identification and client lookup';

-- ============================================================================
-- CLIENTS SEARCH INDEX
-- Purpose: Search client names, contacts, and addresses
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_clients_textsearch
ON public.clients
USING textsearch (
    COALESCE(name, '') || ' ' ||
    COALESCE(contact_name, '') || ' ' ||
    COALESCE(contact_email, '') || ' ' ||
    COALESCE(address, '')
) WITH (
    text_config = 'english'
);

COMMENT ON INDEX idx_clients_textsearch IS
    'BM25 search index for client directory search';

-- ============================================================================
-- ASSAY DEFINITIONS SEARCH INDEX
-- Purpose: Search test catalog by name and description
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_assays_textsearch
ON public.assay_definitions
USING textsearch (
    COALESCE(name, '') || ' ' || COALESCE(description, '')
) WITH (
    text_config = 'english'
);

COMMENT ON INDEX idx_assays_textsearch IS
    'BM25 search index for test catalog lookup';

-- ============================================================================
-- METHODS SEARCH INDEX
-- Purpose: Search laboratory methods
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_methods_textsearch
ON public.methods
USING textsearch (
    COALESCE(name, '') || ' ' ||
    COALESCE(description, '') || ' ' ||
    COALESCE(procedure_reference, '')
) WITH (
    text_config = 'english'
);

COMMENT ON INDEX idx_methods_textsearch IS
    'BM25 search index for laboratory methods lookup';

-- ============================================================================
-- AUDIT LOGS SEARCH INDEX
-- Purpose: Compliance investigation - search audit trail
-- ============================================================================

-- Note: JSONB fields are cast to text for search
CREATE INDEX IF NOT EXISTS idx_audit_logs_textsearch
ON public.audit_logs
USING textsearch (
    table_name || ' ' ||
    operation || ' ' ||
    COALESCE(record_id::text, '') || ' ' ||
    COALESCE(old_values::text, '') || ' ' ||
    COALESCE(new_values::text, '')
) WITH (
    text_config = 'english'
);

COMMENT ON INDEX idx_audit_logs_textsearch IS
    'BM25 search index for compliance audit investigation';

-- ============================================================================
-- VERIFY INDEXES CREATED
-- ============================================================================

DO $$
DECLARE
    expected_indexes TEXT[] := ARRAY[
        'idx_samples_textsearch',
        'idx_clients_textsearch',
        'idx_assays_textsearch',
        'idx_methods_textsearch',
        'idx_audit_logs_textsearch'
    ];
    idx TEXT;
BEGIN
    FOREACH idx IN ARRAY expected_indexes LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = idx
        ) THEN
            RAISE WARNING 'Index % was not created', idx;
        END IF;
    END LOOP;

    RAISE NOTICE 'pg_textsearch indexes verification complete';
END$$;
```

**Validation:**
- Migration applies without errors
- All indexes visible in `\di` or `pg_indexes`
- Index sizes reasonable

**Risks:**
- Large tables may take time to index initially
- Memory usage during index build

**Estimated complexity:** Medium

---

### Phase 4: Search Functions (Day 3-4)

**Step 4.1: Create Search RPC Functions**

**Files to create:**
- `supabase/migrations/070_create_search_functions.sql`

**Changes required:**
```sql
-- Migration 070: Create Search RPC Functions
-- Security Impact: Low - Functions use SECURITY INVOKER (respects RLS)
-- Changes: Creates RPC functions for full-text search across LIMS entities

SET search_path TO public;

-- ============================================================================
-- SEARCH SAMPLES FUNCTION
-- Returns samples matching the search query, ranked by relevance
-- ============================================================================

CREATE OR REPLACE FUNCTION search_samples(
    query TEXT,
    max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    sample_id TEXT,
    client_name TEXT,
    status sample_status,
    received_at TIMESTAMPTZ,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Respects RLS policies
SET search_path = public
AS $$
BEGIN
    -- Return empty if query is blank
    IF query IS NULL OR TRIM(query) = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.sample_id,
        s.client_name,
        s.status,
        s.received_at,
        (s.sample_id || ' ' || COALESCE(s.client_name, '')) <@> query AS rank
    FROM public.samples s
    WHERE
        s.deleted_at IS NULL
        AND (s.sample_id || ' ' || COALESCE(s.client_name, '')) <@> query > 0
    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_samples IS
    'Full-text search samples by ID and client name using BM25 ranking';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION search_samples TO authenticated;

-- ============================================================================
-- SEARCH CLIENTS FUNCTION
-- Returns clients matching the search query, ranked by relevance
-- ============================================================================

CREATE OR REPLACE FUNCTION search_clients(
    query TEXT,
    max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    contact_name TEXT,
    contact_email TEXT,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF query IS NULL OR TRIM(query) = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.contact_name,
        c.contact_email,
        (
            COALESCE(c.name, '') || ' ' ||
            COALESCE(c.contact_name, '') || ' ' ||
            COALESCE(c.contact_email, '')
        ) <@> query AS rank
    FROM public.clients c
    WHERE
        c.deleted_at IS NULL
        AND (
            COALESCE(c.name, '') || ' ' ||
            COALESCE(c.contact_name, '') || ' ' ||
            COALESCE(c.contact_email, '')
        ) <@> query > 0
    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_clients IS
    'Full-text search clients by name, contact, and email using BM25 ranking';

GRANT EXECUTE ON FUNCTION search_clients TO authenticated;

-- ============================================================================
-- SEARCH ASSAYS FUNCTION
-- Returns assay definitions matching the search query
-- ============================================================================

CREATE OR REPLACE FUNCTION search_assays(
    query TEXT,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    units TEXT,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF query IS NULL OR TRIM(query) = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.description,
        a.units,
        (COALESCE(a.name, '') || ' ' || COALESCE(a.description, '')) <@> query AS rank
    FROM public.assay_definitions a
    WHERE
        a.deleted_at IS NULL
        AND (COALESCE(a.name, '') || ' ' || COALESCE(a.description, '')) <@> query > 0
    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_assays IS
    'Full-text search assay catalog by name and description using BM25 ranking';

GRANT EXECUTE ON FUNCTION search_assays TO authenticated;

-- ============================================================================
-- SEARCH AUDIT LOGS FUNCTION (Manager only)
-- Returns audit log entries matching the search query
-- ============================================================================

CREATE OR REPLACE FUNCTION search_audit_logs(
    query TEXT,
    table_filter TEXT DEFAULT NULL,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    table_name TEXT,
    record_id UUID,
    operation TEXT,
    changed_by UUID,
    changed_at TIMESTAMPTZ,
    old_values JSONB,
    new_values JSONB,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Get current user's role
    SELECT u.role::TEXT INTO user_role
    FROM public.users u
    WHERE u.id = auth.uid();

    -- Only managers can search audit logs
    IF user_role != 'manager' THEN
        RAISE EXCEPTION 'Access denied: Only managers can search audit logs';
    END IF;

    IF query IS NULL OR TRIM(query) = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        al.id,
        al.table_name,
        al.record_id,
        al.operation,
        al.changed_by,
        al.changed_at,
        al.old_values,
        al.new_values,
        (
            al.table_name || ' ' ||
            al.operation || ' ' ||
            COALESCE(al.record_id::text, '') || ' ' ||
            COALESCE(al.old_values::text, '') || ' ' ||
            COALESCE(al.new_values::text, '')
        ) <@> query AS rank
    FROM public.audit_logs al
    WHERE
        (table_filter IS NULL OR al.table_name = table_filter)
        AND (
            al.table_name || ' ' ||
            al.operation || ' ' ||
            COALESCE(al.record_id::text, '') || ' ' ||
            COALESCE(al.old_values::text, '') || ' ' ||
            COALESCE(al.new_values::text, '')
        ) <@> query > 0
    ORDER BY rank DESC, al.changed_at DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_audit_logs IS
    'Full-text search audit logs for compliance investigation (manager only)';

GRANT EXECUTE ON FUNCTION search_audit_logs TO authenticated;

-- ============================================================================
-- GLOBAL SEARCH FUNCTION
-- Searches across multiple entities and returns unified results
-- ============================================================================

CREATE OR REPLACE FUNCTION global_search(
    query TEXT,
    entity_types TEXT[] DEFAULT ARRAY['samples', 'clients', 'assays'],
    max_per_entity INTEGER DEFAULT 10
)
RETURNS TABLE (
    entity_type TEXT,
    entity_id UUID,
    title TEXT,
    subtitle TEXT,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF query IS NULL OR TRIM(query) = '' THEN
        RETURN;
    END IF;

    -- Search samples
    IF 'samples' = ANY(entity_types) THEN
        RETURN QUERY
        SELECT
            'samples'::TEXT,
            s.id,
            s.sample_id,
            s.client_name,
            (s.sample_id || ' ' || COALESCE(s.client_name, '')) <@> query
        FROM public.samples s
        WHERE s.deleted_at IS NULL
            AND (s.sample_id || ' ' || COALESCE(s.client_name, '')) <@> query > 0
        ORDER BY (s.sample_id || ' ' || COALESCE(s.client_name, '')) <@> query DESC
        LIMIT max_per_entity;
    END IF;

    -- Search clients
    IF 'clients' = ANY(entity_types) THEN
        RETURN QUERY
        SELECT
            'clients'::TEXT,
            c.id,
            c.name,
            c.contact_email,
            (COALESCE(c.name, '') || ' ' || COALESCE(c.contact_name, '')) <@> query
        FROM public.clients c
        WHERE c.deleted_at IS NULL
            AND (COALESCE(c.name, '') || ' ' || COALESCE(c.contact_name, '')) <@> query > 0
        ORDER BY (COALESCE(c.name, '') || ' ' || COALESCE(c.contact_name, '')) <@> query DESC
        LIMIT max_per_entity;
    END IF;

    -- Search assays
    IF 'assays' = ANY(entity_types) THEN
        RETURN QUERY
        SELECT
            'assays'::TEXT,
            a.id,
            a.name,
            a.description,
            (COALESCE(a.name, '') || ' ' || COALESCE(a.description, '')) <@> query
        FROM public.assay_definitions a
        WHERE a.deleted_at IS NULL
            AND (COALESCE(a.name, '') || ' ' || COALESCE(a.description, '')) <@> query > 0
        ORDER BY (COALESCE(a.name, '') || ' ' || COALESCE(a.description, '')) <@> query DESC
        LIMIT max_per_entity;
    END IF;

    RETURN;
END;
$$;

COMMENT ON FUNCTION global_search IS
    'Unified search across multiple LIMS entities using BM25 ranking';

GRANT EXECUTE ON FUNCTION global_search TO authenticated;
```

**Validation:**
- All functions created successfully
- Functions return results for test queries
- RLS respected (non-managers cannot search audit logs)

**Risks:**
- Operator `<@>` syntax may differ in pg_textsearch version
- Performance on large result sets

**Estimated complexity:** Medium

---

### Phase 5: Application Integration (Day 4-5)

**Step 5.1: Create TypeScript Types for Search**

**Files to modify:**
- `src/types/index.ts`

**Changes required:**
```typescript
// Add after existing type definitions

// ============================================================================
// SEARCH TYPES
// ============================================================================

export const SearchResultSchema = z.object({
  entity_type: z.enum(['samples', 'clients', 'assays', 'methods', 'audit_logs']),
  entity_id: z.string().uuid(),
  title: z.string(),
  subtitle: z.string().nullable(),
  rank: z.number(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SampleSearchResultSchema = z.object({
  id: z.string().uuid(),
  sample_id: z.string(),
  client_name: z.string().nullable(),
  status: SampleStatusSchema,
  received_at: z.string().datetime(),
  rank: z.number(),
});

export type SampleSearchResult = z.infer<typeof SampleSearchResultSchema>;

export const ClientSearchResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contact_name: z.string().nullable(),
  contact_email: z.string().nullable(),
  rank: z.number(),
});

export type ClientSearchResult = z.infer<typeof ClientSearchResultSchema>;

export const GlobalSearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  entityTypes: z.array(z.enum(['samples', 'clients', 'assays'])).optional(),
  maxPerEntity: z.number().min(1).max(100).optional(),
});

export type GlobalSearchInput = z.infer<typeof GlobalSearchInputSchema>;
```

**Validation:**
- TypeScript compilation succeeds
- Types match database function return types

**Estimated complexity:** Low

---

**Step 5.2: Create Search Server Actions**

**Files to create:**
- `src/app/actions/search.ts`

**Changes required:**
```typescript
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  GlobalSearchInputSchema,
  SearchResult,
  SampleSearchResult
} from '@/types'

/**
 * Global search across LIMS entities
 * Uses BM25 ranking via pg_textsearch extension
 */
export async function globalSearch(input: z.infer<typeof GlobalSearchInputSchema>) {
  const supabase = await createClient()

  // Validate input
  const validated = GlobalSearchInputSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.flatten(), results: [] }
  }

  const { query, entityTypes, maxPerEntity } = validated.data

  const { data, error } = await supabase.rpc('global_search', {
    query,
    entity_types: entityTypes ?? ['samples', 'clients', 'assays'],
    max_per_entity: maxPerEntity ?? 10,
  })

  if (error) {
    console.error('Global search error:', error)
    return { error: error.message, results: [] }
  }

  return { results: data as SearchResult[] }
}

/**
 * Search samples by ID or client name
 */
export async function searchSamples(query: string, maxResults = 50) {
  const supabase = await createClient()

  if (!query || query.trim().length === 0) {
    return { results: [] }
  }

  const { data, error } = await supabase.rpc('search_samples', {
    query: query.trim(),
    max_results: maxResults,
  })

  if (error) {
    console.error('Sample search error:', error)
    return { error: error.message, results: [] }
  }

  return { results: data as SampleSearchResult[] }
}

/**
 * Search audit logs for compliance investigation (Manager only)
 */
export async function searchAuditLogs(
  query: string,
  tableFilter?: string,
  maxResults = 100
) {
  const supabase = await createClient()

  if (!query || query.trim().length === 0) {
    return { results: [] }
  }

  const { data, error } = await supabase.rpc('search_audit_logs', {
    query: query.trim(),
    table_filter: tableFilter ?? null,
    max_results: maxResults,
  })

  if (error) {
    // Handle permission error gracefully
    if (error.message.includes('Access denied')) {
      return { error: 'Chỉ quản lý mới có thể tìm kiếm nhật ký kiểm toán', results: [] }
    }
    console.error('Audit log search error:', error)
    return { error: error.message, results: [] }
  }

  return { results: data }
}
```

**Validation:**
- Server actions compile
- Functions return expected results
- Error handling works correctly

**Estimated complexity:** Medium

---

**Step 5.3: Update API Client for Search**

**Files to modify:**
- `src/lib/api-client.ts` (add search endpoints)

**Changes required:**
```typescript
// Add to existing api-client.ts

export async function apiGlobalSearch(
  query: string,
  entityTypes?: string[]
): Promise<SearchResult[]> {
  const response = await fetch('/api/client-actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'globalSearch',
      payload: { query, entityTypes },
    }),
  })

  if (!response.ok) {
    throw new Error('Search failed')
  }

  const data = await response.json()
  return data.results
}
```

**Validation:**
- Client-side search works
- Results render correctly

**Estimated complexity:** Low

---

### Phase 6: Testing & Verification (Day 5)

**Step 6.1: Create Search Integration Tests**

**Files to create:**
- `supabase/migrations/071_search_verification_tests.sql`

**Changes required:**
```sql
-- Migration 071: Search Verification Tests
-- Purpose: Verify pg_textsearch installation and functionality

SET search_path TO public;

-- ============================================================================
-- SEARCH VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_textsearch_installation()
RETURNS TABLE (
    test_name TEXT,
    passed BOOLEAN,
    details TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Test 1: Extension installed
    RETURN QUERY
    SELECT
        'Extension installed'::TEXT,
        EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_textsearch'),
        CASE
            WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_textsearch')
            THEN 'pg_textsearch extension is available'
            ELSE 'Extension NOT found - check Dockerfile build'
        END;

    -- Test 2: Search indexes exist
    RETURN QUERY
    SELECT
        'Search indexes created'::TEXT,
        (SELECT COUNT(*) >= 4 FROM pg_indexes WHERE indexname LIKE '%_textsearch'),
        'Found ' || (SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE '%_textsearch')::TEXT || ' textsearch indexes';

    -- Test 3: Search functions exist
    RETURN QUERY
    SELECT
        'Search functions exist'::TEXT,
        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'search_samples')
            AND EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'global_search'),
        CASE
            WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'search_samples')
            THEN 'search_samples and global_search functions available'
            ELSE 'Search functions NOT found'
        END;

    -- Test 4: Basic search works (requires sample data)
    BEGIN
        RETURN QUERY
        SELECT
            'Basic search functionality'::TEXT,
            TRUE,
            'Search operators available';
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'Basic search functionality'::TEXT,
            FALSE,
            'Search failed: ' || SQLERRM;
    END;

    RETURN;
END;
$$;

COMMENT ON FUNCTION verify_textsearch_installation IS
    'Verification tests for pg_textsearch installation';

-- Run verification
DO $$
DECLARE
    rec RECORD;
    all_passed BOOLEAN := TRUE;
BEGIN
    RAISE NOTICE 'Running pg_textsearch verification tests...';
    RAISE NOTICE '----------------------------------------';

    FOR rec IN SELECT * FROM verify_textsearch_installation() LOOP
        RAISE NOTICE 'Test: % | Passed: % | Details: %',
            rec.test_name, rec.passed, rec.details;
        IF NOT rec.passed THEN
            all_passed := FALSE;
        END IF;
    END LOOP;

    RAISE NOTICE '----------------------------------------';
    IF all_passed THEN
        RAISE NOTICE 'All pg_textsearch tests PASSED';
    ELSE
        RAISE WARNING 'Some pg_textsearch tests FAILED';
    END IF;
END$$;
```

**Validation:**
- All tests pass
- Search functionality verified

**Estimated complexity:** Low

---

## 5. Configuration Reference

### 5.1 PostgreSQL Configuration

Add to PostgreSQL startup if needed for performance:

```sql
-- Optional: Preload extension for faster first query
ALTER SYSTEM SET shared_preload_libraries = 'pg_textsearch';

-- Memory settings for search (adjust based on available RAM)
-- ALTER SYSTEM SET work_mem = '256MB';
-- ALTER SYSTEM SET maintenance_work_mem = '512MB';
```

### 5.2 BM25 Tuning Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| k1 | 1.2 | Term frequency saturation (default, good for most cases) |
| b | 0.75 | Document length normalization (default) |
| text_config | 'english' | Language for tokenization (change to 'vietnamese' if needed) |

### 5.3 Vietnamese Language Support

For Vietnamese content, create custom text configuration:

```sql
-- Create Vietnamese text configuration (future enhancement)
CREATE TEXT SEARCH CONFIGURATION vietnamese (COPY = simple);

-- Use with indexes:
-- WITH (text_config = 'vietnamese')
```

---

## 6. Use Case Examples

### 6.1 Sample Lookup

**Scenario:** Analyst needs to find sample "XL-2024-001234"

```sql
-- SQL Query
SELECT * FROM search_samples('XL-2024-001234', 10);

-- Result
| id | sample_id | client_name | status | rank |
|----|-----------|-------------|--------|------|
| ... | XL-2024-001234 | ABC Corp | in_progress | 0.95 |
| ... | XL-2024-001235 | ABC Corp | received | 0.32 |
```

**TypeScript:**
```typescript
const { results } = await searchSamples('XL-2024-001234')
// Returns ranked results with sample_id containing the search term
```

### 6.2 Client Search

**Scenario:** Find all samples for client "Vinamilk"

```sql
SELECT * FROM global_search('Vinamilk', ARRAY['samples', 'clients'], 20);
```

### 6.3 Compliance Investigation

**Scenario:** Manager investigating approval changes last month

```sql
SELECT * FROM search_audit_logs(
    'approved status change',
    'results',
    50
);
```

### 6.4 Test Catalog Search

**Scenario:** Find assays related to "heavy metals"

```sql
SELECT * FROM search_assays('heavy metals arsenic lead', 25);
```

---

## 7. Performance Considerations

### 7.1 Memory Usage

| Component | Memory Impact | Notes |
|-----------|---------------|-------|
| Extension | ~50MB base | Shared across connections |
| Memtable | Up to 100MB | Configurable via threshold |
| Indexes | ~10-20% of data size | Depends on text column sizes |
| Query | ~10-50MB per query | Based on result set size |

### 7.2 Disk Usage

| Component | Disk Impact | Notes |
|-----------|-------------|-------|
| Extension files | ~5MB | In PostgreSQL lib directory |
| Indexes | 20-50% of indexed text | Compressed inverted index |
| WAL | Minimal | Index changes are logged |

### 7.3 Query Optimization

1. **Limit result sets** - Always use `max_results` parameter
2. **Index specific columns** - Don't index entire rows
3. **Use table filters** - Filter by table before text search on audit logs
4. **Debounce UI queries** - 300ms debounce on search input

### 7.4 Index Maintenance

```sql
-- Reindex after bulk data loads
REINDEX INDEX idx_samples_textsearch;

-- Analyze for query planner
ANALYZE samples;
```

---

## 8. Security Considerations

### 8.1 RLS Compatibility

pg_textsearch **fully respects RLS policies**. All search queries:

1. Execute in the context of the authenticated user
2. Apply RLS policies before returning results
3. Cannot bypass row-level security

### 8.2 Permission Model

| Function | Allowed Roles | Notes |
|----------|---------------|-------|
| search_samples | authenticated | Respects sample RLS |
| search_clients | authenticated | Respects client RLS |
| search_assays | authenticated | Respects assay RLS |
| search_audit_logs | manager only | Explicit role check in function |
| global_search | authenticated | Respects all entity RLS |

### 8.3 Input Validation

All search functions validate:

1. Non-empty query strings
2. Maximum query length (implicit in database)
3. Sanitized inputs (no SQL injection via parameterized queries)

### 8.4 Audit Logging

Search operations are **read-only** and do not generate audit log entries. This is by design - audit logs track data changes, not read operations.

---

## 9. Rollback Plan

### 9.1 Immediate Rollback (Extension Issues)

If pg_textsearch causes problems, revert to standard PostgreSQL image:

```yaml
# docker-compose.yml
services:
  postgres:
    # Revert to standard image
    image: supabase/postgres:15.8.1.085
    # Remove build section
```

```bash
# Rollback steps
docker compose down
docker compose up -d

# Drop search functions and indexes
docker exec lims-postgres psql -U postgres -d postgres -c "
  DROP FUNCTION IF EXISTS search_samples CASCADE;
  DROP FUNCTION IF EXISTS search_clients CASCADE;
  DROP FUNCTION IF EXISTS search_assays CASCADE;
  DROP FUNCTION IF EXISTS search_audit_logs CASCADE;
  DROP FUNCTION IF EXISTS global_search CASCADE;
  DROP INDEX IF EXISTS idx_samples_textsearch;
  DROP INDEX IF EXISTS idx_clients_textsearch;
  DROP INDEX IF EXISTS idx_assays_textsearch;
  DROP INDEX IF EXISTS idx_methods_textsearch;
  DROP INDEX IF EXISTS idx_audit_logs_textsearch;
  DROP EXTENSION IF EXISTS pg_textsearch;
"
```

### 9.2 Create Rollback Migration

**Files to create:**
- `supabase/migrations/rollback/068_rollback_pg_textsearch.sql`

```sql
-- Rollback Migration: Remove pg_textsearch
-- Use only if rollback is needed

SET search_path TO public;

-- Drop functions first (depend on extension)
DROP FUNCTION IF EXISTS search_samples CASCADE;
DROP FUNCTION IF EXISTS search_clients CASCADE;
DROP FUNCTION IF EXISTS search_assays CASCADE;
DROP FUNCTION IF EXISTS search_audit_logs CASCADE;
DROP FUNCTION IF EXISTS global_search CASCADE;
DROP FUNCTION IF EXISTS verify_textsearch_installation CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_samples_textsearch;
DROP INDEX IF EXISTS idx_clients_textsearch;
DROP INDEX IF EXISTS idx_assays_textsearch;
DROP INDEX IF EXISTS idx_methods_textsearch;
DROP INDEX IF EXISTS idx_audit_logs_textsearch;

-- Drop extension
DROP EXTENSION IF EXISTS pg_textsearch;

RAISE NOTICE 'pg_textsearch rollback complete';
```

### 9.3 Data Safety

- **No data loss** - pg_textsearch only creates indexes and functions
- **No schema changes** - Existing tables are unchanged
- **Reversible** - All changes can be undone completely

---

## 10. Testing Strategy

### 10.1 Unit Testing

| Test | Description | Method |
|------|-------------|--------|
| Extension load | pg_textsearch loads without error | `CREATE EXTENSION` |
| Index creation | All indexes created | Check `pg_indexes` |
| Function execution | Functions return results | Direct SQL calls |
| Empty query handling | Empty strings handled gracefully | Test with '' |
| RLS enforcement | Non-authorized users filtered | Test with different roles |

### 10.2 Integration Testing

| Test | Description | Method |
|------|-------------|--------|
| API endpoint | Server actions return results | Jest/Vitest |
| UI search | Search component works | E2E test |
| Performance | Search < 100ms for common queries | Timing |
| Vietnamese text | Vietnamese content searchable | Manual test |

### 10.3 Performance Testing

```sql
-- Benchmark search performance
EXPLAIN ANALYZE SELECT * FROM search_samples('ABC', 50);

-- Expected: Index scan, < 10ms for 10k samples
```

### 10.4 Security Testing

```sql
-- Test manager-only audit log search
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "analyst-uuid", "role": "authenticated"}';

-- Should fail with access denied
SELECT * FROM search_audit_logs('test');

-- Switch to manager
SET request.jwt.claims TO '{"sub": "manager-uuid", "role": "authenticated"}';

-- Should succeed
SELECT * FROM search_audit_logs('test');
```

---

## 11. Documentation Updates

### 11.1 Files to Update

| File | Updates Required |
|------|------------------|
| `CLAUDE.md` | Add pg_textsearch extension info |
| `docs/DOCKER_SETUP.md` | Document custom Docker build |
| `docs/DATABASE_SETUP.md` | Add search migration steps |
| `docs/TechDesign-CDC-LIMS.md` | Add search architecture section |

### 11.2 New Documentation

| File | Purpose |
|------|---------|
| `docs/SEARCH_GUIDE.md` | User guide for search features |
| `docs/TEXTSEARCH_ADMIN.md` | Admin guide for maintenance |

---

## 12. Timeline and Dependencies

### 12.1 Implementation Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Infrastructure | 2 days | None |
| Phase 2: Extension | 0.5 days | Phase 1 |
| Phase 3: Indexes | 1 day | Phase 2 |
| Phase 4: Functions | 1.5 days | Phase 3 |
| Phase 5: Application | 2 days | Phase 4 |
| Phase 6: Testing | 1 day | Phase 5 |

**Total Estimated Time:** 8 days

### 12.2 Prerequisites

1. Docker Desktop with build support
2. Internet access for Rust/cargo downloads during build
3. At least 4GB RAM for Docker build
4. 2GB free disk space for custom image

### 12.3 Blocking Dependencies

None - this is a new feature that doesn't block existing functionality.

---

## 13. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Dockerfile build failure | Medium | High | Test build locally first; document exact versions |
| Extension compatibility | Low | High | Pin pgrx version; test with target PostgreSQL version |
| Performance regression | Low | Medium | Benchmark before/after; monitor query times |
| Memory pressure | Low | Medium | Configure memtable threshold; monitor with docker stats |
| Version conflicts | Low | Low | Use version locks in Dockerfile |

---

## 14. Approval Checklist

- [ ] Technical design reviewed by engineering lead
- [ ] Security implications reviewed
- [ ] Performance impact assessed
- [ ] Rollback plan validated
- [ ] Documentation plan approved
- [ ] Timeline agreed with stakeholders
- [ ] Resource allocation confirmed

---

## 15. Appendix

### A. Full Dockerfile

See Step 1.1 for complete Dockerfile content.

### B. Complete docker-compose.yml Changes

See Step 1.2 for docker-compose.yml modifications.

### C. All Migration Files Summary

| Migration | Purpose |
|-----------|---------|
| 068_install_pg_textsearch.sql | Install extension |
| 069_create_textsearch_indexes.sql | Create BM25 indexes |
| 070_create_search_functions.sql | Create RPC functions |
| 071_search_verification_tests.sql | Verification tests |

### D. References

- [pg_textsearch GitHub Repository](https://github.com/timescale/pg_textsearch)
- [BM25 Algorithm Explanation](https://en.wikipedia.org/wiki/Okapi_BM25)
- [cargo-pgrx Documentation](https://github.com/pgcentralfoundation/pgrx)
- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)

---

**End of Proposal**

*This proposal was generated based on NotebookLM research on pg_textsearch and analysis of the CDC-LIMS codebase.*
