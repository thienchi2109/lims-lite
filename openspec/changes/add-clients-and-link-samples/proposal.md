## Why
- Analysts need to capture client identity quickly via QR from ID cards without retyping.
- Samples must link to a canonical client record for auditability while still snapshotting client name.
- Current schema lacks a clients table, uses free-text client_name and sample type enum; no normalized identity or QR parsing path.

## What Changes
- Add `clients` table with required `name`, `date_of_birth` (DATE), `gender` (CHECK: Nam/Nữ/Khác), `id_card_num` (required, stored), optional address/expiry/health insurance, and audit timestamps.
- Enforce UNIQUE `(name, date_of_birth)` to curb duplicates; keep UUID PK. Add CHECKs for gender.
- Update `samples`: replace `type` enum with TEXT + CHECK using provided Vietnamese list; make `client_id` NOT NULL FK to `clients(id)`; keep `client_name` snapshot required and auto-fill from client on insert/update; retain `sample_status` enum for `status`.
- Add QR intake flow: parse scanned payload `id_card_num|name|dd/mm/yyyy|gender`, convert DOB to DATE, validate gender list, and upsert/select client; return `client_id` for sample creation.
- Extend RLS/audit: enable RLS on `clients`, add manager/analyst policies with role checks, ensure audit trigger coverage and updated_at trigger.

## Impact
- **Affected specs:** client-management, sample-management.
- **Affected code:** migrations (new table, constraints, policies, triggers), QR parsing/ingest server action, sample creation/assignment flows to require `client_id`, validation schemas/types, seeds/tests, UI forms (Vietnamese labels, QR auto-fill).
- **Compliance:** soft delete unchanged (samples), audit coverage required for clients; follow migration security checklist.
