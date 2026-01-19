# Analyst E-Signature for Sample Submission

## Overview

Add e-signature capture for analysts when submitting samples for manager review. The analyst signature serves as:
1. **Work Certification** - "I certify I performed these tests and entered these results accurately"
2. **Submission Confirmation** - "I am officially submitting this work for manager review"

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Signature visibility | Embedded in CoA + DB record | Full traceability + visible on final document |
| Requirement | Required before submit | Ensures compliance, no incomplete CoAs |
| Infrastructure | Extend existing system | `user_signatures` table already role-agnostic |
| Storage | Separate junction table | Supports re-submissions, full audit history |
| Re-submission | Append new record | Complete chronological audit trail |

## Database Schema

### New Table: `sample_submissions`

```sql
CREATE TABLE public.sample_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES public.samples(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    signature_id UUID NOT NULL REFERENCES public.user_signatures(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submission_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_sample_submission_number
        UNIQUE (sample_id, submission_number)
);

CREATE INDEX idx_sample_submissions_sample_id ON sample_submissions(sample_id);
CREATE INDEX idx_sample_submissions_user_id ON sample_submissions(user_id);
```

### RLS Policies

```sql
ALTER TABLE sample_submissions ENABLE ROW LEVEL SECURITY;

-- Analysts can view their own submissions
CREATE POLICY "Users can view own submissions" ON sample_submissions
    FOR SELECT USING (auth.uid() = user_id);

-- Managers can view all submissions
CREATE POLICY "Managers can view all submissions" ON sample_submissions
    FOR SELECT USING (get_user_role() = 'manager');

-- Insert only via SECURITY DEFINER RPC
CREATE POLICY "Insert via RPC only" ON sample_submissions
    FOR INSERT WITH CHECK (false);
```

## Modified RPC: `submit_sample_for_review`

Update the existing RPC to:
1. Check analyst has active signature
2. Create `sample_submissions` record
3. Calculate `submission_number` (max + 1 for sample)

```sql
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
    -- Auth checks (existing)
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF v_user_role IS NULL OR v_user_role != 'analyst' THEN
        RAISE EXCEPTION 'Only analysts can submit samples for review';
    END IF;

    -- NEW: Check analyst has active signature
    SELECT id INTO v_signature_id
    FROM public.user_signatures
    WHERE user_id = v_user_id
      AND is_active = true
      AND deleted_at IS NULL;

    IF v_signature_id IS NULL THEN
        RAISE EXCEPTION 'Bạn cần tải lên chữ ký điện tử trước khi gửi duyệt. Vào trang Hồ sơ để tải lên chữ ký.';
    END IF;

    -- Lock sample row (existing)
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

    -- Validation checks (existing)
    IF NOT EXISTS (SELECT 1 FROM public.results WHERE sample_id = p_sample_id) THEN
        RAISE EXCEPTION 'Cannot submit sample with no assigned tests';
    END IF;

    SELECT COUNT(*) INTO v_missing_count
    FROM public.results
    WHERE sample_id = p_sample_id AND (value IS NULL OR value = '');

    IF v_missing_count > 0 THEN
        RAISE EXCEPTION 'All tests must have results before submitting';
    END IF;

    -- NEW: Calculate submission number
    SELECT COALESCE(MAX(submission_number), 0) + 1 INTO v_submission_number
    FROM public.sample_submissions
    WHERE sample_id = p_sample_id;

    -- NEW: Insert submission record
    INSERT INTO public.sample_submissions (
        sample_id, user_id, signature_id, submission_number
    ) VALUES (
        p_sample_id, v_user_id, v_signature_id, v_submission_number
    );

    -- Update sample status (existing)
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
```

## Server Action Changes

### Rename `uploadManagerSignature` → `uploadSignature`

**File:** `src/app/actions/signatures.ts`

```typescript
// Change role check from:
if (userData.role !== 'manager') {
    return { success: false, error: 'Chỉ quản lý mới có thể tải lên chữ ký' }
}

// To:
if (userData.role !== 'manager' && userData.role !== 'analyst') {
    return { success: false, error: 'Không có quyền tải lên chữ ký' }
}
```

### Update `submitSampleForReview`

**File:** `src/app/actions/sample-approvals.ts`

The server action already calls the RPC. No changes needed - the RPC handles signature validation.

### New Helper: `fetchLatestSubmission`

**File:** `src/lib/coa/helpers.ts`

```typescript
export async function fetchLatestSubmission(sampleId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('sample_submissions')
        .select(`
            id,
            user_id,
            signature_id,
            submitted_at,
            submission_number,
            user:users!sample_submissions_user_id_fkey(full_name)
        `)
        .eq('sample_id', sampleId)
        .order('submission_number', { ascending: false })
        .limit(1)
        .single()

    if (error || !data) return null

    return {
        submitterId: data.user_id,
        submitterName: (data.user as any)?.full_name,
        signatureId: data.signature_id,
        submittedAt: data.submitted_at,
        submissionNumber: data.submission_number
    }
}
```

## CoA Template Changes

### Update `CoAData` Type

**File:** `src/types/index.ts` (or relevant type file)

```typescript
export interface CoAData {
    // Existing fields...
    sample: SampleData
    results: TestResult[]
    approverName: string
    approverSignature: string  // base64 data URI
    signatureId: string
    approvalDate: string
    testingDate: string | null
    manualInputs?: CoAManualInputs

    // NEW fields for analyst signature
    submitterName?: string
    submitterSignature?: string  // base64 data URI
    submitterSignatureId?: string
}
```

### Update `generateCoA` Function

**File:** `src/app/actions/coa.ts`

Add after fetching approver signature:

```typescript
// Fetch latest submission for analyst signature
const submission = await fetchLatestSubmission(sampleId)
let submitterSignatureDataUri: string | undefined
let submitterSignatureId: string | undefined
let submitterName: string | undefined

if (submission) {
    const submitterSigResult = await getActiveSignature(submission.submitterId, { useServiceRole: true })
    if (submitterSigResult.success) {
        const downloadResult = await downloadSignature(submitterSigResult.signature.signature_path, { useServiceRole: true })
        if (downloadResult.success) {
            submitterSignatureDataUri = downloadResult.dataUri
            submitterSignatureId = submission.signatureId
            submitterName = submission.submitterName
        }
    }
}

// Add to coaData object
const coaData: CoAData = {
    // ...existing fields
    submitterName,
    submitterSignature: submitterSignatureDataUri,
    submitterSignatureId,
}
```

### Update `renderSignatures` Function

**File:** `src/lib/coa/template.ts`

```typescript
function renderSignatures(coaData: CoAData, footerDateStr: string): string {
    return `
        <div class="signatures">
            <div class="sig-col">
                <div class="sig-title">Người thực hiện</div>
                ${coaData.submitterSignature
                    ? `<img src="${coaData.submitterSignature}" alt="Chữ ký KTV" class="signature-image" />`
                    : ''}
                <div class="sig-name">${coaData.submitterName ? `KTV. ${coaData.submitterName}` : 'KTV. ...........................'}</div>
            </div>
            <div class="sig-col">
                <div class="sig-date">Cần Thơ, ${footerDateStr}</div>
                <div class="sig-title">Lãnh đạo khoa Xét nghiệm</div>
                ${coaData.approverSignature
                    ? `<img src="${coaData.approverSignature}" alt="Chữ ký" class="signature-image" />`
                    : ''}
                <div class="sig-name">${coaData.approverName}</div>
            </div>
        </div>
    `
}
```

### Update Hidden Metadata

```typescript
function renderMetadata(coaData: CoAData): string {
    return `
        <div class="metadata">
            <span data-signature-id="${coaData.signatureId}"></span>
            <span data-submitter-signature-id="${coaData.submitterSignatureId || ''}"></span>
            <span data-sample-id="${coaData.sample.id}"></span>
            <span data-approved-by="${coaData.sample.approved_by}"></span>
            <span data-approved-at="${coaData.sample.approved_at}"></span>
        </div>
    `
}
```

## UI Changes

### Analyst Profile - Signature Upload

**File:** `src/app/(dashboard)/profile/page.tsx` (or new component)

Add signature management section for analysts (reuse existing manager signature UI pattern).

### Submit Dialog - Signature Check

**File:** `src/components/assigned-tests-panel.tsx`

Before showing submit confirmation dialog, check for active signature:

```typescript
const handleSubmitClick = async () => {
    // Check for signature first
    const sigResult = await getActiveSignature()
    if (!sigResult.success) {
        toast.error('Bạn cần tải lên chữ ký điện tử trước khi gửi duyệt.')
        router.push('/profile?tab=signature')
        return
    }
    setShowSubmitDialog(true)
}
```

## API Client Updates

**File:** `src/lib/api-client.ts`

Rename and update:
```typescript
// Rename from uploadSignatureClient (currently uploadManagerSignature)
export async function uploadSignatureClient(formData: FormData) {
    // ... existing implementation, endpoint may need update
}
```

**File:** `src/lib/client-actions/types.ts`

```typescript
// Add or ensure these exist:
| 'uploadSignature'      // renamed from uploadManagerSignature
| 'getActiveSignature'
| 'getSignatureHistory'
| 'downloadSignature'
```

## File Summary

| File | Change Type |
|------|-------------|
| `supabase/migrations/XXX_analyst_esignature.sql` | New - schema + RPC update |
| `src/app/actions/signatures.ts` | Modify - rename function, remove manager-only check |
| `src/app/actions/coa.ts` | Modify - fetch analyst signature |
| `src/lib/coa/helpers.ts` | Modify - add `fetchLatestSubmission` |
| `src/lib/coa/template.ts` | Modify - render analyst signature in CoA |
| `src/types/index.ts` | Modify - extend `CoAData` type |
| `src/components/assigned-tests-panel.tsx` | Modify - signature check before submit |
| `src/app/(dashboard)/profile/page.tsx` | Modify - add signature UI for analysts |
| `src/lib/api-client.ts` | Modify - rename function |
| `src/lib/client-actions/types.ts` | Modify - update action names |
| `src/app/api/client-actions/route.ts` | Modify - update handler mapping |

## Agent Mapping for Execution

When using subagent-driven-development, dispatch these specialized agents:

| Task Pattern | Subagent Type | Model | Notes |
|--------------|---------------|-------|-------|
| Database/migration tasks | backend-architect | sonnet | Schema, RLS, triggers |
| Server action tasks | backend-architect | sonnet | Auth, validation |
| React component tasks | frontend-developer | sonnet | Components, hooks |
| TypeScript type tasks | typescript-pro | haiku | Types, interfaces |
| Template/rendering tasks | frontend-developer | sonnet | HTML generation |

### Task-Specific Agents for This Feature

| Task | Agent Type | Model |
|------|------------|-------|
| Create `sample_submissions` table + RLS | backend-architect | sonnet |
| Update `submit_sample_for_review` RPC | backend-architect | sonnet |
| Modify `uploadManagerSignature` → `uploadSignature` | backend-architect | sonnet |
| Add `fetchLatestSubmission` helper | backend-architect | sonnet |
| Update `generateCoA` to fetch analyst signature | backend-architect | sonnet |
| Update `CoAData` type | typescript-pro | haiku |
| Update `renderSignatures` template | frontend-developer | sonnet |
| Add signature check to submit flow | frontend-developer | sonnet |
| Add signature UI to analyst profile | frontend-developer | sonnet |
| Update API client functions | typescript-pro | haiku |

### Parallelization Groups

- **Group 1** (parallel): Create table migration, Update CoAData type
- **Group 2** (sequential, depends on Group 1): Update RPC, Add helper function
- **Group 3** (parallel): Update generateCoA, Update template, Update API client
- **Group 4** (parallel): Add signature check to submit, Add profile signature UI
- **Group 5** (sequential): Integration testing

## Verification

1. **Analyst uploads signature**: Profile → Signature tab → Upload PNG/JPEG
2. **Submit without signature**: Should show error, redirect to profile
3. **Submit with signature**: Creates `sample_submissions` record
4. **Re-submit after rejection**: Creates new record with incremented `submission_number`
5. **CoA generation**: Shows both analyst + manager signatures
6. **Audit trail**: `sample_submissions` table has complete history
