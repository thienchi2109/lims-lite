# **Technical Design Document: CDC-LIMS MVP**

## **Executive Summary**

System: CDC-LIMS (Lite Laboratory Information Management System)  
Version: MVP 1.0  
Architecture Pattern: Monolithic Containerized (Single-Tenant)  
Compliance Standard: 21 CFR Part 11 "Lite" (Audit Trails & Security)  
Estimated Effort: 30 Days

## **1\. Architecture Overview**

### **Deployment Architecture (Self-Hosted)**

Given the constraint for a single-tenant VPS deployment using Docker Compose, the system will operate as a self-contained unit.

graph TB  
    subgraph "VPS Host (Ubuntu)"  
        LB\[Nginx Reverse Proxy\]  
          
        subgraph "Application Container"  
            Next\[Next.js 15 App Router\]  
        end  
          
        subgraph "Supabase Stack (Docker)"  
            PG\[PostgreSQL 16\]  
            GoTrue\[Auth Service\]  
            PostgREST\[Auto API\]  
            Storage\[File Storage\]  
        end  
    end

    Client\[Browser\] \--\>|HTTPS / 443| LB  
    LB \--\>|Internal :3000| Next  
    Next \--\>|Env: SUPABASE\_URL| PostgREST  
    Next \--\>|Env: DB\_URL| PG  
      
    %% Direct connection for Auth flows if needed  
    Client \-.-\>|Auth Tokens| GoTrue

### **Tech Stack Decisions**

| Layer | Technology | Justification |
| :---- | :---- | :---- |
| **Frontend** | Next.js 15 (React 19\) | Server Actions simplify backend communication; robust ecosystem. |
| **Styling** | Tailwind CSS \+ Shadcn/ui | Speed of development; accessible, dense UI components suitable for labs. |
| **Backend** | Supabase (Self-hosted) | Provides Auth, Database, and Auto-generated APIs out of the box. |
| **Database** | PostgreSQL 16 | Required for complex queries, JSONB support, and strict RLS policies. |
| **Grid UI** | TanStack Table v8 | Headless architecture allows full control over "Excel-like" behavior. |
| **Validation** | Zod | Shared schemas between Client (Forms) and Server (API/Actions). |
| **PDF** | @react-pdf/renderer | React-based PDF generation for consistent CoAs. |

## **2\. Database Design (Schema & ERD)**

This schema is designed to enforce data integrity and auditability at the database level, ensuring compliance even if the frontend logic fails.

### **Entity Relationship Diagram**

erDiagram  
    users ||--o{ samples : "receives"  
    users ||--o{ audit\_logs : "triggers"  
    users ||--o{ results : "enters/approves"  
      
    samples ||--|{ results : "contains"  
    samples {  
        uuid id PK  
        string sample\_id "Unique (e.g., 2025-001)"  
        uuid client\_id  
        enum status "Received, Assigned, In\_Progress, Review, Completed"  
        timestamp received\_at  
        uuid received\_by FK  
        timestamp deleted\_at "Soft Delete"  
    }

    assay\_definitions ||--o{ results : "defines"  
    assay\_definitions {  
        uuid id PK  
        string name "e.g., pH"  
        string units "e.g., S.U."  
        jsonb validation\_rules "{min: 0, max: 14}"  
    }

    results {  
        uuid id PK  
        uuid sample\_id FK  
        uuid assay\_id FK  
        string value "Stored as text for precision"  
        uuid entered\_by FK  
        uuid approved\_by FK  
        timestamp approved\_at  
        enum status "Pending, Entered, Approved"  
    }

    audit\_logs {  
        uuid id PK  
        string table\_name  
        uuid record\_id  
        string operation "INSERT, UPDATE, DELETE"  
        jsonb old\_values  
        jsonb new\_values  
        uuid changed\_by FK  
        timestamp changed\_at  
    }

### **Critical SQL Implementation Details**

#### **1\. Audit Trail Trigger (Compliance)**

This generic trigger must be applied to samples and results tables to ensure 21 CFR Part 11 compliance (Traceability).

CREATE OR REPLACE FUNCTION trigger\_audit\_log() RETURNS TRIGGER AS $$  
BEGIN  
  IF (TG\_OP \= 'UPDATE') THEN  
    INSERT INTO audit\_logs (table\_name, record\_id, operation, old\_values, new\_values, changed\_by)  
    VALUES (TG\_TABLE\_NAME, OLD.id, TG\_OP, to\_jsonb(OLD), to\_jsonb(NEW), auth.uid());  
    RETURN NEW;  
  ELSIF (TG\_OP \= 'INSERT') THEN  
    INSERT INTO audit\_logs (table\_name, record\_id, operation, new\_values, changed\_by)  
    VALUES (TG\_TABLE\_NAME, NEW.id, TG\_OP, to\_jsonb(NEW), auth.uid());  
    RETURN NEW;  
  END IF;  
  RETURN NULL;  
END;  
$$ LANGUAGE plpgsql SECURITY DEFINER;

#### **2\. Row Level Security (RBAC)**

Strict policies to prevent unauthorized data modification.

\-- ANALYST POLICY  
CREATE POLICY "Analysts can update pending results"  
ON results  
FOR UPDATE  
USING (  
  (auth.jwt() \-\>\> 'role' \= 'analyst') AND (status \!= 'Approved')  
);

\-- MANAGER POLICY  
CREATE POLICY "Managers can do everything"  
ON results  
FOR ALL  
USING (auth.jwt() \-\>\> 'role' \= 'manager');

## **3\. Core Component Design**

### **3.1 The High-Velocity Grid (ResultsGrid.tsx)**

This is the most complex UI component. It replaces Excel for the analysts.

**Requirements:**

1. **Keyboard Navigation:** Arrow keys to move, Enter to edit, Tab to next cell.  
2. **Batch Saving:** No per-row saves; one "Save Batch" button commits transactionally.  
3. **Local Validation:** Immediate red borders for invalid data types (e.g., text in a numeric field).

**Architecture:**

* **State:** useReactTable holds the display state. react-hook-form (useFieldArray) holds the form state.  
* **Sync:** The table cells render input fields registered to the form.  
* **Performance:** Memo heavy components. Use onBlur for validation instead of onChange to prevent input lag.

### **3.2 Certificate of Analysis (CoADocument.tsx)**

Using @react-pdf/renderer to generate PDFs on the client side (or server).

**Structure:**

* **Header:** Lab Logo, Address, Report ID.
* **Sample Info:** Client Name, Date Received, Sample ID.
* **Results Table:** Assay Name, Method, Result, Units, Specifications (Pass/Fail).
* **Footer:** "Approved By: \[Manager Name\] on \[Date\]". Electronic Signature disclaimer.

### **3.3 CoA Generation Authorization**

CoA generation follows role-specific authorization rules to maintain 21 CFR Part 11 compliance while improving workflow efficiency.

**Authorization Rules:**

| Role | Sample Status | Results Requirement | Action |
|------|---------------|---------------------|--------|
| **Analyst** | `completed` only | ALL results must be `approved` | Generate CoA |
| **Manager** | `review` or `completed` | At least ONE result `approved` | Generate CoA |
| **Manager** | Any (with existing CoA) | N/A | Regenerate CoA |

**Server Actions:**

* **generateCoA(sampleId, manualInputs)**: Both analysts and managers can call. Validation helper `validateSampleForCoAGeneration()` enforces role-specific rules.
* **regenerateCoA(sampleId, manualInputs)**: Manager-only. Updates existing CoA record.

**RLS Policies (coa_reports table):**

* **INSERT**: Analysts and managers can insert new CoA records
* **SELECT**: Analysts and managers can read CoA records
* **UPDATE**: Managers only (enforces regeneration restriction at database level)

**Compliance Notes:**

* Signature in CoA links to the **approver** (manager who approved results), not the generator
* Audit logs capture generator identity via `auth.uid()` in INSERT trigger
* Separation of duties: Analysts perform work, managers approve and can regenerate

## **4\. API & Server Actions**

### **Data Fetching Strategy**

* **Fetch:** Use Next.js Server Components to fetch data directly from Supabase (using supabase-js in server mode).  
* **Mutations:** Use Server Actions for all writes (createSample, saveBatchResults, approveResults).

### **API Schema (Server Actions)**

**saveBatchResults(data: BatchResultSchema)**

* **Input:** Array of { result\_id: string, value: string }.  
* **Process:**  
  1. Validate inputs against Zod schema.  
  2. Check user permissions.  
  3. Perform SQL Transaction: Update all records.  
* **Output:** Success/Failure \+ Revalidate Path.

**approveResults(sampleIds: string\[\])**

* **Input:** Array of Sample IDs.  
* **Process:**  
  1. Verify User is Manager.  
  2. Update status to 'Approved', set approved\_by to current user ID.  
  3. Lock rows (RLS policies take effect).

## **5\. Security & Compliance Strategy**

### **Authentication**

* **Provider:** Supabase Auth (Email/Password).  
* **Session:** handled via HTTP-only cookies (@supabase/ssr).  
* **Middleware:** Next.js middleware checks for valid session and redirects to /login if missing.

### **Authorization (RBAC)**

* **Database Level:** RLS Policies (Primary defense).  
* **Application Level:** Layout wrappers (e.g., \<ManagerOnly\>) to hide UI elements.

### **Data Integrity**

* **Soft Deletes:** samples table has deleted\_at. Views filter WHERE deleted\_at IS NULL. Hard deletes are disabled for standard users.  
* **Type Safety:** value column in results is text to preserve significant figures (e.g., "5.00" is distinct from "5"), but cast to numeric for range checks.

## **6\. Development Phases**

### **Phase 1: Infrastructure & Auth (Week 1\)**

* Setup Docker Compose.  
* Define Zod Schemas.  
* Implement Login & Session management.  
* **Milestone:** User can log in and see a dashboard.

### **Phase 2: Sample Accessioning (Week 2\)**

* Create "Add Sample" form.  
* Implement Barcode Scanner input logic.  
* Connect to samples table.  
* **Milestone:** Samples can be created and appear in the list.

### **Phase 3: The Grid (Week 3\)**

* Build ResultsGrid component.  
* Implement Batch Save Server Action.  
* Connect Audit Log triggers.  
* **Milestone:** Analyst can enter data for 20 samples and save. History is recorded.

### **Phase 4: Approval & Reporting (Week 4\)**

* Build Manager "Approval Queue".  
* Implement CoA PDF generation.  
* Final QA and Deploy.  
* **Milestone:** Full lifecycle: Accession \-\> Result \-\> Approve \-\> Print.

## **7\. Configuration Files Needed**

To proceed with the build, the following configuration files will be required in the implementation phase:

1. docker-compose.yml (For local/VPS hosting).  
2. schema.sql (Initial DB migration).  
3. middleware.ts (Next.js Auth protection).  
4. types\_db.ts (Supabase generated types).