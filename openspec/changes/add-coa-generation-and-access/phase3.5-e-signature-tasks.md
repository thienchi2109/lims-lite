# Phase 3.5: E-Signature Infrastructure - Tasks

**Purpose:** Add manager e-signature capability for CoA approval with 21 CFR Part 11 compliance

**Status:** Planned
**Prerequisites:** Phase 1-3 complete

---

## Overview

Implement electronic signature infrastructure allowing managers to upload and manage their signature images, which will be embedded in generated Certificate of Analysis (CoA) HTML files. Signatures are versioned, audited, and immutably linked to CoA records for regulatory compliance.

---

## 3.5.1 Database Schema - E-Signature Tables

### Tasks

- [ ] 3.5.1.1 Create `user_signatures` table with version tracking and audit fields
- [ ] 3.5.1.2 Add `signature_id` foreign key column to `coa_reports` table
- [ ] 3.5.1.3 Create indexes on `user_signatures` (user_id, is_active, uploaded_at)
- [ ] 3.5.1.4 Add unique constraint: one active signature per user
- [ ] 3.5.1.5 Create audit triggers for `user_signatures` table
- [ ] 3.5.1.6 Add RLS policies for `user_signatures` (managers can manage own signature)
- [ ] 3.5.1.7 Run `run_security_tests()` and validate constraints
- [ ] 3.5.1.8 Document migration in `phase3.5-e-signature-migration.md`

### Schema Definition

```sql
-- user_signatures table
CREATE TABLE user_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signature_path TEXT NOT NULL,  -- Storage: user-signatures/{user_id}/{timestamp}.png
    signature_hash TEXT NOT NULL,  -- SHA-256 for integrity verification
    file_size INT NOT NULL,  -- File size in bytes
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg')),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN DEFAULT true,  -- Only one active signature per user
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL  -- Soft delete for audit trail
);

-- Add signature reference to coa_reports
ALTER TABLE coa_reports
ADD COLUMN signature_id UUID REFERENCES user_signatures(id);

-- Add comment
COMMENT ON COLUMN coa_reports.signature_id IS 'Links to exact signature version used for approval (21 CFR Part 11 compliance)';

-- Indexes
CREATE INDEX idx_user_signatures_user_id ON user_signatures(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_signatures_is_active ON user_signatures(user_id, is_active) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_coa_reports_signature_id ON coa_reports(signature_id) WHERE deleted_at IS NULL;

-- Unique constraint: only one active signature per user
CREATE UNIQUE INDEX idx_user_signatures_active_unique
ON user_signatures(user_id)
WHERE is_active = true AND deleted_at IS NULL;

-- Check constraint: file size limit (500KB max)
ALTER TABLE user_signatures
ADD CONSTRAINT check_signature_file_size
CHECK (file_size > 0 AND file_size <= 512000);  -- 500KB
```

---

## 3.5.2 Storage Infrastructure - User Signatures Bucket

### Tasks

- [ ] 3.5.2.1 Create `user-signatures` storage bucket with RLS policies
- [ ] 3.5.2.2 Configure bucket: private, 500KB limit, PNG/JPEG only
- [ ] 3.5.2.3 Add INSERT policy: managers can upload own signature only
- [ ] 3.5.2.4 Add SELECT policy: managers can read own signature, service role for CoA generation
- [ ] 3.5.2.5 Deny UPDATE/DELETE (immutability - use `is_active` flag instead)
- [ ] 3.5.2.6 Test signed URL generation for signature preview
- [ ] 3.5.2.7 Verify folder structure validation: `{user_id}/{timestamp}.png`

### Storage Configuration

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-signatures',
    'user-signatures',
    false,  -- Private
    512000,  -- 500KB
    ARRAY['image/png', 'image/jpeg']::text[]
);

-- INSERT policy: managers upload own signature only
CREATE POLICY "user_signatures_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-signatures'
    AND public.get_user_role() = 'manager'
    AND (storage.foldername(name))[1] = auth.uid()::text  -- Path must be {user_id}/...
);

-- SELECT policy: managers read own, service role reads all (for CoA generation)
CREATE POLICY "user_signatures_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'user-signatures'
    AND (
        (public.get_user_role() = 'manager' AND (storage.foldername(name))[1] = auth.uid()::text)
        OR public.get_user_role() = 'service_role'
    )
);
```

**Path Structure:** `user-signatures/{user_id}/{timestamp}.{ext}`

**Example:** `user-signatures/a1b2c3d4-e5f6-7890-abcd-ef1234567890/2025-12-14T10:30:00.000Z.png`

---

## 3.5.3 Backend - Signature Upload & Management

### Tasks

- [ ] 3.5.3.1 Create server action `uploadManagerSignature(file: File)` with validation
- [ ] 3.5.3.2 Implement signature file validation (format, size, dimensions)
- [ ] 3.5.3.3 Generate SHA-256 hash for uploaded signature
- [ ] 3.5.3.4 Deactivate previous signature (`is_active = false`) before inserting new one
- [ ] 3.5.3.5 Upload signature to storage bucket with proper path structure
- [ ] 3.5.3.6 Insert `user_signatures` record with metadata
- [ ] 3.5.3.7 Create server action `getActiveSignature(userId: string)` for retrieval
- [ ] 3.5.3.8 Create server action `getSignatureHistory(userId: string)` for audit trail
- [ ] 3.5.3.9 Handle errors: file too large, invalid format, upload failure
- [ ] 3.5.3.10 Add Zod schemas for signature upload validation

### Signature Validation Rules

```typescript
// Validation constraints
const SIGNATURE_VALIDATION = {
  maxFileSize: 500 * 1024,  // 500KB
  allowedMimeTypes: ['image/png', 'image/jpeg'],
  minWidth: 200,  // pixels
  minHeight: 80,   // pixels
  maxWidth: 800,
  maxHeight: 400
};

// Zod schema
const signatureUploadSchema = z.object({
  file: z.instanceof(File)
    .refine(f => f.size <= SIGNATURE_VALIDATION.maxFileSize, 'File size must be under 500KB')
    .refine(f => SIGNATURE_VALIDATION.allowedMimeTypes.includes(f.type), 'Only PNG or JPEG allowed')
});
```

---

## 3.5.4 Backend - CoA Generation Integration

### Tasks

- [ ] 3.5.4.1 Modify `generateCoA()` to fetch approver's active signature
- [ ] 3.5.4.2 Validate signature exists before generating CoA (block if missing)
- [ ] 3.5.4.3 Download signature from storage and convert to base64
- [ ] 3.5.4.4 Embed signature as data URI in HTML template
- [ ] 3.5.4.5 Link `coa_reports.signature_id` to exact signature used
- [ ] 3.5.4.6 Verify signature hash matches before embedding
- [ ] 3.5.4.7 Handle missing signature error with clear message
- [ ] 3.5.4.8 Add signature metadata to CoA HTML (approver name, date, signature ID)

### CoA Generation Flow Update

```typescript
// Updated generateCoA workflow
export async function generateCoA(sampleId: string) {
  const supabase = await createClient()

  // 1. Fetch sample data
  const sample = await fetchSampleWithApprover(sampleId)
  const approverId = sample.approved_by

  // 2. Fetch approver's ACTIVE signature
  const { data: signature, error } = await supabase
    .from('user_signatures')
    .select('id, signature_path, signature_hash, mime_type')
    .eq('user_id', approverId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single()

  // 3. BLOCK if no signature
  if (error || !signature) {
    throw new Error(
      'Người phê duyệt chưa tải lên chữ ký điện tử. ' +
      'Vui lòng tải lên chữ ký trong Cài đặt tài khoản trước khi tạo CoA.'
    )
  }

  // 4. Download signature and verify hash
  const { data: signatureFile } = await supabase.storage
    .from('user-signatures')
    .download(signature.signature_path)

  const signatureBuffer = await signatureFile.arrayBuffer()
  const computedHash = crypto.createHash('sha256')
    .update(Buffer.from(signatureBuffer))
    .digest('hex')

  if (computedHash !== signature.signature_hash) {
    throw new Error('Signature integrity check failed')
  }

  // 5. Convert to base64 for embedding
  const signatureBase64 = Buffer.from(signatureBuffer).toString('base64')
  const signatureDataUri = `data:${signature.mime_type};base64,${signatureBase64}`

  // 6. Generate HTML with embedded signature
  const html = renderCoATemplate(sample, {
    approverSignature: signatureDataUri,
    approverName: sample.approver_name,
    approvalDate: formatDate(sample.approved_at)
  })

  // 7. Upload HTML and insert record
  const { filePath, hash } = await uploadCoAHtml(sampleId, html, version)

  await supabase.from('coa_reports').insert({
    sample_id: sampleId,
    file_path: filePath,
    file_hash: hash,
    signature_id: signature.id,  // ✅ Link to exact signature used
    version,
    status: 'ready'
  })

  return { success: true, coaId }
}
```

---

## 3.5.5 Frontend - Manager Account Creation Workflow

### Tasks

- [ ] 3.5.5.1 Add signature upload step to manager account creation form
- [ ] 3.5.5.2 Create `SignatureUploadField` component with drag-and-drop
- [ ] 3.5.5.3 Add signature preview with dimensions display
- [ ] 3.5.5.4 Show validation errors (file size, format, dimensions)
- [ ] 3.5.5.5 Make signature upload REQUIRED for manager role
- [ ] 3.5.5.6 Make signature upload OPTIONAL (or skip) for analyst role
- [ ] 3.5.5.7 Display success message after signature upload
- [ ] 3.5.5.8 Update manager creation flow: `Create User → Upload Signature → Complete`

### UI Flow

**Manager Creation Form Enhancement:**

```
Step 1: Basic Info
├── Email, Name, Phone
├── Role Selection: [ ] Analyst  [x] Manager
└── [Next Step]

Step 2: Signature Upload (ONLY if role = Manager)
├── Drag & Drop Zone
├── File Validation (size, format, dimensions)
├── Signature Preview
└── [Upload & Create Account]

Step 3: Success
├── "Tài khoản quản lý đã được tạo thành công"
├── "Chữ ký điện tử đã được tải lên"
└── [Back to Users List]
```

### Component Structure

```tsx
// components/manager/signature-upload-field.tsx
interface SignatureUploadFieldProps {
  onUpload: (file: File) => Promise<void>;
  required?: boolean;
}

export function SignatureUploadField({ onUpload, required }: SignatureUploadFieldProps) {
  // Drag & drop zone
  // File validation
  // Preview with dimensions
  // Upload button
  // Error display
}
```

---

## 3.5.6 Frontend - Manager Settings Page

### Tasks

- [ ] 3.5.6.1 Create `/manager/settings` page route
- [ ] 3.5.6.2 Add "Chữ ký điện tử" (E-Signature) section to settings
- [ ] 3.5.6.3 Display current active signature with preview
- [ ] 3.5.6.4 Show signature metadata (upload date, file size, dimensions)
- [ ] 3.5.6.5 Add "Thay đổi chữ ký" (Change Signature) button
- [ ] 3.5.6.6 Implement signature upload modal/dialog
- [ ] 3.5.6.7 Add signature history viewer (previous versions)
- [ ] 3.5.6.8 Show warning before replacing signature
- [ ] 3.5.6.9 Display success notification after upload
- [ ] 3.5.6.10 Handle "No signature uploaded" state with upload CTA

### Settings Page Structure

```tsx
// app/(dashboard)/manager/settings/page.tsx

export default function ManagerSettingsPage() {
  return (
    <div>
      <h1>Cài đặt tài khoản</h1>

      {/* Profile Section */}
      <section>
        <h2>Thông tin cá nhân</h2>
        {/* Name, email, phone */}
      </section>

      {/* E-Signature Section */}
      <section>
        <h2>Chữ ký điện tử</h2>
        {hasSignature ? (
          <>
            <SignaturePreview signature={activeSignature} />
            <Button onClick={openChangeSignatureDialog}>
              Thay đổi chữ ký
            </Button>
            <Button variant="ghost" onClick={viewHistory}>
              Xem lịch sử chữ ký
            </Button>
          </>
        ) : (
          <Alert variant="warning">
            <p>Bạn chưa tải lên chữ ký điện tử.</p>
            <p>Chữ ký điện tử bắt buộc để phê duyệt và tạo Giấy chứng nhận phân tích (CoA).</p>
            <Button onClick={openUploadSignatureDialog}>
              Tải lên chữ ký
            </Button>
          </Alert>
        )}
      </section>
    </div>
  );
}
```

---

## 3.5.7 Frontend - Signature History Viewer

### Tasks

- [ ] 3.5.7.1 Create `SignatureHistoryDialog` component
- [ ] 3.5.7.2 Fetch signature history via server action
- [ ] 3.5.7.3 Display table: Upload Date, Status (Active/Inactive), Preview
- [ ] 3.5.7.4 Show which CoAs used each signature version
- [ ] 3.5.7.5 Add search/filter by date range
- [ ] 3.5.7.6 Display "Currently Active" badge on active signature

### History Table Columns

| Upload Date | Status | Preview | Used in CoAs | Actions |
|-------------|--------|---------|--------------|---------|
| 2025-12-14 10:30 | 🟢 Active | [Preview] | 45 CoAs | [View Details] |
| 2025-11-20 09:15 | ⚫ Inactive | [Preview] | 23 CoAs | [View Details] |
| 2025-10-05 14:22 | ⚫ Inactive | [Preview] | 12 CoAs | [View Details] |

---

## 3.5.8 Frontend - CoA Preview Enhancement

### Tasks

- [ ] 3.5.8.1 Update CoA preview modal to show signature
- [ ] 3.5.8.2 Display signature metadata (approver name, date, signature ID)
- [ ] 3.5.8.3 Add signature verification indicator (hash match)
- [ ] 3.5.8.4 Show signature version information
- [ ] 3.5.8.5 Handle missing signature gracefully in preview

---

## 3.5.9 HTML Template Integration

### Tasks

- [ ] 3.5.9.1 Update `CoATemplate.html` to include signature placeholder
- [ ] 3.5.9.2 Add CSS styling for signature image (max-width, max-height)
- [ ] 3.5.9.3 Ensure signature displays correctly in print layout
- [ ] 3.5.9.4 Add signature metadata footer (name, date, ID)
- [ ] 3.5.9.5 Test signature rendering in different browsers
- [ ] 3.5.9.6 Verify signature visibility when printed/PDF exported

### Template Update

```html
<!-- In CoATemplate.html footer section -->
<div class="signature-section">
  <div class="signature-block">
    <p class="signature-title">PHỤ TRÁCH XÉT NGHIỆM</p>
    <div class="signature-placeholder">
      (Ký và ghi rõ họ tên)
    </div>
  </div>

  <div class="signature-block">
    <p class="signature-title">LÃNH ĐẠO KHOA XÉT NGHIỆM</p>
    ${approverSignature ? `
      <img src="${approverSignature}" alt="Chữ ký" class="signature-image" />
      <p class="approver-name">${approverName}</p>
      <p class="approval-date">Ngày ${approvalDate}</p>
    ` : `
      <div class="signature-placeholder">
        (Ký và ghi rõ họ tên)
      </div>
    `}
  </div>
</div>

<style>
.signature-section {
  display: flex;
  justify-content: space-around;
  margin-top: 40px;
  page-break-inside: avoid;
}

.signature-block {
  text-align: center;
  width: 250px;
}

.signature-title {
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 10px;
}

.signature-image {
  max-width: 200px;
  max-height: 80px;
  margin: 15px 0;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

.signature-placeholder {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-style: italic;
  color: #666;
}

.approver-name {
  font-weight: bold;
  font-size: 13px;
  margin-top: 5px;
}

.approval-date {
  font-size: 12px;
  margin-top: 5px;
}

@media print {
  .signature-section {
    margin-top: 30px;
  }
}
</style>
```

---

## 3.5.10 Testing & Validation

### Tasks

- [ ] 3.5.10.1 Test signature upload with valid PNG/JPEG files
- [ ] 3.5.10.2 Test validation: file too large (>500KB)
- [ ] 3.5.10.3 Test validation: invalid format (PDF, GIF, etc.)
- [ ] 3.5.10.4 Test validation: dimensions too small (<200x80)
- [ ] 3.5.10.5 Test signature replacement workflow (deactivate old, activate new)
- [ ] 3.5.10.6 Test CoA generation with signature embedding
- [ ] 3.5.10.7 Test CoA generation failure when signature missing
- [ ] 3.5.10.8 Test signature hash verification on CoA generation
- [ ] 3.5.10.9 Verify signature displays correctly in generated HTML
- [ ] 3.5.10.10 Test RLS policies: manager can only upload own signature
- [ ] 3.5.10.11 Test RLS policies: managers cannot see other's signatures
- [ ] 3.5.10.12 Test signature history viewer shows all versions
- [ ] 3.5.10.13 Verify only one signature marked as active per user
- [ ] 3.5.10.14 Test manager creation workflow with signature upload
- [ ] 3.5.10.15 Run `run_security_tests()` and verify all pass
- [ ] 3.5.10.16 Run typecheck and lint

---

## 3.5.11 Documentation

### Tasks

- [ ] 3.5.11.1 Document signature upload requirements for managers
- [ ] 3.5.11.2 Create user guide: "Cách tải lên chữ ký điện tử" (How to upload e-signature)
- [ ] 3.5.11.3 Document signature file specifications (format, size, dimensions)
- [ ] 3.5.11.4 Add troubleshooting guide for signature upload errors
- [ ] 3.5.11.5 Document 21 CFR Part 11 compliance notes for e-signatures
- [ ] 3.5.11.6 Update manager onboarding documentation
- [ ] 3.5.11.7 Create migration documentation: `phase3.5-e-signature-migration.md`
- [ ] 3.5.11.8 Update API documentation for signature endpoints

---

## Implementation Order

**Recommended sequence:**

1. **Database (3.5.1)** - Create tables, constraints, RLS policies
2. **Storage (3.5.2)** - Create bucket, configure policies
3. **Backend Upload (3.5.3)** - Signature upload logic
4. **Backend CoA Integration (3.5.4)** - Embed signature in CoA generation
5. **Frontend Settings (3.5.6)** - Manager can upload/manage signature
6. **Frontend Account Creation (3.5.5)** - Add signature upload to manager creation
7. **Frontend History (3.5.7)** - Signature version history
8. **HTML Template (3.5.9)** - Update template to display signature
9. **Testing (3.5.10)** - Comprehensive testing
10. **Documentation (3.5.11)** - User and developer guides

---

## Success Criteria

✅ Managers can upload PNG/JPEG signatures (max 500KB, 200x80 to 800x400px)
✅ Only one active signature per manager at a time
✅ Signature embedded as base64 data URI in CoA HTML
✅ `coa_reports.signature_id` links to exact signature version used
✅ Signature history preserved with audit trail
✅ CoA generation blocked if manager has no active signature
✅ Signature integrity verified via SHA-256 hash
✅ RLS policies prevent managers from accessing other's signatures
✅ Manager account creation includes signature upload step
✅ All security tests pass
✅ 21 CFR Part 11 compliance requirements satisfied

---

## 21 CFR Part 11 Compliance Notes

This implementation satisfies:

**§11.50 Signature Manifestations:**
- ✅ Signature displayed as image in CoA
- ✅ Name and date shown alongside signature
- ✅ Meaning clear: "LÃNH ĐẠO KHOA XÉT NGHIỆM" (Lab Director)

**§11.70 Signature/Record Linking:**
- ✅ `coa_reports.signature_id` immutably links signature to record
- ✅ Signature embedded in immutable HTML file
- ✅ File hash verifies integrity of entire document

**§11.200 Electronic Signature Components:**
- ✅ User authentication via login = identifier component
- ✅ Session management = password/authentication component
- ✅ Signature uniquely linked to user via `user_id`

**§11.300 Controls for Closed Systems:**
- ✅ Audit trail via `user_signatures` table
- ✅ Version history preserved (old signatures not deleted)
- ✅ Signature cannot be repudiated (immutable linkage)
- ✅ Loss protection via soft delete and backup

---

## Open Questions

1. **Signature dimensions requirements?**
   - Current: 200x80px min, 800x400px max - is this acceptable?

2. **Signature re-certification period?**
   - Should signatures expire after X months? (e.g., annual re-upload)

3. **Signature upload during account creation vs later?**
   - REQUIRED during creation? OR
   - OPTIONAL during creation, REQUIRED before first CoA approval?

4. **Fallback for old CoAs?**
   - What if signature file is lost/corrupted but hash exists?
   - Display hash only with warning?

5. **Multiple signature types?**
   - Support different signatures for different roles/purposes?
   - E.g., "Initial Approval" vs "Final Review" signatures?
