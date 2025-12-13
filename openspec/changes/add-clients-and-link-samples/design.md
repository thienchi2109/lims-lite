## Context
- Need a normalized client registry to back sample intake and QR-based identity capture from ID cards.
- Current `samples` table uses `client_name` free text and `type` enum; no client table exists; status uses `sample_status` enum and must stay.
- QR payload format provided: `id_card_num|name|dd/mm/yyyy|gender`; health insurance not included; raw payload not stored.

## Goals / Non-Goals
- Goals: add clients table with constraints; enforce linkage in samples; validate gender/type via CHECK; enable QR parsing to prefill client info and upsert/link; keep audit/RLS parity.
- Non-Goals: UI polish beyond intake forms; multi-identifier history; storing raw QR payload; changing sample_status enum.

## Decisions
- Table: `clients(id uuid pk default gen_random_uuid())` with NOT NULL `id_card_num`, `name`, `date_of_birth` (DATE), `gender` (TEXT CHECK in {'Nam','Nữ','Khác'}), `phone` (TEXT NOT NULL with format CHECK matching Vietnamese phones: `^(0|\+84)[0-9]{9,10}$`); optional `address`, `health_insurance_num`, `expiry_date` (DATE), `created_at/updated_at` with defaults.
- Uniqueness: UNIQUE (`name`, `date_of_birth`) to curb duplicates; `id_card_num` stored but not uniqueness key.
- Samples: add `client_id UUID NOT NULL REFERENCES clients(id)` plus required `client_name` snapshot (TEXT NOT NULL); keep `status sample_status`; change `type` to TEXT with CHECK over allowed list: `{"Máu","Dịch niệu đạo/âm đạo","Nước tiểu","Phết tế bào âm đạo","Ngoáy trực tràng/hậu môn","Phân","Nước","Thực phẩm"}`.
- Trigger: BEFORE INSERT/UPDATE on samples to auto-fill `client_name` from `clients.name` when `client_id` provided; keep existing updated_at trigger.
- QR parsing: parse segments into `id_card_num`, `name`, `dob` (dd/mm/yyyy → DATE), `gender`; validate gender list; ignore extra segments; no raw storage; no health insurance.

## Alternatives Considered
- Enum types for gender/type: rejected to keep flexibility per request; CHECK constraints chosen.
- Nullable `client_id`: rejected to enforce linkage and reduce orphan samples; snapshot column keeps historical text.
- Storing raw QR payload: rejected to avoid PII leakage; rely on validated fields.

## Risks / Trade-offs
- Duplicate clients still possible if name/date reused for distinct persons; mitigated by manual review and optional id_card matching in ingest.
- Backfilling existing samples needs deterministic mapping to clients; may require best-effort matching and manual reconciliation.
- CHECK lists require updates when new sample types/genders added; involves migration.

## Migration Plan (high level)
1) Create clients table with constraints, indexes, audit + updated_at triggers, RLS (analyst/manager role checks). Ensure `DROP POLICY IF EXISTS` before new policies; document Security Impact.
2) Alter samples: add `client_id` (populate NULLable temporarily for backfill), add CHECK for type, make client_name NOT NULL, add trigger to sync snapshot, then enforce NOT NULL and FK.
3) Data migration: derive clients from existing samples (use name/dob if available; temporary placeholders for missing data), link samples; finalize NOT NULL constraint.
4) Run `run_security_tests()` and verify policy state.

## Open Questions
- Backfill strategy details (matching by name only? manual script?) to be defined during implementation.

## Backfill Plan (current data assessment)
- Current data: 50 samples; `client_id` is NULL for all; `client_name` is present for all; no `type` column yet. Duplicate client_name values exist (11 names appear twice) with identical `created_at::date`.
- Placeholder DOB policy: during backfill, assign `date_of_birth = DATE '1900-01-01' + (row_number() OVER (PARTITION BY client_name ORDER BY created_at, id) - 1)` to satisfy NOT NULL and UNIQUE (name, date_of_birth) without merging unrelated records. Set `gender = 'Khác'` and `id_card_num = 'LEGACY-' || md5(client_name || '-' || rn)` (rn = row_number()) to keep required fields non-null and unique-ish.
- Placeholder phone policy: assign `phone = '0900' || lpad(row_number()::text, 6, '0')` (e.g., '0900000001', '0900000002') to satisfy NOT NULL and format CHECK; mark for manual cleanup later by managers.
- Type backfill: when adding `samples.type` (TEXT + CHECK), set legacy rows to `'Nước'` (allowed list) as a conservative default; manual cleanup can follow if better classification is provided later.
- Snapshot trigger: after backfill, enable BEFORE INSERT/UPDATE trigger to copy `client_name` from clients so future rows stay consistent.

### Backfill SQL skeleton (to embed in migration)
```sql
-- 1) Add nullable columns first (client_id, type TEXT) before constraints
ALTER TABLE public.samples ADD COLUMN IF NOT EXISTS type TEXT;

WITH numbered AS (
    SELECT
        s.id AS sample_id,
        s.client_name,
        s.created_at,
        ROW_NUMBER() OVER (PARTITION BY s.client_name ORDER BY s.created_at, s.id) AS rn
    FROM public.samples s
)
INSERT INTO public.clients (id, id_card_num, name, date_of_birth, gender, phone)
SELECT
    gen_random_uuid(),
    'LEGACY-' || md5(n.client_name || '-' || n.rn),
    n.client_name,
    DATE '1900-01-01' + (n.rn - 1),
    'Khác',
    '0900' || lpad(n.rn::text, 6, '0')  -- Placeholder phone: 0900000001, 0900000002, etc.
FROM numbered n
ON CONFLICT (name, date_of_birth) DO NOTHING;

-- Link samples to clients using the same placeholder DOB
WITH numbered AS (
    SELECT
        s.id AS sample_id,
        s.client_name,
        ROW_NUMBER() OVER (PARTITION BY s.client_name ORDER BY s.created_at, s.id) AS rn
    FROM public.samples s
),
matched AS (
    SELECT
        n.sample_id,
        c.id AS client_id
    FROM numbered n
    JOIN public.clients c
      ON c.name = n.client_name
     AND c.date_of_birth = DATE '1900-01-01' + (n.rn - 1)
)
UPDATE public.samples s
SET client_id = m.client_id,
    client_name = s.client_name, -- snapshot retained
    type = COALESCE(s.type, 'Nước')
FROM matched m
WHERE s.id = m.sample_id;

-- Later: enforce CHECK on type, set client_id/client_name NOT NULL, add FK, add trigger to sync snapshot
```
