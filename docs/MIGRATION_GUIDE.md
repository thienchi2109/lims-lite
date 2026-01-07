# CDC-LIMS Docker Stack Migration Guide

> **Fail-proof migration of the 12-container LIMS stack from Machine 1 to Machine 2**
>
> Estimated downtime: 15-30 minutes | Last updated: 2026-01-07

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Stack Overview](#stack-overview)
3. [Phase 1: Data Extraction (Machine 1)](#phase-1-data-extraction-machine-1)
4. [Phase 2: Transfer & Preparation (Machine 2)](#phase-2-transfer--preparation-machine-2)
5. [Phase 3: Restoration & Validation](#phase-3-restoration--validation)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedure](#rollback-procedure)

---

## Prerequisites

### Machine 1 (Source)
- [ ] Docker Desktop running
- [ ] PowerShell 5.1+ (run as Administrator for volume operations)
- [ ] ~5GB free disk space for backup archives

### Machine 2 (Target)
- [ ] Docker Desktop installed and running
- [ ] Git installed (to clone project if not transferring)
- [ ] Same disk space as Machine 1's lims-lite folder + 5GB for volumes

### Transfer
- [ ] Cloud storage account (Google Drive, S3, OneDrive, etc.)
- [ ] Stable internet connection on both machines

---

## Stack Overview

### Containers (12 total)

| Service | Container | Image | Port | Data |
|---------|-----------|-------|------|------|
| postgres | lims-postgres | supabase/postgres:15.8.1.085 | 5432 | **Volume: postgres-data** |
| storage | lims-storage | supabase/storage-api:v0.46.4 | 5000 | **Volume: storage-data** |
| auth | lims-auth | supabase/gotrue:v2.143.0 | 9999 | DB-backed |
| rest | lims-rest | postgrest/postgrest:v12.0.2 | 3001 | Stateless |
| realtime | lims-realtime | supabase/realtime:v2.33.66 | 4000 | Stateless |
| kong | lims-kong | kong:2.8.1 | 8000 | **Config: kong.yml** |
| meta | lims-meta | supabase/postgres-meta:v0.84.2 | 8080 | Stateless |
| studio | lims-studio | supabase/studio:latest | 3002 | Stateless |
| app | lims-app | (built locally) | - | Stateless |
| nginx | lims-nginx | nginx:alpine | 80 | **Config: nginx.conf** |
| tunnel | lims-tunnel | cloudflare/cloudflared | - | Uses token |

### Critical Files

```
lims-lite/
├── .env                    # ⚠️ SECRETS - MUST TRANSFER
├── docker-compose.yml      # Stack definition
├── supabase/
│   ├── kong.yml            # API Gateway config
│   └── migrations/         # 112 SQL migrations (in git)
└── nginx/
    └── nginx.conf          # Reverse proxy config
```

### Secret Environment Variables (.env)

| Variable | Purpose | Change on Machine 2? |
|----------|---------|---------------------|
| `POSTGRES_PASSWORD` | Database access | Keep same |
| `JWT_SECRET` | Token signing | Keep same |
| `ANON_KEY` | Anonymous API access | Keep same |
| `SERVICE_ROLE_KEY` | Admin API access | Keep same |
| `DB_ENC_KEY` | Realtime encryption | Keep same |
| `CLOUDFLARE_TUNNEL_TOKEN` | Tunnel auth | **May need new tunnel** |

---

## Phase 1: Data Extraction (Machine 1)

### 1.1 Pre-flight Checks

Open PowerShell and navigate to your project:

```powershell
cd D:\lims-lite
```

Verify all containers are healthy:

```powershell
docker compose ps
```

Expected output: All services should show `Up` or `healthy`.

Check disk space for backup:

```powershell
# Estimate volume sizes
docker system df -v | Select-String "lims"
```

### 1.2 Create Database Dump

**IMPORTANT:** Create the SQL dump BEFORE stopping containers to ensure consistency.

```powershell
# Create timestamped backup filename
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = "lims-backup-$timestamp.sql"

# Dump entire database cluster (all databases, roles, permissions)
docker exec lims-postgres pg_dumpall -U postgres > $backupFile

# Verify dump was created
Get-Item $backupFile | Format-List Name, Length, LastWriteTime
```

**Why `pg_dumpall` instead of `pg_dump`?**
- Includes all databases (postgres, auth schemas)
- Preserves roles and permissions
- Captures Supabase system tables
- Single file for complete restoration

Verify the dump is valid:

```powershell
# Check first and last lines
Get-Content $backupFile -Head 5
Get-Content $backupFile -Tail 5

# Should see SQL commands, not error messages
```

### 1.3 Stop All Containers

**CRITICAL:** Stop containers before exporting volumes to prevent data corruption.

```powershell
docker compose down
```

Verify all containers stopped:

```powershell
docker ps -a --filter "name=lims-"
```

Should show all containers with status `Exited`.

### 1.4 Export Docker Volumes

Export volumes using an Alpine container (preserves Unix permissions):

```powershell
# Export postgres-data volume
docker run --rm `
  -v lims-lite_postgres-data:/data:ro `
  -v ${PWD}:/backup `
  alpine tar cvzf /backup/postgres-data.tar.gz -C /data .

# Export storage-data volume
docker run --rm `
  -v lims-lite_storage-data:/data:ro `
  -v ${PWD}:/backup `
  alpine tar cvzf /backup/storage-data.tar.gz -C /data .
```

Verify exports:

```powershell
Get-Item *.tar.gz | Format-Table Name, @{N='Size(MB)';E={[math]::Round($_.Length/1MB, 2)}}
```

### 1.5 Archive Project Directory

Create a complete archive of the project (excludes node_modules, .next):

```powershell
# Create exclusion list
@"
node_modules
.next
*.tar.gz
*.sql
"@ | Out-File -Encoding ASCII exclude.txt

# Archive project using tar (Git Bash or WSL)
tar --exclude-from=exclude.txt -cvzf lims-project.tar.gz -C D:\ lims-lite
```

**Alternative using 7-Zip (if tar not available):**

```powershell
# Install 7-Zip if needed: winget install 7zip.7zip

& "C:\Program Files\7-Zip\7z.exe" a -ttar -xr!node_modules -xr!.next lims-project.tar D:\lims-lite
& "C:\Program Files\7-Zip\7z.exe" a -tgzip lims-project.tar.gz lims-project.tar
Remove-Item lims-project.tar
```

### 1.6 Generate Checksums

Create checksums for integrity verification:

```powershell
# Generate SHA256 checksums
$files = @(
    "lims-backup-*.sql",
    "postgres-data.tar.gz",
    "storage-data.tar.gz",
    "lims-project.tar.gz"
)

$checksums = foreach ($pattern in $files) {
    Get-ChildItem $pattern -ErrorAction SilentlyContinue | ForEach-Object {
        $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
        "$hash  $($_.Name)"
    }
}

$checksums | Out-File -Encoding ASCII checksums.sha256
Get-Content checksums.sha256
```

### 1.7 Upload to Cloud Storage

Upload these files to your cloud storage:

```
✓ lims-backup-YYYYMMDD-HHMMSS.sql   (~50-200 MB)
✓ postgres-data.tar.gz               (~200-500 MB)
✓ storage-data.tar.gz                (~varies)
✓ lims-project.tar.gz                (~50-100 MB)
✓ checksums.sha256                   (~1 KB)
```

**Recommended folder structure in cloud:**
```
LIMS-Migration-YYYY-MM-DD/
├── database/
│   └── lims-backup-*.sql
├── volumes/
│   ├── postgres-data.tar.gz
│   └── storage-data.tar.gz
├── project/
│   └── lims-project.tar.gz
└── checksums.sha256
```

---

## Phase 2: Transfer & Preparation (Machine 2)

### 2.1 Download from Cloud Storage

Download all files to a working directory:

```powershell
# Create migration directory
mkdir D:\lims-migration
cd D:\lims-migration

# Download files from cloud storage to this directory
# (Use your cloud storage client or browser)
```

### 2.2 Verify Checksums

```powershell
cd D:\lims-migration

# Read expected checksums
$expected = Get-Content checksums.sha256

# Verify each file
foreach ($line in $expected) {
    if ($line -match '^([A-Fa-f0-9]+)\s+(.+)$') {
        $expectedHash = $Matches[1]
        $fileName = $Matches[2].Trim()

        if (Test-Path $fileName) {
            $actualHash = (Get-FileHash $fileName -Algorithm SHA256).Hash
            if ($actualHash -eq $expectedHash) {
                Write-Host "✓ $fileName - OK" -ForegroundColor Green
            } else {
                Write-Host "✗ $fileName - MISMATCH!" -ForegroundColor Red
                Write-Host "  Expected: $expectedHash"
                Write-Host "  Actual:   $actualHash"
            }
        } else {
            Write-Host "✗ $fileName - NOT FOUND" -ForegroundColor Red
        }
    }
}
```

**STOP if any checksum fails** - re-download the corrupted file.

### 2.3 Extract Project Archive

```powershell
# Extract project to D:\
tar -xvzf lims-project.tar.gz -C D:\

# Verify extraction
cd D:\lims-lite
Get-ChildItem -Name
```

**Alternative using 7-Zip:**

```powershell
& "C:\Program Files\7-Zip\7z.exe" x lims-project.tar.gz -oD:\
& "C:\Program Files\7-Zip\7z.exe" x D:\lims-project.tar -oD:\
Remove-Item D:\lims-project.tar
```

### 2.4 Create Docker Volumes

```powershell
# Create named volumes (same names as docker-compose expects)
docker volume create lims-lite_postgres-data
docker volume create lims-lite_storage-data

# Verify volumes created
docker volume ls --filter "name=lims-lite"
```

### 2.5 Import Volume Data

```powershell
cd D:\lims-migration

# Import postgres-data
docker run --rm `
  -v lims-lite_postgres-data:/data `
  -v ${PWD}:/backup:ro `
  alpine sh -c "cd /data && tar xvzf /backup/postgres-data.tar.gz"

# Import storage-data
docker run --rm `
  -v lims-lite_storage-data:/data `
  -v ${PWD}:/backup:ro `
  alpine sh -c "cd /data && tar xvzf /backup/storage-data.tar.gz"
```

Verify volume contents:

```powershell
# Check postgres data directory
docker run --rm -v lims-lite_postgres-data:/data alpine ls -la /data

# Check storage files
docker run --rm -v lims-lite_storage-data:/data alpine ls -la /data
```

### 2.6 Verify .env File

```powershell
cd D:\lims-lite

# Check .env exists and has content
if (Test-Path .env) {
    Write-Host "✓ .env file exists" -ForegroundColor Green
    Write-Host "Variables defined:"
    Get-Content .env | Where-Object { $_ -match '^[A-Z]' } | ForEach-Object {
        $name = $_.Split('=')[0]
        Write-Host "  - $name"
    }
} else {
    Write-Host "✗ .env file MISSING!" -ForegroundColor Red
    Write-Host "Copy from Machine 1 or create from env.md template"
}
```

### 2.7 Update URLs (If Hostname Changed)

If Machine 2 has a different hostname/IP, update these in `.env`:

```powershell
# Only if using different hostname:
# API_EXTERNAL_URL=http://new-hostname:8000
# SITE_URL=http://new-hostname:3000
# NEXT_PUBLIC_SUPABASE_URL=http://new-hostname:8000
```

**For Cloudflare Tunnel:** If using the same tunnel, no changes needed. If creating a new tunnel, update `CLOUDFLARE_TUNNEL_TOKEN`.

---

## Phase 3: Restoration & Validation

### 3.1 Start Database First

```powershell
cd D:\lims-lite

# Start only postgres
docker compose up -d postgres

# Wait for healthy status (may take 30-60 seconds)
Write-Host "Waiting for PostgreSQL to be healthy..."
do {
    Start-Sleep -Seconds 5
    $status = docker inspect lims-postgres --format='{{.State.Health.Status}}' 2>$null
    Write-Host "  Status: $status"
} while ($status -ne 'healthy')

Write-Host "✓ PostgreSQL is healthy" -ForegroundColor Green
```

### 3.2 Verify Database Contents

```powershell
# Check if data exists (tables, migrations)
docker exec lims-postgres psql -U postgres -c `
  "SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

# Check migration history
docker exec lims-postgres psql -U postgres -c `
  "SELECT name FROM supabase_migrations.schema_migrations ORDER BY id DESC LIMIT 10;"

# Check user accounts exist
docker exec lims-postgres psql -U postgres -c `
  "SELECT email, role FROM auth.users LIMIT 5;"
```

**If database is empty**, restore from SQL dump:

```powershell
# Only if volume import failed or data is missing
cd D:\lims-migration
Get-ChildItem lims-backup-*.sql | ForEach-Object {
    Write-Host "Restoring from $($_.Name)..."
    Get-Content $_.FullName | docker exec -i lims-postgres psql -U postgres
}
```

### 3.3 Start All Services

```powershell
cd D:\lims-lite

# Start remaining services
docker compose up -d

# Monitor startup
docker compose logs -f --tail=50
# Press Ctrl+C after all services show "ready" or "listening"
```

Wait for all services (1-2 minutes):

```powershell
# Check all containers
docker compose ps
```

All services should show `Up` and healthy checks should pass.

### 3.4 Validation Checklist

Run each test and verify:

#### Database Connectivity
```powershell
# Test from host
docker exec lims-postgres psql -U postgres -c "SELECT 1 as connection_test;"
# Expected: connection_test = 1
```

#### REST API
```powershell
# Test PostgREST
Invoke-WebRequest -Uri "http://localhost:8000/rest/v1/" -Method GET | Select-Object StatusCode
# Expected: 200
```

#### Auth Service
```powershell
# Test GoTrue health
Invoke-WebRequest -Uri "http://localhost:8000/auth/v1/health" -Method GET | Select-Object StatusCode
# Expected: 200
```

#### Storage Service
```powershell
# Check storage is accessible
docker exec lims-storage ls -la /var/lib/storage/
# Should list bucket folders
```

#### Studio Dashboard
```powershell
# Open in browser
Start-Process "http://localhost:3002"
# Should load Supabase Studio
```

#### Application
```powershell
# Open main app
Start-Process "http://localhost:3000"
# Should show login page
```

#### Cloudflare Tunnel (if applicable)
```powershell
# Check tunnel status
docker logs lims-tunnel --tail 20
# Should show "Connection registered" or similar
```

### 3.5 Test Login

1. Open http://localhost:3000
2. Login with existing user credentials
3. Verify:
   - [ ] Login succeeds
   - [ ] Dashboard loads
   - [ ] Sample data visible
   - [ ] Can navigate between pages

---

## Troubleshooting

### PostgreSQL Won't Start

**Symptom:** `lims-postgres` exits immediately or fails health check.

**Cause:** Volume permissions or corrupted data.

**Fix:**
```powershell
# Check logs
docker logs lims-postgres

# If permission error, fix ownership inside volume
docker run --rm -v lims-lite_postgres-data:/data alpine chown -R 70:70 /data

# Restart
docker compose up -d postgres
```

### Storage Files Not Accessible

**Symptom:** 403 errors when accessing files, or empty bucket listings.

**Fix:**
```powershell
# Fix storage directory permissions
docker exec lims-storage chown -R 1000:1000 /var/lib/storage

# Restart storage service
docker compose restart storage
```

### PostgREST Schema Cache Error

**Symptom:** "Could not find the function in the schema cache"

**Fix:**
```powershell
# Restart REST service to refresh schema cache
docker compose restart rest
```

### Kong Gateway 502 Errors

**Symptom:** API returns 502 Bad Gateway.

**Cause:** Upstream services not ready.

**Fix:**
```powershell
# Check upstream service health
docker compose ps

# Restart Kong after all services are healthy
docker compose restart kong
```

### Tunnel Connection Failed

**Symptom:** `lims-tunnel` shows authentication errors.

**Fix:**
1. Create new tunnel in Cloudflare dashboard
2. Update `CLOUDFLARE_TUNNEL_TOKEN` in `.env`
3. Restart: `docker compose up -d tunnel`

### Port Already in Use

**Symptom:** Container fails with "port already in use".

**Fix:**
```powershell
# Find what's using the port (e.g., 5432)
netstat -ano | findstr :5432

# Kill the process or change port in docker-compose.yml
```

---

## Rollback Procedure

If migration fails and you need to restore Machine 1:

### On Machine 1

```powershell
cd D:\lims-lite

# Start all services
docker compose up -d

# Verify everything works
docker compose ps
```

Data is still in the original volumes - no restoration needed unless you deleted them.

### If Volumes Were Deleted on Machine 1

```powershell
# Re-import from your backup archives
docker volume create lims-lite_postgres-data
docker volume create lims-lite_storage-data

docker run --rm -v lims-lite_postgres-data:/data -v ${PWD}:/backup:ro alpine sh -c "cd /data && tar xvzf /backup/postgres-data.tar.gz"
docker run --rm -v lims-lite_storage-data:/data -v ${PWD}:/backup:ro alpine sh -c "cd /data && tar xvzf /backup/storage-data.tar.gz"

docker compose up -d
```

---

## Post-Migration Cleanup

After successful migration and validation:

### Machine 1 (Optional)
```powershell
# Only after confirming Machine 2 works!

# Remove containers
docker compose down

# Remove volumes (IRREVERSIBLE)
docker volume rm lims-lite_postgres-data lims-lite_storage-data

# Remove backup files
Remove-Item *.sql, *.tar.gz
```

### Machine 2
```powershell
# Clean up migration files
Remove-Item D:\lims-migration -Recurse

# Verify final state
docker compose ps
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    LIMS Migration Quick Ref                      │
├─────────────────────────────────────────────────────────────────┤
│ MACHINE 1 (Extract)                                              │
│   1. docker exec lims-postgres pg_dumpall -U postgres > backup.sql │
│   2. docker compose down                                          │
│   3. docker run ... alpine tar cvzf postgres-data.tar.gz ...     │
│   4. docker run ... alpine tar cvzf storage-data.tar.gz ...      │
│   5. Upload to cloud                                              │
├─────────────────────────────────────────────────────────────────┤
│ MACHINE 2 (Restore)                                              │
│   1. Download + verify checksums                                 │
│   2. Extract project archive                                     │
│   3. docker volume create lims-lite_postgres-data                │
│   4. docker volume create lims-lite_storage-data                 │
│   5. docker run ... alpine tar xvzf postgres-data.tar.gz ...     │
│   6. docker run ... alpine tar xvzf storage-data.tar.gz ...      │
│   7. docker compose up -d                                        │
│   8. Test: http://localhost:3000                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix: File Manifest

Files to transfer for complete migration:

| File | Size (typical) | Required |
|------|---------------|----------|
| `lims-backup-*.sql` | 50-200 MB | Yes |
| `postgres-data.tar.gz` | 200-500 MB | Yes |
| `storage-data.tar.gz` | Varies | Yes |
| `lims-project.tar.gz` | 50-100 MB | Or git clone |
| `.env` | 2 KB | **Critical** |
| `checksums.sha256` | 1 KB | Recommended |

Total transfer: ~400-800 MB typical
