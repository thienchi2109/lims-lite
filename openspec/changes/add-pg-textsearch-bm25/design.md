## Context

CDC-LIMS currently has no full-text search capability. Users must rely on exact-match filters (sample ID prefix, status dropdown) which is inefficient for:
- Finding samples by partial client name or description
- Searching test catalog by method keywords
- Investigating audit logs during compliance audits
- Cross-entity discovery (finding related samples, clients, and results)

PostgreSQL's built-in `tsvector`/`tsquery` with `ts_rank` has limitations:
- No term frequency saturation (vulnerable to keyword stuffing)
- Limited relevance tuning options
- Vietnamese tokenization requires custom configuration

**pg_textsearch** is a Rust-based PostgreSQL extension by Timescale that implements BM25 (Best Matching 25) ranking algorithm, the industry standard for information retrieval.

## Goals / Non-Goals

### Goals
- Provide BM25-ranked full-text search across LIMS core entities (samples, clients, assays, audit_logs)
- Maintain RLS compliance (search results respect existing row-level security policies)
- Support Vietnamese text through configurable text_config
- Enable future hybrid search with pgvector (RRF fusion)
- Keep infrastructure self-contained (no external search services)

### Non-Goals
- Semantic/embedding-based search (phase 2 with pgvector)
- Real-time search-as-you-type (initial implementation uses submit-based search)
- External search services (Elasticsearch, Meilisearch, Typesense)
- Full audit log search for analysts (manager-only due to compliance)

## Decisions

### Decision: pg_textsearch over alternatives

**Evaluated options:**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **pg_textsearch** | BM25 native, memtable architecture, pgvector-ready, Rust/pgrx | Requires custom Docker build, newer project | **Selected** |
| ParadeDB pg_search | Full BM25, Tantivy-based | Heavier footprint, complex licensing | Rejected |
| plpgsql_bm25 | Pure SQL, no compilation | Slower, no index structures | Rejected |
| Elasticsearch | Mature, feature-rich | External service, operational complexity, cost | Rejected |
| Built-in ts_rank | No dependencies | No BM25, keyword stuffing vulnerability | Rejected |

**Rationale**: pg_textsearch provides BM25 ranking in-database with minimal operational overhead. The custom Docker build is a one-time setup cost, and the extension's Rust/pgrx architecture ensures performance. Future hybrid search with pgvector is a natural extension.

### Decision: Custom Dockerfile approach

The pg_textsearch extension requires Rust toolchain and cargo-pgrx for compilation. Options:

1. **Multi-stage Dockerfile** (Selected)
   - Stage 1: Build pg_textsearch with Rust toolchain
   - Stage 2: Copy compiled extension to Supabase Postgres image
   - Pros: Reproducible builds, CI/CD friendly, minimal runtime image size
   - Cons: Initial build takes 5-10 minutes

2. **Pre-built extension download**
   - Download release artifacts from Timescale
   - Pros: Faster builds
   - Cons: Version compatibility issues, architecture mismatch risks

3. **Supabase extension request**
   - Request Supabase add pg_textsearch to their image
   - Pros: Zero maintenance
   - Cons: Unlikely for newer extension, no timeline control

### Decision: Vietnamese language support

pg_textsearch uses `text_config` parameter for text processing:

```sql
SELECT textsearch.search(
    'samples_search_idx',
    'Nguyen Van A',
    text_config => 'simple'  -- or custom Vietnamese config
);
```

**Strategy:**
1. Start with `'simple'` text_config (case-insensitive, no stemming)
2. Evaluate Vietnamese-specific tokenization needs post-deployment
3. Add custom text_config with Vietnamese dictionaries if needed

### Decision: Index strategy

Create dedicated BM25 indexes per searchable table:

| Table | Indexed Columns | Index Name |
|-------|-----------------|------------|
| samples | sample_id, description, client_name (via join) | samples_search_idx |
| clients | name, contact_name, phone, email, address | clients_search_idx |
| assay_definitions | name, method_name, description, specialty_name | assays_search_idx |
| audit_logs | action, old_data, new_data, user_email | audit_logs_search_idx |

**Configuration:** Use default BM25 parameters (k1=1.2, b=0.75) initially, tune based on relevance feedback.

### Decision: RLS enforcement in search

Search functions run with `SECURITY INVOKER` to respect caller's RLS policies:

```sql
CREATE OR REPLACE FUNCTION search_samples(query TEXT)
RETURNS TABLE(id UUID, sample_id TEXT, score FLOAT4)
LANGUAGE plpgsql
SECURITY INVOKER  -- Inherits caller's permissions
AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.sample_id, ts.score
    FROM textsearch.search('samples_search_idx', query) ts
    JOIN samples s ON s.id = ts.id::uuid
    WHERE s.deleted_at IS NULL;  -- RLS handles role-based filtering
END;
$$;
```

### Decision: Manager-only audit log search

Audit log search is restricted to managers due to compliance sensitivity:

```sql
CREATE POLICY "Only managers can search audit logs"
ON audit_logs FOR SELECT
USING (get_user_role() = 'manager');
```

The search function additionally validates role before executing.

## Risks / Trade-offs

### Risk: Docker build complexity
- **Impact**: Medium - First build requires Rust toolchain download (~500MB), takes 5-10 minutes
- **Mitigation**: Multi-stage build caches Rust dependencies, subsequent builds are faster. Document build process clearly.

### Risk: Image size increase
- **Impact**: Low - Extension adds ~20-30MB to runtime image
- **Mitigation**: Multi-stage build keeps runtime image lean. Monitor image size in CI.

### Risk: Rust/pgrx version compatibility
- **Impact**: Medium - pgrx version must match PostgreSQL version exactly
- **Mitigation**: Pin pgrx version in Dockerfile, test upgrades in staging before production.

### Risk: Index maintenance overhead
- **Impact**: Low - BM25 indexes use memtable architecture for efficient updates
- **Mitigation**: Monitor index size and vacuum frequency. Consider partial indexes if tables grow large.

### Risk: Vietnamese tokenization quality
- **Impact**: Medium - Simple tokenization may miss Vietnamese-specific patterns
- **Mitigation**: Start with simple config, collect user feedback, iterate on custom config.

## Migration Plan

### Phase 1: Infrastructure (Week 1)

1. **Create Dockerfile.postgres**
   ```dockerfile
   # Build stage with Rust
   FROM rust:1.75 AS builder
   RUN cargo install cargo-pgrx --version 0.11.x
   # Clone and build pg_textsearch

   # Runtime stage
   FROM supabase/postgres:15.8.1.085
   COPY --from=builder /path/to/pg_textsearch.so /usr/lib/...
   ```

2. **Update docker-compose.yml**
   ```yaml
   postgres:
     build:
       context: .
       dockerfile: Dockerfile.postgres
     # ... rest unchanged
   ```

3. **Test container builds locally**

### Phase 2: Database Migrations (Week 1-2)

1. **Migration: Install extension**
   ```sql
   CREATE EXTENSION IF NOT EXISTS textsearch;
   ```

2. **Migration: Create search indexes**
   ```sql
   SELECT textsearch.create_index(
       'samples_search_idx',
       'public.samples',
       ARRAY['sample_id', 'description']
   );
   ```

3. **Migration: Create search functions**
   ```sql
   CREATE FUNCTION search_samples(query TEXT, limit_count INT DEFAULT 20)
   RETURNS TABLE(...)
   ```

### Phase 3: Application Integration (Week 2)

1. Create search Server Actions
2. Add search data fetching utilities
3. Build global search UI component
4. Integrate with existing navigation

### Rollback Procedure

If issues arise:

1. **Application layer**: Remove search UI/actions (no data loss)
2. **Database layer**: Drop extension and indexes
   ```sql
   DROP EXTENSION IF EXISTS textsearch CASCADE;
   ```
3. **Infrastructure layer**: Revert docker-compose.yml to standard Supabase image
   ```yaml
   postgres:
     image: supabase/postgres:15.8.1.085
   ```

Data remains intact; only search capability is removed.

## Open Questions

1. **Index refresh strategy**: Should indexes rebuild on-demand or use scheduled background refresh?
2. **Search result pagination**: Use offset-based or cursor-based pagination for large result sets?
3. **Highlight/snippet support**: Does pg_textsearch support result highlighting, or implement in application layer?
4. **Rate limiting**: Should global search have rate limits to prevent abuse?
