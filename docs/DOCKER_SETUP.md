# 🐳 Docker Setup Guide for CDC-LIMS

This guide will help you set up the self-hosted Supabase stack using Docker Desktop.

## 📋 Prerequisites

- ✅ Docker Desktop installed and running
- ✅ Project files cloned/created

## 🚀 Quick Start

### Step 1: Create Environment File

Create a `.env` file in the project root (`d:\lims-lite\.env`) with the following content:

```env
# =============================================================================
# CDC-LIMS Environment Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password

# -----------------------------------------------------------------------------
# JWT Configuration (IMPORTANT: Change these in production!)
# -----------------------------------------------------------------------------
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
JWT_EXPIRY=3600
# Refresh token expiry is a sliding inactivity timeout (NOT a hard max session lifetime).
GOTRUE_REFRESH_TOKEN_EXPIRY=14400

# -----------------------------------------------------------------------------
# API Configuration
# -----------------------------------------------------------------------------
API_EXTERNAL_URL=http://localhost:8000
SITE_URL=http://localhost:3000

# -----------------------------------------------------------------------------
# Auth Configuration
# -----------------------------------------------------------------------------
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ADDITIONAL_REDIRECT_URLS=

# -----------------------------------------------------------------------------
# PostgREST Configuration
# -----------------------------------------------------------------------------
PGRST_DB_SCHEMAS=public,storage,graphql_public

# -----------------------------------------------------------------------------
# Supabase Keys (Demo keys - CHANGE IN PRODUCTION!)
# -----------------------------------------------------------------------------
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# -----------------------------------------------------------------------------
# Next.js Supabase Client Configuration
# -----------------------------------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Next.js App Security Configuration
# -----------------------------------------------------------------------------
# Absolute max session lifetime (enforced by the Next.js app).
SESSION_TIMEBOX_SECONDS=14400
```

If you change token expiry settings later, restart the stack so GoTrue picks up the new values:
```bash
docker-compose down && docker-compose up -d
```

### Step 2: Build Custom PostgreSQL Image (First Time Only)

CDC-LIMS uses a **custom PostgreSQL image** with the **pg_textsearch** extension (Timescale's BM25 full-text search) compiled from source. This is a one-time build process.

#### Initial Build (5-10 minutes)

```bash
# Build the custom PostgreSQL image with pg_textsearch
docker compose build postgres
```

**What happens during the build:**
1. **Stage 1 (Builder)**: Installs PostgreSQL 15 dev tools, compiles pg_textsearch C extension using `make`
2. **Stage 2 (Runtime)**: Creates final image based on `supabase/postgres:15.8.1.085` with the compiled extension

**Expected output:**
- Total build time: 2-3 minutes (first build)
- Final image size: ~700MB (includes Supabase Postgres + pg_textsearch)
- Extension files installed to:
  - `/usr/lib/postgresql/15/lib/pg_textsearch.so`
  - `/usr/share/postgresql/15/extension/pg_textsearch.control`
  - `/usr/share/postgresql/15/extension/pg_textsearch--*.sql`

**Subsequent builds** (when you rebuild due to docker-compose.yml changes) will be much faster thanks to Docker layer caching.

#### Why Custom Build?

The pg_textsearch extension is not available in the standard Supabase image. We compile it from source using:
- **Git repository**: https://github.com/timescale/pg_textsearch
- **Version**: v0.1.1-dev (latest from main branch)
- **Build system**: PostgreSQL PGXS (traditional C extension)
- **Base image**: supabase/postgres:15.8.1.085

### Step 3: Start Docker Services

After building the custom image, start all services:

```bash
docker compose up -d
```

This will start all services in detached mode:
- 🗄️ **PostgreSQL with pg_textsearch** (port 5432)
- 🔐 **GoTrue Auth** (port 9999)
- 🌐 **PostgREST API** (port 3001)
- 📦 **Storage API** (port 5000)
- 🚪 **Kong Gateway** (port 8000)

### Step 4: Verify Services

Check that all services are running:

```bash
docker-compose ps
```

You should see all 5 services with status "Up".

### Step 5: Check Logs (if needed)

View logs for all services:
```bash
docker-compose logs -f
```

View logs for a specific service:
```bash
docker-compose logs -f postgres
docker-compose logs -f auth
docker-compose logs -f rest
```

### Step 6: Install Dependencies & Start Next.js

In a new terminal, install npm dependencies:
```bash
npm install
```

Then start the Next.js development server:
```bash
npm run dev
```

Your application will be available at [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture Overview

```
┌─────────────────┐
│   Next.js App   │
│  localhost:3000 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Kong Gateway   │◄─────┤  GoTrue Auth │
│ localhost:8000  │      │ port 9999    │
└────────┬────────┘      └──────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌─────────┐
│PostgREST│ │ Storage │
│port 3001│ │port 5000│
└───┬────┘ └────┬────┘
    │           │
    └─────┬─────┘
          ▼
    ┌──────────┐
    │PostgreSQL│
    │ port 5432│
    └──────────┘
```

## 📡 Service Endpoints

| Service | Internal Port | External Port | Purpose |
|---------|--------------|---------------|---------|
| Kong Gateway | 8000 | 8000 | Main API Gateway (use this for Supabase client) |
| PostgreSQL | 5432 | 5432 | Database |
| GoTrue | 9999 | 9999 | Authentication service |
| PostgREST | 3000 | 3001 | REST API for database |
| Storage | 5000 | 5000 | File storage |

## 🛠️ Useful Commands

### Stop all services
```bash
docker-compose down
```

### Stop and remove volumes (⚠️ deletes all data)
```bash
docker-compose down -v
```

### Restart all services
```bash
docker-compose restart
```

### Restart a specific service
```bash
docker-compose restart postgres
```

### View resource usage
```bash
docker stats
```

### Access PostgreSQL directly
```bash
docker exec -it lims-postgres psql -U postgres
```

## 🔍 Troubleshooting

### pg_textsearch Build Issues

#### Build fails with "make: command not found"
The build-essential package installation failed. Check Docker has enough disk space (need ~1GB for build).

#### Build takes longer than 5 minutes
The C compilation should be fast. If it's slow, check your Docker resource allocation in Docker Desktop settings.

#### Extension files not found after build
The Dockerfile includes verification checks that will fail the build if extension files are missing. If you see this error, check:
```bash
docker compose build postgres --no-cache
```

#### Verify pg_textsearch installation
After starting the stack, verify the extension is available:
```bash
docker exec lims-postgres psql -U postgres -c "SELECT * FROM pg_available_extensions WHERE name = 'textsearch';"
```

### Port Conflicts

If you get port conflict errors, check what's using the ports:

**Windows:**
```bash
netstat -ano | findstr :8000
netstat -ano | findstr :5432
netstat -ano | findstr :3001
```

### Database Not Initializing

If migrations aren't running automatically:

1. Access the database:
```bash
docker exec -it lims-postgres psql -U postgres
```

2. Run migrations manually:
```bash
docker exec -i lims-postgres psql -U postgres < supabase/migrations/001_initial_schema.sql
docker exec -i lims-postgres psql -U postgres < supabase/migrations/002_audit_triggers.sql
docker exec -i lims-postgres psql -U postgres < supabase/migrations/003_rls_policies.sql
```

### Services Won't Start

Check logs for errors:
```bash
docker-compose logs
```

Ensure Docker Desktop has enough resources allocated (Settings → Resources).

### Reset Everything

If you need to start fresh:
```bash
# Stop and remove everything
docker-compose down -v

# Remove any orphaned containers
docker system prune -a

# Start again
docker-compose up -d
```

## 🔒 Security Notes

> [!CAUTION]
> The default passwords and JWT secrets in this guide are for **local development only**!

For production deployment:

1. **Generate strong passwords** for `POSTGRES_PASSWORD`
2. **Generate a strong JWT secret** (at least 32 characters) for `JWT_SECRET`
3. **Generate new Supabase keys** using the Supabase CLI or JWT generator
4. **Use environment-specific .env files** and never commit them to git

## 📚 Next Steps

After Docker is running:

1. Create a test user in the database
2. Test login at [http://localhost:3000/login](http://localhost:3000/login)
3. Verify role-based access (Analyst vs Manager)
4. Test database operations through the UI

## 📖 Additional Resources

- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kong Gateway Documentation](https://docs.konghq.com/)
