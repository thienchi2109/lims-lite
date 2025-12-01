# **CLAUDE.md \- Claude Code Configuration for CDC-LIMS**

## **Project Context**

**Project:** CDC-LIMS (MVP)
**Stack:** Next.js 16, React 19, Supabase (Self-hosted), PostgreSQL 16
**Goal:** 21 CFR Part 11 Compliant Lab Information Management System
**Deployment:** Docker Compose (VPS) or Railway/Render (Cloud)
**Localization:** Vietnamese UI (all user-facing text must be in Vietnamese)

## **Current Status**

This project is in active development with core features implemented:
- ✅ Authentication & Role-Based Access Control (Analyst/Manager)
  - Token Expiry: Access tokens (1h), Refresh tokens (4h) - enforces re-login after 4 hours
  - Configuration: `GOTRUE_JWT_EXP=3600`, `GOTRUE_REFRESH_TOKEN_EXPIRY=14400`
- ✅ Sample Accessioning (Manual & QR Scanner)
- ✅ Test Assignment (POS-style UI with server-side search)
- ✅ Results Grid (TanStack Table with editable cells)
- ✅ Approval Queue & Workflow
- ✅ Audit Logging (Database triggers)
- 🚧 PDF Report Generation (In progress)

## **Behavioral Directives**

### **1. Compliance First**
- **Never** suggest features that break auditability (e.g., "delete this result")
- Always recommend "soft delete" or "void" status instead
- All data changes must be traceable via audit logs
- Respect RLS policies - don't bypass security

### **2. Database Changes via Migrations**
- We self-host Supabase in Docker
- **Always** provide SQL migration files in `supabase/migrations/`
- Don't suggest Dashboard-only changes
- Include RLS policies and triggers in migrations

### **3. Incremental Development**
- Build features step-by-step
- Start with structure, then add functionality, then validation
- Don't generate entire complex components in one turn
- Test each increment before moving forward

### **4. Vietnamese Localization**
- **All UI text must be in Vietnamese**
- Reference `docs/vietnamese_dictionary.md` for standard translations
- Use proper Vietnamese grammar and terminology
- Only code comments and technical documentation may be in English

### **5. Type Safety**
- Use Zod schemas for validation (defined in `src/types/index.ts`)
- Leverage TypeScript strictly - no `any` types
- Server Actions must validate inputs with Zod before DB operations

## **Development Commands**

```bash
# Development
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
npm run typecheck        # TypeScript type checking

# Database (Docker)
docker compose up -d     # Start Supabase stack
docker compose down      # Stop Supabase stack
docker compose logs -f   # View logs
```

## **Project Structure**

```
lims-lite/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Login routes
│   │   ├── (dashboard)/         # Protected routes
│   │   │   ├── analyst/         # Analyst role pages
│   │   │   └── manager/         # Manager role pages
│   │   ├── actions/             # Server Actions (auth, samples, results)
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Landing page
│   ├── components/
│   │   ├── ui/                  # Shadcn UI primitives
│   │   ├── results-grid.tsx     # TanStack Table for batch entry
│   │   ├── sample-accession-form.tsx
│   │   ├── test-assignment-dialog.tsx
│   │   ├── approval-queue-table.tsx
│   │   └── ...                  # Other domain components
│   ├── lib/
│   │   ├── supabase/            # Supabase client/server setup
│   │   ├── data/                # Data fetching utilities
│   │   ├── utils.ts             # General utilities
│   │   └── utils-lims.ts        # LIMS-specific utilities
│   ├── types/
│   │   └── index.ts             # Zod schemas & TypeScript types
│   └── middleware.ts            # Auth middleware
├── supabase/
│   └── migrations/              # SQL migrations (versioned)
├── docs/                        # Project documentation
├── docker-compose.yml           # Local Supabase stack
├── railway-docker-compose.yml   # Railway deployment config
└── Dockerfile                   # Next.js container
```

## **Priority Files (Most Frequently Modified)**

1. **`supabase/migrations/*.sql`** - Database schema, RLS policies, triggers
2. **`src/types/index.ts`** - Shared Zod schemas and TypeScript types
3. **`src/app/actions/*.ts`** - Server Actions (business logic)
4. **`src/components/*.tsx`** - Feature components (forms, grids, dialogs)
5. **`docker-compose.yml`** - Infrastructure configuration

## **Code Generation Preferences**

### **React Components**
- Functional components with TypeScript
- Use React 19 features (Server Components, Actions)
- Shadcn UI for all UI primitives
- Use `lucide-react` for icons

### **Forms & Validation**
- `react-hook-form` for complex forms (Accessioning, Results)
- `@hookform/resolvers` with Zod for validation
- Server-side validation in Server Actions

### **Data Tables**
- `@tanstack/react-table` v8 for data grids
- Editable cells via `react-hook-form` integration
- Keyboard navigation support (Tab, Arrow keys)

### **Styling**
- Tailwind CSS v4 utility classes
- Use `cn()` helper from `lib/utils.ts` for conditional classes
- Follow existing component patterns for consistency

### **State Management**
- React Server Components for data fetching
- `useState`/`useReducer` for local UI state
- Server Actions for mutations
- No global state library (keep it simple)

## **Common Patterns**

### **Server Action with Validation**
```typescript
// src/app/actions/samples.ts
'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const schema = z.object({
  sampleId: z.string().min(3),
  clientId: z.string().uuid()
})

export async function createSample(formData: FormData) {
  const supabase = await createClient()

  // Parse and validate
  const result = schema.safeParse(Object.fromEntries(formData))
  if (!result.success) {
    return { error: result.error.flatten() }
  }

  // Insert to database
  const { error } = await supabase
    .from('samples')
    .insert(result.data)

  if (error) return { error: error.message }

  revalidatePath('/manager/samples')
  return { success: true }
}
```

### **Database Trigger for Audit Logging**
```sql
-- supabase/migrations/002_audit_triggers.sql
CREATE TRIGGER audit_log_trigger
  AFTER UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();
```

## **Error Handling Checklist**

When a database error occurs:

1. **Check RLS Policies**
   - Review `supabase/migrations/003_rls_policies.sql`
   - Verify user role matches policy requirements
   - Check `auth.uid()` is being passed correctly

2. **Check Triggers**
   - Review `supabase/migrations/002_audit_triggers.sql`
   - Ensure trigger isn't rejecting valid updates
   - Check trigger function logic

3. **Check Input Validation**
   - Verify Zod schema matches database constraints
   - Check for required fields
   - Validate data types match

4. **Common Issues**
   - "RLS violation" → Analyst trying to modify approved result
   - "Foreign key violation" → Referenced record doesn't exist
   - "Not null violation" → Required field is missing

## **Testing Workflow**

### **Manual Testing Checklist**
- [ ] Login as Analyst → Can access only analyst pages
- [ ] Login as Manager → Can access all pages
- [ ] Accession sample → QR scanner works, form validates
- [ ] Assign tests → Search works, tests are assigned
- [ ] Enter results → Grid navigation, validation, batch save
- [ ] Approve results → Approval dialog, audit log updated
- [ ] Check audit log → All changes are recorded
- [ ] Generate PDF → Report contains correct data

### **Database Verification**
```sql
-- Check audit logs
SELECT * FROM audit_logs
WHERE record_id = '<sample-id>'
ORDER BY timestamp DESC;

-- Check RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'results';
```

## **Deployment**

### **Local Development**
1. Start Supabase: `docker compose up -d`
2. Run migrations: Check `docs/DATABASE_SETUP.md`
3. Start Next.js: `npm run dev`
4. Access: http://localhost:3000

### **Production (Docker Compose)**
- Follow `docs/DOCKER_SETUP.md`
- Single-tenant VPS deployment
- Nginx reverse proxy recommended

### **Cloud (Railway/Render)**
- Follow `docs/DEPLOYMENT_RAILWAY.md` or `docs/DEPLOYMENT_RENDER.md`
- Use `railway-docker-compose.yml` for Railway
- Supports managed PostgreSQL + Next.js container

## **Reference Documentation**

- **Requirements:** `docs/cdc-lims-mvp.md`
- **Technical Design:** `docs/TechDesign-CDC-LIMS.md`
- **Setup Guides:** `docs/DATABASE_SETUP.md`, `docs/DOCKER_SETUP.md`
- **Deployment:** `docs/DEPLOYMENT_*.md`
- **Localization:** `docs/vietnamese_dictionary.md`
- **Progress Notes:** `docs/NOTES.md`

## **Key Principles**

1. **Data Integrity > Speed** - Always prioritize correctness
2. **Audit Everything** - Changes must be traceable
3. **Respect Roles** - Enforce RBAC at database and UI levels
4. **Build Incrementally** - Small, testable changes
5. **Vietnamese First** - All UI text in Vietnamese
6. **Type Safe** - Use TypeScript and Zod strictly
7. **Self-Documented** - Code should be clear without excessive comments