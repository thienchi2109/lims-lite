# Troubleshooting Guide

## Common Issues and Solutions

### 1. Authentication Errors (503 Service Unavailable)

**Symptoms:**
- `AuthRetryableFetchError: {} status: 503`
- `Error: fetch failed` in middleware/auth
- Login page shows "Invalid username or password" even with correct credentials

**Root Cause:**
- Supabase Docker containers not running
- Missing database schemas (`auth`, `storage`, `graphql_public`)
- Database migrations not applied
- Incorrect password hashes in `auth.users` table

**Solution:**

1. **Start Docker containers:**
   ```bash
   docker-compose up -d
   ```

2. **Verify all containers are running:**
   ```bash
   docker ps
   ```
   
   Expected output should show all containers as "Up" or "healthy":
   - `lims-postgres` (healthy)
   - `lims-auth` (Up)
   - `lims-rest` (Up)
   - `lims-storage` (Up)
   - `lims-kong` (healthy)
   - `lims-studio` (Up, may be unhealthy but not critical)

3. **If auth container is restarting, create missing schemas:**
   ```bash
   docker exec lims-postgres psql -U postgres -d postgres -c "CREATE SCHEMA IF NOT EXISTS auth;"
   docker exec lims-postgres psql -U postgres -d postgres -c "CREATE SCHEMA IF NOT EXISTS storage;"
   docker exec lims-postgres psql -U postgres -d postgres -c "CREATE SCHEMA IF NOT EXISTS graphql_public;"
   ```

4. **Restart auth container:**
   ```bash
   docker restart lims-auth
   ```

5. **Apply database migrations:**
   ```bash
   Get-ChildItem -Path .\supabase\migrations\*.sql | Sort-Object Name | ForEach-Object { 
     Write-Host "Applying migration: $($_.Name)"
     Get-Content $_.FullName | docker exec -i lims-postgres psql -U postgres -d postgres 
   }
   ```

6. **Fix user passwords (if login still fails):**
   ```bash
   # Enable pgcrypto extension
   docker exec lims-postgres psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
   
   # Update passwords with proper bcrypt hashes
   docker exec lims-postgres psql -U postgres -d postgres -c "UPDATE auth.users SET encrypted_password = crypt('password123', gen_salt('bf')) WHERE email IN ('analyst@cdc-lims.local', 'manager@cdc-lims.local');"
   ```

7. **Verify Supabase is accessible:**
   ```bash
   curl http://localhost:8000/auth/v1/health
   ```
   
   Expected response:
   ```json
   {"version":"vunspecified","name":"GoTrue","description":"GoTrue is a user registration and authentication API"}
   ```

8. **Restart Next.js dev server:**
   ```bash
   # Stop all node processes
   Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
   
   # Remove lock file if exists
   Remove-Item -Path .next\dev\lock -Force -ErrorAction SilentlyContinue
   
   # Start dev server
   npm run dev
   ```

### 2. Invalid Source Map Warnings

**Symptoms:**
- `Invalid source map. Only conformant source maps can be used to find the original code`
- Warning from `@supabase/auth-js` module

**Root Cause:**
- Known issue with Supabase's published packages
- Source maps in the package are malformed

**Solution:**
- **This is a development-only warning and can be safely ignored**
- Does not affect functionality
- Will not appear in production builds

### 3. Database Connection Issues

**Symptoms:**
- `password authentication failed for user "postgres"`
- Containers restarting continuously

**Root Cause:**
- Mismatch between `POSTGRES_PASSWORD` in `.env` and the password used when the database volume was created

**Solution:**

1. **Stop all containers and remove volumes:**
   ```bash
   docker-compose down -v
   ```

2. **Ensure `.env` file exists with correct password:**
   ```bash
   # Check if .env exists
   Test-Path .env
   
   # If not, copy from .env.txt
   Copy-Item .env.txt .env
   ```

3. **Restart containers (will create fresh volumes):**
   ```bash
   docker-compose up -d
   ```

4. **Follow steps from Issue #1 to create schemas and apply migrations**

### 4. Test User Credentials

**Default Test Accounts:**

**Analyst Account:**
- Username: `analyst`
- Email: `analyst@cdc-lims.local`
- Password: `password123`

**Manager Account:**
- Username: `manager`
- Email: `manager@cdc-lims.local`
- Password: `password123`

**Note:** The login form accepts either username or email. If you enter just the username (e.g., `manager`), it will automatically append `@cdc-lims.local`.

### 5. Checking Container Logs

**View logs for specific container:**
```bash
# Auth service
docker logs lims-auth --tail 50

# Postgres
docker logs lims-postgres --tail 50

# PostgREST
docker logs lims-rest --tail 50

# Storage
docker logs lims-storage --tail 50
```

**Follow logs in real-time:**
```bash
docker logs -f lims-auth
```

### 6. Database Access

**Connect to PostgreSQL:**
```bash
docker exec -it lims-postgres psql -U postgres -d postgres
```

**Useful queries:**
```sql
-- Check auth users
SELECT id, email, created_at FROM auth.users;

-- Check public users
SELECT id, username, role FROM public.users;

-- Check samples
SELECT sample_id, client_name, status FROM public.samples LIMIT 10;

-- Check if schemas exist
SELECT schema_name FROM information_schema.schemata;
```

### 7. Resetting the Database

**Complete reset (WARNING: Deletes all data):**
```bash
# Stop and remove everything
docker-compose down -v

# Start fresh
docker-compose up -d

# Wait for postgres to be healthy
Start-Sleep -Seconds 10

# Create schemas
docker exec lims-postgres psql -U postgres -d postgres -c "CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage; CREATE SCHEMA IF NOT EXISTS graphql_public;"

# Restart auth to apply migrations
docker restart lims-auth

# Wait for auth to start
Start-Sleep -Seconds 10

# Apply application migrations
Get-ChildItem -Path .\supabase\migrations\*.sql | Sort-Object Name | ForEach-Object { 
  Write-Host "Applying: $($_.Name)"
  Get-Content $_.FullName | docker exec -i lims-postgres psql -U postgres -d postgres 
}

# Fix passwords
docker exec lims-postgres psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
docker exec lims-postgres psql -U postgres -d postgres -c "UPDATE auth.users SET encrypted_password = crypt('password123', gen_salt('bf')) WHERE email IN ('analyst@cdc-lims.local', 'manager@cdc-lims.local');"
```

## Environment Variables

**Required variables in `.env` file:**

```env
# Database
POSTGRES_PASSWORD=<your-secure-password>

# JWT Configuration
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRY=3600
GOTRUE_REFRESH_TOKEN_EXPIRY=14400

# API URLs
API_EXTERNAL_URL=http://localhost:8000
SITE_URL=http://localhost:3000

# Auth Configuration
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true

# PostgREST
PGRST_DB_SCHEMAS=public,storage,graphql_public

# Service Keys (generate using scripts/generate-jwt-keys.js)
ANON_KEY=<generated-anon-key>
SERVICE_ROLE_KEY=<generated-service-role-key>

# Next.js Client Configuration
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same-as-anon-key>
```

**Generate JWT keys:**
```bash
node scripts/generate-jwt-keys.js
```

## Getting Help

If you encounter issues not covered here:

1. Check Docker container status: `docker ps`
2. Check container logs: `docker logs <container-name>`
3. Verify environment variables are set correctly
4. Ensure all migrations have been applied
5. Check that Supabase API is accessible: `curl http://localhost:8000/auth/v1/health`
