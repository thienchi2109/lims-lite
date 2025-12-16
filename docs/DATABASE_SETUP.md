# Database Setup Instructions

## Current Status
- ✅ Supabase Studio container added to docker-compose.yml
- ✅ Fixed SQL script created at `scripts/fixed-setup.sql`
- ⚠️ uuid-ossp extension cannot be enabled via SQL (Supabase Postgres image limitation)

## The Issue
The `supabase/postgres` Docker image includes init scripts that require the `supabase_admin` role, which doesn't exist in a standalone setup. This blocks the `uuid-ossp` extension from being created.

## Solution: Manual Setup via Supabase Studio

### Step 1: Access Supabase Studio
Open your browser and go to: **http://localhost:3002**

### Step 2: Connect to Database  
Studio should auto-connect to your local Postgres. If prompted:
- Host: `postgres`
- Port: `5432`
- Database: `postgres`
- User: `postgres`
- Password: `your-super-secret-and-long-postgres-password`

### Step 3: Enable uuid-ossp Extension
1. Go to **Database** → **Extensions**
2. Search for "uuid-ossp"
3. Click **Enable**

### Step 4: Run Setup SQL
1. Go to **SQL Editor**
2. Click **New query**
3. Copy the contents of `scripts/fixed-setup.sql`
4. Paste and click **Run**

This will create:
- 5 tables (users, methods, assay_definitions, samples, results, audit_logs)
- 2 test users (analyst + manager)
- 2 methods
- 5 assays with validation rules
- 20 sample records
- 25 pending test results

### Step 5: Create Auth Users (IMPORTANT!)
The SQL creates records in `auth.users` and `public.users`, but **passwords are NOT set**.

To actually log in to the app:
1. In Studio, go to **Authentication** → **Users**
2. Click **Add user**
3. Create:
   - Email: `analyst@cdc-lims.local`
   - Password: `password123`
   - Confirm password
4. Repeat for manager:
   - Email: `manager@cdc-lims.local`
   - Password: `password123`

### Step 6: Verify Setup
In SQL Editor, run:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

SELECT 'Users:' || COUNT(*) FROM public.users
UNION ALL SELECT 'Samples:' || COUNT(*) FROM public.samples
UNION ALL SELECT 'Results:' || COUNT(*) FROM public.results;
```

You should see:
- 6 tables
- 2 users
- 20 samples  
- 25 results

## Alternative: Use Standard Postgres Image

If you prefer to avoid Supabase-specific issues, update `docker-compose.yml`:

```yaml
postgres:
  image: postgres:15-alpine  # Instead of supabase/postgres
```

Then restart and you can use the command-line approach.

⚠️ **Realtime requirement:** Supabase Realtime `postgres_changes` needs the `wal2json` output plugin.
The vanilla `postgres:15-alpine` image does **not** include `wal2json`, so Realtime will log:
`could not access file "wal2json": No such file or directory`
and no realtime updates will be delivered. If you need realtime, use a Postgres image that bundles `wal2json`
(e.g. `supabase/postgres`) or build a custom Postgres image with `wal2json` installed.

## Verification
Once complete, you can start the Next.js app:
```bash
npm run dev
```

Login with:
- **Analyst:** analyst@cdc-lims.local / password123
- **Manager:** manager@cdc-lims.local / password123
