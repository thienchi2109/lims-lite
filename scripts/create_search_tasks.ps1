# Create Beads tasks for OpenSpec change: add-pg-textsearch-bm25
# Phases 6-12 (Phases 1-5 already complete)

Write-Host "Creating Beads tasks for full-text search implementation (Phases 6-12)..." -ForegroundColor Cyan

# Phase 6: Application Integration - Data Layer
Write-Host "`nPhase 6: Application Integration - Data Layer" -ForegroundColor Yellow
bd create "6.1 Create src/lib/data/search.ts with type definitions and transformers" -p P1 -l "openspec,search,phase-6"
bd create "6.2 Add TanStack Query hooks for search (optional)" -p P2 -l "openspec,search,phase-6,optional"

# Phase 7: Application Integration - UI Components
Write-Host "`nPhase 7: Application Integration - UI Components" -ForegroundColor Yellow
bd create "7.1 Create global-search.tsx with debouncing and keyboard navigation" -p P1 -l "openspec,search,phase-7,ui"
bd create "7.2 Create search-result-item.tsx for entity-specific display" -p P1 -l "openspec,search,phase-7,ui"
bd create "7.3 Integrate global search into navigation with Cmd/Ctrl+K shortcut" -p P1 -l "openspec,search,phase-7,ui"

# Phase 8: Vietnamese Localization
Write-Host "`nPhase 8: Vietnamese Localization" -ForegroundColor Yellow
bd create "8.1 Add search terms to docs/vietnamese_dictionary.md" -p P1 -l "openspec,search,phase-8,i18n"
bd create "8.2 Update UI components with Vietnamese labels" -p P1 -l "openspec,search,phase-8,i18n"
bd create "8.3 Test with Vietnamese diacritic and non-diacritic queries" -p P1 -l "openspec,search,phase-8,testing"

# Phase 9: Testing
Write-Host "`nPhase 9: Testing" -ForegroundColor Yellow
bd create "9.1 Create tests/search.test.sql with comprehensive SQL tests" -p P0 -l "openspec,search,phase-9,testing"
bd create "9.2 Complete manual testing checklist (11 scenarios)" -p P0 -l "openspec,search,phase-9,testing"
bd create "9.3 Run typecheck and lint" -p P0 -l "openspec,search,phase-9,testing"
bd create "9.4 Run security tests via Docker" -p P0 -l "openspec,search,phase-9,testing,security"

# Phase 10: Documentation
Write-Host "`nPhase 10: Documentation" -ForegroundColor Yellow
bd create "10.1 Update CLAUDE.md with search-related patterns" -p P1 -l "openspec,search,phase-10,docs"
bd create "10.2 Create docs/SEARCH_SETUP.md with PostgreSQL FTS guide" -p P1 -l "openspec,search,phase-10,docs"
bd create "10.3 Update README.md with search feature overview" -p P2 -l "openspec,search,phase-10,docs"

# Phase 11: Performance Tuning (Optional - Post-Launch)
Write-Host "`nPhase 11: Performance Tuning (Optional)" -ForegroundColor Yellow
bd create "11.1 Monitor search performance in production" -p P3 -l "openspec,search,phase-11,performance,optional"
bd create "11.2 Add weighted ranking if needed" -p P3 -l "openspec,search,phase-11,performance,optional"
bd create "11.3 Add Vietnamese stopwords if needed" -p P3 -l "openspec,search,phase-11,performance,optional"
bd create "11.4 Add phrase search if requested by users" -p P3 -l "openspec,search,phase-11,performance,optional"

# Phase 12: Deployment Verification
Write-Host "`nPhase 12: Deployment Verification" -ForegroundColor Yellow
bd create "12.1 Run migrations on staging with CREATE INDEX CONCURRENTLY" -p P0 -l "openspec,search,phase-12,deployment"
bd create "12.2 Run smoke tests on staging environment" -p P0 -l "openspec,search,phase-12,deployment,testing"
bd create "12.3 Monitor for performance issues (query latency, index size)" -p P0 -l "openspec,search,phase-12,deployment,monitoring"
bd create "12.4 Deploy to production and verify functionality" -p P0 -l "openspec,search,phase-12,deployment"

Write-Host "`nDone! Created 23 tasks for Phases 6-12." -ForegroundColor Green
Write-Host "Run 'bd list' to see all tasks." -ForegroundColor Green
Write-Host "Run 'bd ready' to see the highest priority unblocked task." -ForegroundColor Green
