# **NOTES.md \- AI Agent Instructions for CDC-LIMS**

## **🎯 Project Overview**

You're building CDC-LIMS (Lite Laboratory Information Management System).  
Please:

* Explain complex compliance concepts (like Audit Trails) simply but implement them strictly.  
* Provide working code with clear comments, especially for the "Grid" and validation logic.  
* Focus on the "Happy Path" first, then add the regulatory guardrails.  
* Balance the speed of development with the strict requirements of data integrity.

## **📚 What We're Building**

App: CDC-LIMS (MVP 1.0)  
Purpose: A high-velocity, compliant replacement for spreadsheet-based lab management.  
Tech Stack:

* **Frontend:** Next.js 15 (App Router) with React 19\. Chosen for Server Actions and robust ecosystem.  
* **Styling:** Tailwind CSS \+ Shadcn/ui. Chosen for speed and dense, accessible lab-style components.  
* **Backend/Database:** Supabase (Self-hosted via Docker) with PostgreSQL 16\. Chosen for out-of-the-box Auth, RLS, and Auto-generated APIs.  
* Deployment: Manual Docker Compose on a single-tenant VPS.  
  Learning Goals: Server Actions, TanStack Table (Headless UI), Zod Validation, Row Level Security (RLS), PDF Generation.

## **🛠 Setup Instructions**

### **Prerequisites Check**

\# Ensure these are installed:  
node \--version  \# v18+ or v20+  
npm \--version   \# Recent version  
docker \--version \# Required for local Supabase stack  
git \--version   \# Any recent version

### **Project Initialization**

\# Initialize Next.js app  
npx create-next-app@latest cdc-lims \--typescript \--tailwind \--eslint  
cd cdc-lims

\# Install Core Dependencies  
npm install @supabase/ssr @supabase/supabase-js  
npm install zod react-hook-form @hookform/resolvers  
npm install @tanstack/react-table  
npm install lucide-react clsx tailwind-merge  
npm install @react-pdf/renderer

\# Initialize Shadcn UI  
npx shadcn-ui@latest init

### **Project Structure**

cdc-lims/  
├── app/  
│   ├── (auth)/        \# Login routes  
│   ├── (dashboard)/   \# Protected routes (Manager/Analyst views)  
│   ├── api/           \# Route handlers (if needed outside Actions)  
│   └── actions/       \# Server Actions (Write operations)  
├── components/  
│   ├── ui/            \# Shadcn primitives  
│   ├── grid/          \# TanStack Table components  
│   └── forms/         \# Accessioning forms  
├── lib/  
│   ├── supabase/      \# Client/Server clients  
│   └── utils.ts       \# Helpers  
├── types/             \# Zod schemas & TypeScript interfaces  
├── supabase/  
│   ├── migrations/    \# SQL for Tables, RLS, Triggers  
│   └── config.toml  
└── docker-compose.yml \# Deployment config

## **🚀 Implementation Phases**

### **Phase 1: Infrastructure & Auth (Week 1\)**

**Goal:** User can log in and see a dashboard with role-based access.

1. **Setup Docker & Database**  
   * Create docker-compose.yml for self-hosted Supabase.  
   * Create schema.sql with Users, RLS policies, and basic Table structure.  
   * Run docker compose up \-d.  
2. **Implement Authentication**  
   * Setup Supabase Auth (Username/Password).  
   * Create Login Page (app/(auth)/login/page.tsx).  
   * Create Auth Middleware to protect routes and redirect based on Role (Analyst vs Manager).  
3. **Test Foundation**  
   * Action: Log in as an Analyst.  
   * Expected: Redirected to /dashboard/analyst. Accessing /dashboard/manager should fail.

### **Phase 2: Sample Accessioning (Week 2\)**

**Goal:** Samples can be created via manual entry or barcode scan.

1. **Create Sample Schema & Zod Types**  
   * Define SampleSchema in types/index.ts.  
   * Create Server Action createSample in app/actions/samples.ts.  
2. **Build Accession Form**  
   * Create components/forms/AccessionForm.tsx.  
   * Add input field that accepts Barcode Scanner text (simulated as fast keyboard input).  
   * Hook up to createSample action.  
3. **Test Feature**  
   * Action: Scan/Type a Sample ID "2025-001" and submit.  
   * Expected: Sample appears in the "Received" list in the database.

### **Phase 3: The Grid (Week 3\)**

**Goal:** Analyst can enter data for 20 samples and save transactionally. **Critical Feature.**

1. **Build ResultsGrid Component**  
   * Use useReactTable for the data model.  
   * Implement react-hook-form useFieldArray for editable cells.  
   * Key requirement: Keyboard navigation (Arrow keys, Enter to edit).  
2. **Implement Batch Save Action**  
   * Create saveBatchResults Server Action.  
   * Logic: Validate all rows \-\> Start Transaction \-\> Update results table \-\> Create Audit Logs (via DB trigger).  
3. **Test Feature**  
   * Action: Enter results for 5 samples, click "Save Batch".  
   * Expected: Results updated. audit\_logs table contains entries for the changes.

### **Phase 4: Approval & Reporting (Week 4\)**

**Goal:** Full lifecycle: Accession \-\> Result \-\> Approve \-\> Print.

1. **Manager Approval Queue**  
   * Create view for samples with status Review.  
   * Implement approveResults action (locks rows via RLS).  
2. **CoA PDF Generation**  
   * Create components/reports/CoADocument.tsx using @react-pdf/renderer.  
   * Layout: Header (Logo), Sample Info, Results Table, Signature line.  
3. **Deploy to VPS**  
   * Configure Nginx Reverse Proxy.  
   * Run Docker Compose on Host.

## **💡 Learning Resources**

### **For Next.js Server Actions:**

* **Guide:** Next.js Docs "Data Mutation"  
* **Pattern:** Use zod validation inside the action before mutating DB.

### **For TanStack Table:**

* **Concept:** "Headless UI" \- It gives you state, you write the \<table\> markup.  
* **Example:** Look for "Editable Data" examples in TanStack docs.

### **For 21 CFR Part 11 (Audit Trails):**

* **Concept:** Never delete. Always insert a new record or update with a trigger that saves the old value.  
* **Implementation:** Use PostgreSQL Triggers (PL/pgSQL) for reliability.

## **🐛 Common Issues & Solutions**

### **"RLS Policy Violation"**

Why it happens: You are trying to write to a table (e.g., results) as an Analyst, but the row status is 'Approved' (locked).  
Fix:  
Check the SQL Policy:  
\-- Ensure your update query filters out locked rows  
UPDATE results SET value \= ... WHERE id \= ... AND status \!= 'Approved';

### **"Hydration Mismatch in Table"**

Why: Random IDs or Dates generated on Client vs Server.  
Fix: Use useEffect to render the table only after mount, or ensure data is deterministic.

## **📝 Code Patterns to Use**

### **Pattern: Server Action with Zod**

// app/actions/create-sample.ts  
'use server'  
import { z } from 'zod'  
import { createClient } from '@/lib/supabase/server'

const schema \= z.object({  
  sampleId: z.string().min(3),  
  clientId: z.string().uuid()  
})

export async function createSample(prevState: any, formData: FormData) {  
  const supabase \= createClient()  
  const data \= schema.safeParse(Object.fromEntries(formData))

  if (\!data.success) return { error: data.error.flatten() }

  const { error } \= await supabase.from('samples').insert(data.data)  
  if (error) return { error: error.message }  
    
  return { success: true }  
}

### **Pattern: Postgres Audit Trigger**

\-- Always use this structure for audited tables  
CREATE TRIGGER audit\_log\_trigger  
AFTER UPDATE ON results  
FOR EACH ROW EXECUTE FUNCTION trigger\_audit\_log();

## **🧪 Testing Your Features**

### **Manual Testing Checklist:**

* \[ \] **Accession:** Scan a barcode, ensure focus stays on input.  
* \[ \] **Grid:** Navigate 10 rows using only arrow keys.  
* \[ \] **Validation:** Enter text in a numeric result field \-\> See red border immediately.  
* \[ \] **Audit:** Change a result twice. Check audit\_logs table for 2 entries.  
* \[ \] **Report:** Download PDF, verify Sample ID matches.

## **📊 Understanding the Architecture**

### **Data Flow:**

User (Grid Input) \-\> React Hook Form State \-\> Server Action (Batch) \-\> Supabase (Transaction) \-\> Audit Trigger \-\> UI Revalidation

## **🎯 Definition of Done**

Your MVP is complete when:

* \[ \] Analyst can log in, scan a sample, and enter results via Grid.  
* \[ \] Manager can see those results, view the audit history, and bulk approve.  
* \[ \] A PDF report can be downloaded for the approved sample.  
* \[ \] Database contains a queryable audit log of the session.  
* \[ \] Code is deployed via Docker Compose on the VPS.

## **📁 Reference Documents**

* **Requirements:** cdc-lims-mvp.md  
* **Technical Plan:** TechDesign-CDC-LIMS.md

Start with **Phase 1: Infrastructure & Auth**. Good luck\!