# CDC LIMS-Lite

A lightweight Laboratory Information Management System (LIMS) built with Next.js 16, TypeScript, and Supabase.

## 🌐 Localization

**Note:** This application is localized for Vietnamese users. All user interface text is in Vietnamese.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Git

### 1. Clone and Install

```bash
git clone <repository-url>
cd lims-lite
npm install
```

### 2. Environment Setup

Copy the environment template:

```bash
# Windows PowerShell
Copy-Item .env.txt .env

# Linux/Mac
cp .env.txt .env
```

The `.env` file contains all necessary configuration for local development.

### 3. Start Supabase (Docker)

```bash
docker-compose up -d
```

Wait for all containers to start (about 30 seconds). Verify with:

```bash
docker ps
```

You should see 6 containers running:
- `lims-postgres` (healthy)
- `lims-auth` (Up)
- `lims-rest` (Up)
- `lims-storage` (Up)
- `lims-kong` (healthy)
- `lims-studio` (Up)

### 4. Initialize Database

**First time setup only:**

```bash
# Create required schemas
docker exec lims-postgres psql -U postgres -d postgres -c "CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage; CREATE SCHEMA IF NOT EXISTS graphql_public;"

# Restart auth service to apply migrations
docker restart lims-auth

# Wait for auth to start
Start-Sleep -Seconds 10

# Apply application migrations
Get-ChildItem -Path .\supabase\migrations\*.sql | Sort-Object Name | ForEach-Object { 
  Write-Host "Applying: $($_.Name)"
  Get-Content $_.FullName | docker exec -i lims-postgres psql -U postgres -d postgres 
}

# Fix user passwords
docker exec lims-postgres psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
docker exec lims-postgres psql -U postgres -d postgres -c "UPDATE auth.users SET encrypted_password = crypt('password123', gen_salt('bf')) WHERE email IN ('analyst@cdc-lims.local', 'manager@cdc-lims.local');"
```

### 5. Start Next.js Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Login

Use one of the test accounts:

**Analyst Account:**
- Username: `analyst`
- Password: `password123`

**Manager Account:**
- Username: `manager`
- Password: `password123`

## 📁 Project Structure

```
lims-lite/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── (auth)/       # Authentication pages
│   │   ├── (dashboard)/  # Dashboard layouts
│   │   │   ├── analyst/  # Analyst role pages
│   │   │   └── manager/  # Manager role pages
│   │   └── actions/      # Server Actions (API layer)
│   ├── components/       # Reusable UI components
│   ├── lib/              # Utilities and Supabase client
│   └── types/            # TypeScript types and Zod schemas
├── supabase/
│   ├── migrations/       # Database migrations
│   └── kong.yml          # API Gateway configuration
├── scripts/              # Utility scripts
└── docker-compose.yml    # Supabase stack configuration
```

## 🛠️ Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **UI Components:** Shadcn UI (Radix UI + Tailwind)
- **Backend:** Supabase (PostgreSQL + GoTrue Auth + PostgREST)
- **State Management:** React Server Components + Server Actions
- **Form Handling:** React Hook Form + Zod
- **Deployment:** Docker Compose (local), Railway/Render (production)

## 📚 Documentation

- **[GEMINI.md](./GEMINI.md)** - Architecture and development guide
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[SUPABASE_CLOUD_DEPLOYMENT.md](./SUPABASE_CLOUD_DEPLOYMENT.md)** - Production deployment guide

## 🐛 Troubleshooting

If you encounter issues:

1. **Authentication errors (503):** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#1-authentication-errors-503-service-unavailable)
2. **Login fails:** Ensure Docker containers are running and passwords are set correctly
3. **Source map warnings:** These are harmless development warnings and can be ignored

**Quick health check:**

```bash
# Check if Supabase is running
curl http://localhost:8000/auth/v1/health

# Expected response:
# {"version":"vunspecified","name":"GoTrue","description":"GoTrue is a user registration and authentication API"}
```

## 🔧 Development

### Type Checking

```bash
npm run typecheck
```

### Building for Production

```bash
npm run build
```

### Database Management

**Access PostgreSQL:**
```bash
docker exec -it lims-postgres psql -U postgres -d postgres
```

**View Supabase Studio:**
Open [http://localhost:3002](http://localhost:3002)

### Stopping Services

```bash
# Stop containers (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Stop and remove everything including data
docker-compose down -v
```

## 📝 License

[Your License Here]

## 🤝 Contributing

[Your Contributing Guidelines Here]
