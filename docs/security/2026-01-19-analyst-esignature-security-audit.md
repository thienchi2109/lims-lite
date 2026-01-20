# Security Audit Report: Analyst E-Signature Implementation

**Audit Date:** 2026-01-19
**Auditor:** Security Audit (DevSecOps)
**Plan Location:** `docs/plans/2025-01-19-analyst-esignature-design.md`
**Status:** Pre-Implementation Review

---

## Executive Summary

This security audit evaluates the proposed analyst e-signature implementation for the CDC-LIMS system. The implementation extends the existing manager signature infrastructure to allow analysts to sign when submitting samples for review.

**Overall Risk Rating:** MEDIUM-HIGH

**Critical Findings:** 3
**High Findings:** 4
**Medium Findings:** 5
**Low Findings:** 3

The implementation plan contains several security gaps that must be addressed before deployment, particularly around RLS policy gaps, race conditions, and storage access control.

---

## 1. OWASP Top 10 Analysis

### A01:2021 - Broken Access Control

#### CRITICAL: RLS Policy Gap - `user_signatures` Table

**Location:** `supabase/migrations/057_create_user_signatures_table.sql` (lines 99-140)

**Current State:**
```sql
-- SELECT: Managers can view their own signatures, analysts cannot view any
CREATE POLICY "user_signatures_select_own" ON user_signatures FOR SELECT
USING (get_user_role() = 'manager' AND user_id = (SELECT auth.uid()));

-- INSERT: Managers can insert their own signatures only
CREATE POLICY "user_signatures_insert_own" ON user_signatures FOR INSERT
WITH CHECK (get_user_role() = 'manager' AND user_id = (SELECT auth.uid()));

-- UPDATE: Managers can update their own signatures
CREATE POLICY "user_signatures_update_own" ON user_signatures FOR UPDATE
USING (get_user_role() = 'manager' AND user_id = (SELECT auth.uid()))
WITH CHECK (get_user_role() = 'manager' AND user_id = (SELECT auth.uid()));
```

**Vulnerability:** Analysts have NO RLS policies on `user_signatures` table. The implementation plan proposes:
- Analysts uploading signatures (requires INSERT policy)
- Analysts viewing their own signatures (requires SELECT policy)
- Analysts updating their own signatures (requires UPDATE policy)

**CVSS Score:** 8.1 (High)
- Vector: `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N`
- Attack: Authenticated analyst cannot perform intended operations, breaking functionality
- Impact: Complete feature failure OR if bypassed via service role, potential privilege escalation

**Remediation:**
```sql
-- Add analyst SELECT policy
DROP POLICY IF EXISTS "user_signatures_select_own" ON user_signatures;
CREATE POLICY "user_signatures_select_own" ON user_signatures FOR SELECT
USING (
    (get_user_role() IN ('manager', 'analyst'))
    AND user_id = (SELECT auth.uid())
);

-- Add analyst INSERT policy
DROP POLICY IF EXISTS "user_signatures_insert_own" ON user_signatures;
CREATE POLICY "user_signatures_insert_own" ON user_signatures FOR INSERT
WITH CHECK (
    (get_user_role() IN ('manager', 'analyst'))
    AND user_id = (SELECT auth.uid())
);

-- Add analyst UPDATE policy
DROP POLICY IF EXISTS "user_signatures_update_own" ON user_signatures;
CREATE POLICY "user_signatures_update_own" ON user_signatures FOR UPDATE
USING (
    (get_user_role() IN ('manager', 'analyst'))
    AND user_id = (SELECT auth.uid())
)
WITH CHECK (
    (get_user_role() IN ('manager', 'analyst'))
    AND user_id = (SELECT auth.uid())
);
```

---

#### CRITICAL: Storage Bucket Policy Gap - `user-signatures`

**Location:** `supabase/migrations/058_create_user_signatures_storage.sql` (lines 42-62)

**Current State:**
```sql
-- INSERT: Managers can upload their own signatures only
CREATE POLICY "user_signatures_insert_own" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-signatures'
    AND public.get_user_role() = 'manager'  -- ANALYST NOT INCLUDED
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: Managers can read their own signatures
CREATE POLICY "user_signatures_select_own" ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'user-signatures'
    AND public.get_user_role() = 'manager'  -- ANALYST NOT INCLUDED
    AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Vulnerability:** Storage policies explicitly restrict to `manager` role only. Analysts cannot upload or read their signature files.

**CVSS Score:** 8.1 (High)
- Vector: `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N`

**Remediation:**
```sql
-- Update INSERT policy for both roles
DROP POLICY IF EXISTS "user_signatures_insert_own" ON storage.objects;
CREATE POLICY "user_signatures_insert_own" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-signatures'
    AND public.get_user_role() IN ('manager', 'analyst')
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Update SELECT policy for both roles
DROP POLICY IF EXISTS "user_signatures_select_own" ON storage.objects;
CREATE POLICY "user_signatures_select_own" ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'user-signatures'
    AND public.get_user_role() IN ('manager', 'analyst')
    AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

### A02:2021 - Cryptographic Failures

#### MEDIUM: Signature Hash Verification Not Enforced

**Location:** `src/app/actions/signatures.ts` (lines 132-134), Implementation Plan (line 255-260)

**Current State:** SHA-256 hash is generated and stored during upload but:
1. Hash verification during download is NOT enforced
2. CoA generation fetches signature without hash verification
3. No integrity check before embedding in CoA

**Implementation Plan Gap:** The plan does not include hash verification when fetching analyst signatures for CoA generation.

**CVSS Score:** 5.3 (Medium)
- Vector: `CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N`

**Remediation:**
```typescript
// Add to downloadSignature function
export async function downloadSignature(
    signaturePath: string,
    expectedHash?: string,  // NEW: Optional hash for verification
    options?: { useServiceRole?: boolean }
): Promise<...> {
    // ... existing download code ...

    // NEW: Verify integrity if hash provided
    if (expectedHash) {
        const actualHash = createHash('sha256')
            .update(Buffer.from(arrayBuffer))
            .digest('hex')
        if (actualHash !== expectedHash) {
            console.error('Signature integrity check failed', {
                expected: expectedHash,
                actual: actualHash
            })
            return { success: false, error: 'Signature file integrity verification failed' }
        }
    }

    // ... rest of function ...
}
```

---

### A03:2021 - Injection

#### LOW: SQL Injection in RPC - Mitigated by Parameterized Queries

**Location:** Implementation Plan (lines 67-154)

**Analysis:** The `submit_sample_for_review` RPC uses parameterized queries via PL/pgSQL:
- `p_sample_id UUID` - Type-enforced parameter
- No string concatenation in queries
- All variables properly bound

**Status:** SECURE - No remediation required

---

#### MEDIUM: Path Traversal in Storage Path

**Location:** `src/app/actions/signatures.ts` (line 139)

**Current Code:**
```typescript
const storagePath = `${user.id}/${timestamp}.${ext}`
```

**Analysis:** The path is constructed from:
- `user.id` - UUID from authenticated session (safe)
- `timestamp` - ISO string from Date (safe)
- `ext` - Derived from validated MIME type (safe)

**However:** The `downloadSignature` function accepts `signaturePath` as parameter without validation:
```typescript
export async function downloadSignature(
    signaturePath: string,  // NO VALIDATION!
    options?: { useServiceRole?: boolean }
)
```

**CVSS Score:** 4.3 (Medium)
- Vector: `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N`

**Remediation:**
```typescript
const SignaturePathSchema = z.string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[\w\-:.]+\.(png|jpg)$/i)
    .refine(path => !path.includes('..'), 'Invalid path')

export async function downloadSignature(
    signaturePath: string,
    options?: { useServiceRole?: boolean }
) {
    // Validate path format
    const pathValidation = SignaturePathSchema.safeParse(signaturePath)
    if (!pathValidation.success) {
        return { success: false, error: 'Invalid signature path format' }
    }
    // ... rest of function
}
```

---

### A04:2021 - Insecure Design

#### CRITICAL: Race Condition in `submission_number` Calculation

**Location:** Implementation Plan (lines 130-140)

**Proposed Code:**
```sql
-- Calculate submission number
SELECT COALESCE(MAX(submission_number), 0) + 1 INTO v_submission_number
FROM public.sample_submissions
WHERE sample_id = p_sample_id;

-- Insert submission record
INSERT INTO public.sample_submissions (
    sample_id, user_id, signature_id, submission_number
) VALUES (
    p_sample_id, v_user_id, v_signature_id, v_submission_number
);
```

**Vulnerability:** TOCTOU (Time-of-Check-Time-of-Use) race condition:
1. Transaction A: SELECT MAX = 0, calculates 1
2. Transaction B: SELECT MAX = 0, calculates 1
3. Transaction A: INSERT with submission_number = 1
4. Transaction B: INSERT with submission_number = 1 (DUPLICATE!)

The `UNIQUE (sample_id, submission_number)` constraint will catch this, but error handling is not defined.

**CVSS Score:** 6.5 (Medium)
- Vector: `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:H`

**Remediation (Option A - Advisory Lock):**
```sql
-- Lock sample row BEFORE calculating submission number
SELECT status INTO v_sample_status
FROM public.samples
WHERE id = p_sample_id AND deleted_at IS NULL
FOR UPDATE;  -- This is already present - good!

-- The FOR UPDATE lock prevents concurrent submissions for same sample
-- BUT: Analyst might have multiple tabs open

-- Add retry logic with exponential backoff in application layer
```

**Remediation (Option B - Sequence-based):**
```sql
-- Use a sequence per sample (complex but bulletproof)
-- OR use INSERT ... ON CONFLICT with retry
INSERT INTO public.sample_submissions (
    sample_id, user_id, signature_id, submission_number
)
SELECT
    p_sample_id,
    v_user_id,
    v_signature_id,
    COALESCE(MAX(submission_number), 0) + 1
FROM public.sample_submissions
WHERE sample_id = p_sample_id;

-- Note: This atomic SELECT+INSERT prevents race condition
```

**Recommended Remediation:**
```sql
-- Atomic insert with subquery (prevents race condition)
INSERT INTO public.sample_submissions (
    sample_id, user_id, signature_id, submission_number
) VALUES (
    p_sample_id,
    v_user_id,
    v_signature_id,
    (SELECT COALESCE(MAX(submission_number), 0) + 1
     FROM public.sample_submissions
     WHERE sample_id = p_sample_id)
)
RETURNING submission_number INTO v_submission_number;
```

---

#### HIGH: Missing Audit Trigger on `sample_submissions` Table

**Location:** Implementation Plan (lines 23-39)

**Current Audit Triggers (from migration 002):**
- `audit_samples_trigger` on `samples`
- `audit_results_trigger` on `results`
- `audit_users_trigger` on `users`
- `audit_user_signatures_trigger` on `user_signatures` (migration 057)

**Missing:** No audit trigger proposed for `sample_submissions` table.

**21 CFR Part 11 Impact:** Electronic signature events MUST be logged for compliance. The `sample_submissions` table captures when an analyst digitally signs and submits work.

**CVSS Score:** 7.1 (High)
- Vector: `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`
- Compliance Impact: 21 CFR Part 11 violation

**Remediation:**
```sql
-- Add audit trigger for sample_submissions
DROP TRIGGER IF EXISTS audit_sample_submissions_trigger ON sample_submissions;
CREATE TRIGGER audit_sample_submissions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sample_submissions
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

COMMENT ON TRIGGER audit_sample_submissions_trigger ON sample_submissions
IS 'Audit log for analyst e-signature submissions - 21 CFR Part 11 compliance';
```

---

### A05:2021 - Security Misconfiguration

#### HIGH: SECURITY DEFINER Function Without Explicit search_path

**Location:** `supabase/migrations/057_create_user_signatures_table.sql` (lines 167-197)

**Current Code:**
```sql
CREATE OR REPLACE FUNCTION get_active_signature(p_user_id UUID)
RETURNS TABLE (...)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Good, but incomplete
AS $$
```

**Analysis:** The `search_path` is set but does not include the `extensions` schema which contains `uuid_generate_v4()` used elsewhere.

**Implementation Plan RPC (lines 72-74):**
```sql
CREATE OR REPLACE FUNCTION public.submit_sample_for_review(...)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions  -- Correct pattern
```

**CVSS Score:** 4.9 (Medium)
- Vector: `CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:L/I:L/A:N`

**Remediation:** Ensure all SECURITY DEFINER functions use consistent search_path:
```sql
SET search_path = public, extensions
```

---

#### MEDIUM: Service Role Key Exposure Risk

**Location:** `src/lib/supabase/edge-admin.ts` (lines 4-17)

**Current Code:**
```typescript
export function createEdgeAdminClient() {
    const supabaseUrl = getSupabaseServerUrl()
    return createClient(
        supabaseUrl,
        getSupabaseServiceRoleKey(),  // Service role key used
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
```

**Implementation Plan Usage (line 255):**
```typescript
const submitterSigResult = await getActiveSignature(
    submission.submitterId,
    { useServiceRole: true }  // Bypasses RLS
)
```

**Risk:** Service role bypasses ALL RLS policies. If misused, could expose any user's signature.

**CVSS Score:** 5.3 (Medium)
- Vector: `CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:N/A:N`

**Remediation:**
1. Add explicit authorization checks before using service role
2. Log all service role usage for audit

```typescript
export async function getActiveSignature(
    userId?: string,
    options?: { useServiceRole?: boolean }
): Promise<GetActiveSignatureResult> {
    // NEW: Validate calling context when using service role
    if (options?.useServiceRole && userId) {
        console.info('Service role access for signature', {
            targetUserId: userId,
            reason: 'CoA generation cross-user signature access'
        })
    }
    // ... rest of function
}
```

---

## 2. Authentication and Authorization Analysis

### RPC `submit_sample_for_review` Auth Checks

**Location:** Implementation Plan (lines 82-91)

**Current Checks:**
```sql
-- Auth check 1: User must be authenticated
IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
END IF;

-- Auth check 2: User must be analyst
IF v_user_role IS NULL OR v_user_role != 'analyst' THEN
    RAISE EXCEPTION 'Only analysts can submit samples for review';
END IF;
```

**Analysis:**
- Uses `auth.uid()` correctly
- Uses `get_user_role()` helper function
- Role check is explicit

**SECURE** - No issues found.

---

### Role Validation in `uploadSignature`

**Location:** `src/app/actions/signatures.ts` (lines 106-118)

**Current Code (Manager-only):**
```typescript
if (userData.role !== 'manager') {
    return { success: false, error: 'Chi quan ly moi co the tai len chu ky' }
}
```

**Proposed Change (Implementation Plan lines 163-172):**
```typescript
if (userData.role !== 'manager' && userData.role !== 'analyst') {
    return { success: false, error: 'Khong co quyen tai len chu ky' }
}
```

**Analysis:** Change is correct, but consider:

**Recommendation:** Use a type-safe approach:
```typescript
const SIGNATURE_UPLOAD_ROLES: UserRole[] = ['manager', 'analyst'] as const

if (!SIGNATURE_UPLOAD_ROLES.includes(userData.role as UserRole)) {
    return { success: false, error: 'Khong co quyen tai len chu ky' }
}
```

---

### Service Role Usage for Cross-User Signature Access

**Location:** `src/app/actions/signatures.ts` (lines 205-256)

**Flow:**
1. `generateCoA` is called by analyst/manager
2. Fetches approver signature using `getActiveSignature(approverId, { useServiceRole: true })`
3. Service role bypasses RLS to access other user's signature

**Security Assessment:**
- **Justified Use Case:** CoA generation requires embedding the approver's signature
- **Risk:** Service role could access ANY signature if `userId` parameter is manipulated
- **Mitigation:** `generateCoA` validates that the sample is actually approved by the specified approver

**HIGH: Missing Validation for Signature Ownership**

**Location:** Implementation Plan (lines 254-264)

```typescript
// Proposed code
const submission = await fetchLatestSubmission(sampleId)
let submitterSignatureDataUri: string | undefined

if (submission) {
    const submitterSigResult = await getActiveSignature(
        submission.submitterId,
        { useServiceRole: true }  // Bypasses RLS!
    )
    // ...
}
```

**Vulnerability:** No validation that `submission.submitterId` actually submitted this sample. A malicious actor with database access could manipulate `sample_submissions` to point to a different user.

**CVSS Score:** 6.5 (Medium)
- Vector: `CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:H/A:N`

**Remediation:**
```typescript
if (submission) {
    // Validate submission integrity
    if (submission.signatureId !== expectedSignatureId) {
        console.error('Signature mismatch in submission record')
        // Continue without analyst signature rather than fail
    }

    // Fetch signature using the signature_id from submission (not re-fetching active)
    const submitterSig = await getSignatureById(submission.signatureId, { useServiceRole: true })
}
```

---

## 3. Input Validation Assessment

### UUID Validation for `sample_id`

**Location:** Implementation Plan (lines 67-69)

**RPC Parameter:**
```sql
CREATE OR REPLACE FUNCTION public.submit_sample_for_review(
    p_sample_id UUID  -- Type-enforced at DB level
)
```

**Server Action (sample-approvals.ts line 134):**
```typescript
export async function submitSampleForReview(sampleId: string) {
    // ... calls RPC
}
```

**Gap:** Server action accepts `string` but RPC expects `UUID`. PostgreSQL will reject invalid UUIDs, but error message may leak implementation details.

**CVSS Score:** 2.4 (Low)

**Remediation:**
```typescript
import { z } from 'zod'

const SubmitSampleSchema = z.object({
    sampleId: z.string().uuid('Sample ID must be a valid UUID')
})

export async function submitSampleForReview(sampleId: string) {
    const validation = SubmitSampleSchema.safeParse({ sampleId })
    if (!validation.success) {
        return { error: validation.error.issues[0].message }
    }
    // ... rest of function
}
```

---

### File Upload Validation (Size, Type, Dimensions)

**Location:** `src/types/workflow.ts` (lines 59-97), `src/app/actions/signatures.ts` (lines 61-77)

**Current Validation:**

| Check | Server-Side | Client-Side | Database | Storage |
|-------|-------------|-------------|----------|---------|
| File Size | Yes (500KB) | Yes (Zod) | Yes (CHECK constraint) | Yes (bucket config) |
| MIME Type | Yes | Yes (Zod) | Yes (CHECK constraint) | Yes (allowed_mime_types) |
| Dimensions | No | Yes (Zod) | No | No |
| Magic Bytes | No | No | No | No |

**Gap:** File magic byte validation is not performed. A malicious file could have `.png` extension but contain executable content.

**CVSS Score:** 4.6 (Medium)
- Vector: `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L`

**Remediation:**
```typescript
import fileType from 'file-type'

async function validateSignatureFile(file: File): Promise<...> {
    // ... existing checks ...

    // NEW: Magic byte validation
    const arrayBuffer = await file.arrayBuffer()
    const type = await fileType.fromBuffer(Buffer.from(arrayBuffer))

    if (!type || !['image/png', 'image/jpeg'].includes(type.mime)) {
        return { valid: false, error: 'File content does not match declared type' }
    }

    return { valid: true }
}
```

---

### Zod Schema Coverage

**Current Schemas:**

| Input | Schema | Location |
|-------|--------|----------|
| Signature file | `UploadSignatureSchema` | `src/types/workflow.ts:87-97` |
| Signature metadata | `ActiveSignatureSchema` | `src/types/workflow.ts:101-107` |
| Sample approval | `ApproveResultsSchema` | `src/types/workflow.ts:9-13` |
| Sample rejection | `RejectSampleSchema` | `src/types/workflow.ts:25-28` |
| CoA manual inputs | `CoAManualInputsSchema` | `src/types/workflow.ts:223-231` |

**Missing Schemas:**
- `sample_submissions` insert data
- `fetchLatestSubmission` response

**Remediation:**
```typescript
// Add to src/types/workflow.ts

export const SampleSubmissionSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().uuid(),
    user_id: z.string().uuid(),
    signature_id: z.string().uuid(),
    submitted_at: z.string().datetime(),
    submission_number: z.number().int().positive(),
})

export type SampleSubmission = z.infer<typeof SampleSubmissionSchema>

export const LatestSubmissionSchema = z.object({
    submitterId: z.string().uuid(),
    submitterName: z.string().nullable(),
    signatureId: z.string().uuid(),
    submittedAt: z.string().datetime(),
    submissionNumber: z.number().int().positive(),
})

export type LatestSubmission = z.infer<typeof LatestSubmissionSchema>
```

---

## 4. 21 CFR Part 11 Compliance Assessment

### Electronic Signature Requirements

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Signature must be unique to individual | PASS | Stored per `user_id` with unique constraint |
| Signature must identify user | PASS | Links to `users` table via `user_id` |
| Signature must include meaning | PARTIAL | Submission implies certification, but text not explicit |
| Date/time of signature | PASS | `submitted_at` timestamp |
| Signature/record binding | PASS | `signature_id` FK in `sample_submissions` |

**Gap: Signature Meaning Not Explicit**

**21 CFR Part 11 Section 11.50(a)(1):**
> The printed name of the signer, the date and time when the signature was executed, and the meaning (such as review, approval, responsibility, or authorship) associated with the signature.

**Current State:** The implementation creates a record but does not explicitly store the "meaning" of the signature.

**CVSS Score (Compliance):** N/A (Regulatory risk)

**Remediation:**
```sql
-- Add signature_meaning column to sample_submissions
ALTER TABLE sample_submissions
ADD COLUMN signature_meaning TEXT NOT NULL
    DEFAULT 'I certify I performed these tests and entered these results accurately';

COMMENT ON COLUMN sample_submissions.signature_meaning
IS '21 CFR Part 11 11.50(a)(1) - Meaning associated with signature';
```

---

### Audit Trail Completeness

| Table | Audit Trigger | 21 CFR Part 11 Relevance |
|-------|---------------|--------------------------|
| `samples` | Yes | Sample status changes |
| `results` | Yes | Test result modifications |
| `users` | Yes | User profile changes |
| `user_signatures` | Yes | Signature uploads/changes |
| `sample_submissions` | **NO** | Analyst certification events |

**CRITICAL GAP:** `sample_submissions` lacks audit trigger.

---

### Non-Repudiation Guarantees

| Aspect | Implementation | Strength |
|--------|----------------|----------|
| Signature file hash | SHA-256 | Strong |
| Signature version tracking | `is_active` flag, soft delete | Strong |
| Signature-CoA binding | `signature_id` in `coa_reports` | Strong |
| Submission record | Proposed `sample_submissions` | Strong |
| Timestamp source | Database `NOW()` | Strong (server-side) |

**Analysis:** Non-repudiation is well-designed. The analyst cannot deny:
1. They uploaded the signature (audit trail)
2. They submitted the sample (sample_submissions record)
3. Which signature version was used (signature_id FK)

---

## 5. Storage Security Analysis

### Bucket Policies for `user-signatures`

**Current Configuration:**
- Private bucket (`public: false`)
- 500KB file size limit
- PNG/JPEG MIME types only
- RLS on storage.objects

**Policy Gap:** As identified above, analyst role not included.

### File Path Injection Risks

**Current Path Generation:**
```typescript
const storagePath = `${user.id}/${timestamp}.${ext}`
```

**Risk Assessment:**
- `user.id`: UUID from authenticated session - SAFE
- `timestamp`: ISO string `new Date().toISOString()` - Contains colons on Windows
- `ext`: Derived from validated MIME type - SAFE

**Windows Path Issue:** ISO timestamps contain colons (e.g., `2026-01-19T10:30:00.000Z`) which are invalid in Windows filenames. While this is a storage bucket (not filesystem), some tools may have issues.

**CVSS Score:** 2.1 (Low)

**Remediation:**
```typescript
// Replace colons and periods in timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const storagePath = `${user.id}/${timestamp}.${ext}`
```

### Hash Verification

**Current State:** Hash is stored but not verified on download.

**Recommendation:** Implement hash verification for CoA generation (see A02:2021 section above).

---

## 6. Security Risk Matrix

| ID | Vulnerability | CVSS | Priority | Effort | Status |
|----|---------------|------|----------|--------|--------|
| V01 | RLS Policy Gap - user_signatures table | 8.1 | CRITICAL | Low | Open |
| V02 | Storage Policy Gap - user-signatures bucket | 8.1 | CRITICAL | Low | Open |
| V03 | Race Condition - submission_number | 6.5 | CRITICAL | Medium | Open |
| V04 | Missing Audit Trigger - sample_submissions | 7.1 | HIGH | Low | Open |
| V05 | Signature Hash Verification Missing | 5.3 | HIGH | Medium | Open |
| V06 | Service Role Authorization Logging | 5.3 | HIGH | Low | Open |
| V07 | Cross-User Signature Access Validation | 6.5 | HIGH | Medium | Open |
| V08 | Path Traversal in downloadSignature | 4.3 | MEDIUM | Low | Open |
| V09 | SECURITY DEFINER search_path consistency | 4.9 | MEDIUM | Low | Open |
| V10 | Magic Byte Validation Missing | 4.6 | MEDIUM | Medium | Open |
| V11 | 21 CFR Part 11 Signature Meaning | N/A | MEDIUM | Low | Open |
| V12 | Zod Schema Coverage | 2.4 | LOW | Low | Open |
| V13 | UUID Validation in Server Action | 2.4 | LOW | Low | Open |
| V14 | Timestamp Format for Windows | 2.1 | LOW | Low | Open |

---

## 7. Remediation Priority

### Phase 1: Pre-Implementation (Must Fix)

1. **V01: Add analyst RLS policies to `user_signatures`**
   - Without this, the feature will not work

2. **V02: Add analyst storage policies to `user-signatures` bucket**
   - Without this, file upload will fail

3. **V03: Fix race condition in submission_number**
   - Use atomic INSERT with subquery

4. **V04: Add audit trigger to `sample_submissions`**
   - Required for 21 CFR Part 11 compliance

### Phase 2: Implementation (Should Fix)

5. **V05: Implement signature hash verification**
   - Verify hash on download for CoA generation

6. **V07: Add cross-user signature access validation**
   - Validate submission record integrity

7. **V11: Add signature_meaning column**
   - Explicit 21 CFR Part 11 compliance

### Phase 3: Post-Implementation (Could Fix)

8. **V06: Add service role usage logging**
9. **V08: Add path validation to downloadSignature**
10. **V09: Standardize SECURITY DEFINER search_path**
11. **V10: Implement magic byte validation**
12. **V12-V14: Minor improvements**

---

## 8. Migration Template

```sql
-- Migration XXX: Analyst E-Signature Security Fixes
-- Security Impact: CRITICAL (fixes RLS gaps, adds audit trail)
-- Related: docs/security/2026-01-19-analyst-esignature-security-audit.md

SET search_path TO public;

-- ============================================================================
-- V01: Add analyst RLS policies to user_signatures
-- ============================================================================

DROP POLICY IF EXISTS "user_signatures_select_own" ON user_signatures;
CREATE POLICY "user_signatures_select_own" ON user_signatures FOR SELECT
USING (
    get_user_role() IN ('manager', 'analyst')
    AND user_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "user_signatures_insert_own" ON user_signatures;
CREATE POLICY "user_signatures_insert_own" ON user_signatures FOR INSERT
WITH CHECK (
    get_user_role() IN ('manager', 'analyst')
    AND user_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "user_signatures_update_own" ON user_signatures;
CREATE POLICY "user_signatures_update_own" ON user_signatures FOR UPDATE
USING (
    get_user_role() IN ('manager', 'analyst')
    AND user_id = (SELECT auth.uid())
)
WITH CHECK (
    get_user_role() IN ('manager', 'analyst')
    AND user_id = (SELECT auth.uid())
);

-- ============================================================================
-- V02: Add analyst storage policies (storage schema)
-- ============================================================================

SET search_path TO storage;

DROP POLICY IF EXISTS "user_signatures_insert_own" ON storage.objects;
CREATE POLICY "user_signatures_insert_own" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-signatures'
    AND public.get_user_role() IN ('manager', 'analyst')
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "user_signatures_select_own" ON storage.objects;
CREATE POLICY "user_signatures_select_own" ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'user-signatures'
    AND public.get_user_role() IN ('manager', 'analyst')
    AND (storage.foldername(name))[1] = auth.uid()::text
);

SET search_path TO public;

-- ============================================================================
-- V04: Add audit trigger to sample_submissions
-- ============================================================================

DROP TRIGGER IF EXISTS audit_sample_submissions_trigger ON sample_submissions;
CREATE TRIGGER audit_sample_submissions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sample_submissions
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- ============================================================================
-- V11: Add signature_meaning column for 21 CFR Part 11
-- ============================================================================

ALTER TABLE sample_submissions
ADD COLUMN IF NOT EXISTS signature_meaning TEXT NOT NULL
    DEFAULT 'I certify I performed these tests and entered these results accurately';

-- ============================================================================
-- V03: Update RPC to use atomic submission_number insert
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_sample_for_review(
    p_sample_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_role := get_user_role();
    v_sample_status sample_status;
    v_signature_id UUID;
    v_submission_number INTEGER;
    v_missing_count INTEGER := 0;
BEGIN
    -- Auth checks
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF v_user_role IS NULL OR v_user_role != 'analyst' THEN
        RAISE EXCEPTION 'Only analysts can submit samples for review';
    END IF;

    -- Check analyst has active signature
    SELECT id INTO v_signature_id
    FROM public.user_signatures
    WHERE user_id = v_user_id
      AND is_active = true
      AND deleted_at IS NULL;

    IF v_signature_id IS NULL THEN
        RAISE EXCEPTION 'Ban can tai len chu ky dien tu truoc khi gui duyet. Vao trang Ho so de tai len chu ky.';
    END IF;

    -- Lock sample row
    SELECT status INTO v_sample_status
    FROM public.samples
    WHERE id = p_sample_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample not found';
    END IF;

    IF v_sample_status != 'in_progress' THEN
        RAISE EXCEPTION 'Sample must be in progress to submit for review';
    END IF;

    -- Validation checks
    IF NOT EXISTS (SELECT 1 FROM public.results WHERE sample_id = p_sample_id) THEN
        RAISE EXCEPTION 'Cannot submit sample with no assigned tests';
    END IF;

    SELECT COUNT(*) INTO v_missing_count
    FROM public.results
    WHERE sample_id = p_sample_id AND (value IS NULL OR value = '');

    IF v_missing_count > 0 THEN
        RAISE EXCEPTION 'All tests must have results before submitting';
    END IF;

    -- V03 FIX: Atomic insert with subquery (prevents race condition)
    INSERT INTO public.sample_submissions (
        sample_id, user_id, signature_id, submission_number, signature_meaning
    ) VALUES (
        p_sample_id,
        v_user_id,
        v_signature_id,
        (SELECT COALESCE(MAX(submission_number), 0) + 1
         FROM public.sample_submissions
         WHERE sample_id = p_sample_id),
        'I certify I performed these tests and entered these results accurately'
    )
    RETURNING submission_number INTO v_submission_number;

    -- Update sample status
    UPDATE public.samples
    SET status = 'review', updated_at = NOW()
    WHERE id = p_sample_id;

    RETURN jsonb_build_object(
        'sample_id', p_sample_id,
        'new_status', 'review',
        'signature_id', v_signature_id,
        'submission_number', v_submission_number
    );
END;
$$;

-- Revoke and grant permissions
REVOKE ALL ON FUNCTION public.submit_sample_for_review(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_sample_for_review(UUID) TO authenticated;

COMMENT ON FUNCTION public.submit_sample_for_review(UUID)
IS 'Analyst e-signature submission with atomic submission_number and 21 CFR Part 11 compliance';

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
```

---

## 9. Testing Requirements

### Security Test Cases

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| SEC-01 | Analyst uploads signature without RLS fix | FAIL (403 Forbidden) |
| SEC-02 | Analyst uploads signature with RLS fix | PASS (signature stored) |
| SEC-03 | Concurrent submissions for same sample | No duplicate submission_number |
| SEC-04 | Path traversal attempt in downloadSignature | REJECT invalid path |
| SEC-05 | Invalid UUID in submitSampleForReview | REJECT with validation error |
| SEC-06 | Manager cannot submit samples | REJECT (role check) |
| SEC-07 | Analyst without signature submits | REJECT (signature required) |
| SEC-08 | Audit log created for submission | PASS (audit_logs entry exists) |

### Compliance Test Cases

| ID | Test Case | 21 CFR Part 11 Section |
|----|-----------|------------------------|
| CFR-01 | Signature uniquely identifies user | 11.100(a) |
| CFR-02 | Signature includes date/time | 11.50(a)(1) |
| CFR-03 | Signature meaning stored | 11.50(a)(1) |
| CFR-04 | Signature linked to record | 11.70 |
| CFR-05 | Audit trail captures signature event | 11.10(e) |
| CFR-06 | Signature cannot be deleted | 11.10(c) |

---

## 10. Conclusion

The analyst e-signature implementation plan has a solid foundation but contains **3 critical security gaps** that must be addressed before implementation:

1. **RLS policies** on `user_signatures` table do not include analysts
2. **Storage policies** on `user-signatures` bucket do not include analysts
3. **Race condition** in submission_number calculation could cause data integrity issues

Additionally, the **missing audit trigger** on `sample_submissions` is a 21 CFR Part 11 compliance violation.

All critical and high-priority issues have clear remediation steps provided in this report. The migration template in Section 8 can be used as a starting point for the security fix migration.

---

**Document Version:** 1.0
**Classification:** Internal - Security
**Review Required Before:** Implementation begins
