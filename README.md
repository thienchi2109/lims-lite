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

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **UI Components:** Shadcn UI (Radix UI + Tailwind)
- **Backend:** Supabase (PostgreSQL + GoTrue Auth + PostgREST)
- **State Management:** React Server Components + Server Actions
- **Form Handling:** React Hook Form + Zod
- **Data Tables:** TanStack Table v8 with tooltips
- **Deployment:** Docker Compose (local), Railway/Render (production)

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Comprehensive project documentation for Claude
- **[GEMINI.md](./GEMINI.md)** - Architecture and development guide
- **[AGENTS.md](./AGENTS.md)** - AI assistant instructions and OpenSpec workflow
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[SUPABASE_CLOUD_DEPLOYMENT.md](./SUPABASE_CLOUD_DEPLOYMENT.md)** - Production deployment guide

## ✨ Recent Features

### Test Assignment Enhancement (Latest)
- **Auto-focus on assigned samples:** After assigning tests, the sample automatically moves to the top of the list and is highlighted
- **Updated timestamp tracking:** Sample `updated_at` field is updated on test assignment
- **Enhanced UI/UX:** Added tooltips throughout the interface for better user guidance
- **Sorting options:** Added `updated_at` sorting in sample filters

### Print Order Form
- A5 format print template for sample order forms
- 95% zoom scale for optimal fit and readability
- Browser print dialog integration

### Full-Text Search (Latest)
- **Vietnamese language support:** Diacritic-insensitive search (finds "Máu" and "Mau" identically)
- **PostgreSQL FTS:** GIN-indexed tsvector columns for sub-50ms query times
- **Global search:** Search across samples, clients, assays, results, and audit logs
- **Relevance ranking:** Results sorted by ts_rank score
- **RLS-compliant:** Manager-only audit log search, role-based access enforcement
- **Zero-downtime deployment:** Production migrations use CREATE INDEX CONCURRENTLY

**Search Capabilities:**
- **Samples:** Search by sample ID, client name, type, status, rejection reason, date
- **Clients:** Search by name, phone, address, ID number, health insurance number
- **Assays:** Search by assay name, units
- **Results:** Search by result value, status, approval notes
- **Audit Logs:** Search by operation, table name, change details (manager only)
- **Global:** Combined search across all entity types

**Technical Highlights:**
- **`unaccent()` extension:** Removes Vietnamese diacritics for normalization
- **`plainto_tsquery()`:** Safe user input handling, prevents syntax errors
- **Automatic triggers:** search_vector columns updated on INSERT/UPDATE
- **Idempotent migrations:** Safe to re-run if interrupted

For detailed setup and usage, see:
- `docs/SEARCH_SETUP.md` - PostgreSQL FTS implementation guide
- `docs/DEPLOYMENT_SEARCH.md` - Production deployment with zero downtime
- `CLAUDE.md` - Search patterns reference

## 🔍 Client Management & QR Intake Workflow

### Overview

The LIMS now supports comprehensive client management with QR code-based sample intake, allowing for rapid patient identification and sample accessioning.

### Client Management

**Features:**
- Client database with full patient information (name, DOB, phone, address, ID number)
- Client search and selection with real-time filtering
- Duplicate prevention based on name + date of birth
- Inline client creation during sample intake
- Client information snapshot preserved with each sample

**Adding a New Client:**
1. Navigate to sample accession page
2. Click the "+" icon or start typing in the client selector
3. Fill in required fields:
   - Họ và tên (Full Name) *
   - Ngày sinh (Date of Birth) *
   - Số điện thoại (Phone)
   - Địa chỉ (Address)
   - Số CMND/CCCD (ID Number)
4. System prevents duplicates by checking Name + DOB combination
5. Client is created and automatically selected

### QR Code Intake Workflow

**QR Code Format:**
```
Name|DD/MM/YYYY|PhoneNumber
```

Example:
```
Nguyễn Văn A|15/03/1990|0987654321
```

**Using QR Scanner:**

1. **Access Sample Intake:**
   - Navigate to `/analyst/accession` page
   - Client selector field is ready to receive QR input

2. **Scan QR Code:**
   - Click the QR scanner icon (📷) in the client selector
   - Allow camera permissions when prompted
   - Point camera at patient's QR code
   - System automatically parses: Name, DOB, Phone Number

3. **Automatic Processing:**
   - **Existing Client Found:** Auto-selects the matching client
   - **New Client:** Pre-fills client form with QR data
     - User can add Address and ID Number if needed
     - Click "Lưu" (Save) to create new client

4. **Complete Sample Intake:**
   - Select sample type (Máu, Nước tiểu, etc.)
   - Optionally set received time
   - Optionally assign tests immediately
   - Click "Tạo mẫu và chỉ định" or "Tạo mẫu" (if no tests)

**Sample Creation Modes:**
- **With Tests:** Sample status = `assigned` (ready for analysis)
- **Without Tests:** Sample status = `received` (tests assigned later)

### Technical Implementation

**Database Schema:**
- `clients` table: Stores patient information
- `samples.client_id` → `clients.id`: Foreign key relationship
- `samples.client_name`: Snapshot of name at sample creation time
- RLS policies ensure analysts can only access their own samples

**QR Scanner:**
- Uses browser's native camera API (`getUserMedia`)
- Real-time QR detection with `@zxing/library`
- Throttled error handling (1 error/second max) for performance
- Graceful camera release on component unmount

**PostgREST Integration:**
- `create_sample_atomic()`: Creates sample with atomic ID generation
- `accession_and_assign_tests()`: Combined sample + test assignment
- Parameters ordered alphabetically for PostgREST compatibility

**Sample ID Format:**
```
CDC-XN-DDMMYYYY-XXXX
```
- Sequential numbering per day
- Atomic generation prevents duplicates
- Example: `CDC-XN-11122025-0001`

### Migration Notes

If you're upgrading from a previous version:

1. **Migration 039-042:** Adds clients table and updates samples schema
2. **Migration 043-044:** Updates RPC functions for sample type support
3. **Data Backfill:** Existing samples get placeholder clients with their client_name

Apply migrations in order:
```bash
Get-ChildItem -Path .\supabase\migrations\0{39..44}*.sql | Sort-Object Name | ForEach-Object { 
  Get-Content $_.FullName | docker exec -i lims-postgres psql -U postgres -d postgres 
}
```

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
