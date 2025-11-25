# **CLAUDE.md \- Claude Code Configuration for CDC-LIMS**

## **Project Context**

Project: CDC-LIMS (MVP)  
Stack: Next.js 15, Supabase (Docker), PostgreSQL 16  
Goal: 21 CFR Part 11 Compliant Lab System  
Constraint: Single-tenant VPS deployment via Docker Compose

## **Behavioral Directives**

1. **Compliance is Priority:** If I ask for a feature that breaks auditability (like "delete this result"), warn me and suggest a "soft delete" or "void" status instead.  
2. **Docker Aware:** We are self-hosting Supabase. When discussing database changes, provide SQL migrations (supabase/migrations/\*.sql), not just Dashboard instructions.  
3. **Step-by-Step:** Build incrementally. Don't try to generate the entire Grid component in one turn. Start with the structure, then add editing, then add validation.

## **Command Shortcuts**

{  
  "commands": {  
    "dev": "npm run dev",  
    "db:start": "docker compose up \-d",  
    "db:stop": "docker compose down",  
    "lint": "npm run lint",  
    "test": "npm run test" // If we add tests later  
  }  
}

## **File Operations**

### **Priority Files**

1. docker-compose.yml (Infrastructure)  
2. supabase/migrations/ (Database Schema & Triggers)  
3. types/index.ts (Shared Zod Schemas)  
4. app/actions/\*.ts (Business Logic)

## **Code Generation Preferences**

* **React:** Functional components, Hooks, Shadcn UI.  
* **State:** react-hook-form for complex forms (Accessioning, Results).  
* **Styling:** Tailwind CSS utility classes.

## **Working Mode**

1. **/plan** \- Create a plan for the Phase (e.g., "Plan Phase 3: The Grid").  
2. **/implement** \- Execute the plan file by file.  
3. **/fix** \- If the Grid lags or Validation fails.

## **Error Handling**

If a database error occurs (e.g., RLS violation):

1. Check the auth.uid() of the current user.  
2. Review the RLS policy in supabase/migrations.  
3. Ensure the SQL Trigger isn't rejecting the update.

## **Progress Tracking**

Update NOTES.md Checklist after:

* \[ \] Setting up Docker  
* \[ \] Accessioning a sample  
* \[ \] Saving a batch result  
* \[ \] Generating a PDF