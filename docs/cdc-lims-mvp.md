# Product Requirements Document: CDC-LIMS MVP

## Executive Summary

**Product:** CDC-LIMS (Lite Laboratory Information Management System)
**Version:** MVP (1.0)
**Document Status:** Draft
**Target Launch:** 30 Days (Aggressive)

### Product Vision
To provide a high-velocity, compliant replacement for spreadsheet-based lab management. CDC-LIMS combines the speed of Excel-like data entry with the regulatory safety of a 21 CFR Part 11 compliant database, deployable as a single-tenant self-hosted solution.

### Success Criteria
- **Efficiency:** Analysts can enter batch results 50% faster than current spreadsheet methods via the editable grid.
- **Compliance:** 100% of critical data changes (Result Entry, Status Change) are captured in an immutable audit log.
- **Adoption:** System successfully processes a complete sample lifecycle from Accession to CoA generation without critical errors.

## Problem Statement

### The "Spreadsheet" Problem
Labs currently use Excel for flexibility, but suffer from:
1.  **Lack of Auditability:** No record of who changed a result and why.
2.  **Data Fragility:** Easy to accidentally delete or overwrite data.
3.  **Workflow Bottlenecks:** Manual email/chat handoffs for approval.

### Our Solution
A web-based system that offers "Excel-like" speed for entry but enforces strict RBAC and immutable history in the background.

## Target Audience & RBAC

### Primary Persona: The Lab Analyst
- **Role:** Technician / Bench Chemist.
- **Goal:** Get samples done. Wants to scan a barcode, type numbers fast, and go home. Hates clicking "Save" on every single row.
- **Permissions:** `read:samples`, `write:results`. **Cannot** approve results.

### Secondary Persona: The Lab Manager (QA)
- **Role:** Supervisor / Approver.
- **Goal:** Ensure accuracy and release reports. Needs to see *what* changed and *who* did it before clicking approve.
- **Permissions:** `assign:tests`, `approve:results`, `generate:reports`, `manage:users`.

*(Note: Viewer role excluded for MVP to simplify Auth logic)*

## User Stories

### Epic 1: Sample Accessioning & Assignment
- "As a **Manager**, I want to manually enter sample details or scan a QR code so that the sample is tracked in the system."
- "As a **Manager**, I want to assign specific assays (Tests) to a sample so analysts know what work to do."

### Epic 2: High-Velocity Data Entry (The "Grid")
- "As an **Analyst**, I want to view a list of pending tests in an editable grid (Excel-style) so I can enter multiple results rapidly without navigating pages."
- "As an **Analyst**, I want immediate validation warnings (e.g., 'pH > 14') so I don't commit impossible data."

### Epic 3: Review & Approval
- "As a **Manager**, I want to see a visual indicator if a result was modified after initial entry (Audit flag)."
- "As a **Manager**, I want to **bulk approve** a batch of samples to release them for reporting."

### Epic 4: Reporting
- "As a **Manager**, I want to generate a PDF Certificate of Analysis (CoA) for approved samples."

## Functional Requirements (MoSCoW)

### Must Have (P0 - MVP)

#### 1. Auth & RBAC (Supabase)
- **Email/Password Login.**
- **Role Enforcement:**
    - Analysts see "My Pending Tests".
    - Managers see "All Active Samples".
    - RLS policies must prevent Analysts from modifying approved results.

#### 2. Sample Management (The Core)
- **Manual Entry Form:** Client, Sample ID, Date Received.
- **QR/Barcode Support:** Input field accepts barcode scanner text input.
- **Status Workflow:** Received -> Assigned -> In Progress -> Review -> Completed.

#### 3. Dynamic Assay Configuration
- **Test Definitions:** Ability to define a test (e.g., "pH") and its expected fields (Numeric Result, Units).
- *Constraint:* For MVP, tests can be simple Key-Value pairs or pre-defined schema types to speed up dev.

#### 4. Batch Result Entry Grid
- **UI Component:** TanStack Table with editable cells.
- **Behavior:**
    - Tab navigation between cells.
    - Local validation (Red border on invalid type).
    - "Save Batch" commits all changes transactionally.

#### 5. Audit Trail (21 CFR Part 11 Lite)
- **Database Trigger:** Automatically records `table_name`, `record_id`, `old_value`, `new_value`, `user_id`, `timestamp` on UPDATE.
- **UI:** A "History" button on the sample detail view to show the log.

#### 6. Reporting
- **CoA Generation:** Simple PDF layout (Header, Sample Info, Results Table, Footer signature placeholder).

### Should Have (P1 - Post-Launch)
- Electronic Signatures (Re-enter password to approve).
- Complex multi-analyte assays (e.g., Pesticide Screen with 50 analytes per sample).
- Client Portal (Viewer Role).

### Won't Have (MVP)
- Instrument Integration (RS232/Serial data capture).
- Invoicing / Billing.
- Inventory Management (Reagent tracking).

## Non-Functional Requirements

### Performance
- **Grid Load:** < 1s for batches of up to 100 samples.
- **Search:** Instant filtering on Sample ID.

### Compliance & Security
- **Data Integrity:** No hard deletes. "Deleted" samples are marked `deleted_at` (Soft Delete).
- **Traceability:** Every result must be linked to the User ID who created it.

## UI/UX Direction

### "Lab Mode" (Mobile/Tablet)
- **Focus:** Large buttons, high contrast.
- **Main Action:** Big "Scan" button or input field focused by default.
- **View:** Card view (not table) for individual sample processing.

### "Manager View" (Desktop)
- **Focus:** Density.
- **View:** Data grids, bulk action toolbars ("Approve Selected").

## Constraints & Risks

### Constraints
- **Timeline:** 30 Days strict.
- **Budget:** Flexible (Paid AI tools allowed).
- **Deployment:** Manual Docker Compose on VPS (Single Tenant).

### Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| **Scope Creep** | High | Strict adherence to P0 features. If the Grid is too complex, fallback to single forms. |
| **Audit Performance** | Medium | Ensure audit logs are in a separate table/partition to not slow down reads. |
| **Validation Complexity** | High | Use Zod for shared validation logic (Frontend & Backend) to avoid duplication. |

## MVP Definition of Done
- [ ] Analyst can log in, scan a sample, and enter results via Grid.
- [ ] Manager can see those results, view the audit history, and bulk approve.
- [ ] A PDF report can be downloaded for the approved sample.
- [ ] Database contains a queryable audit log of the session.

---
*Next Steps: Technical Design (Schema & Architecture)*