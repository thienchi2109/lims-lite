# Phase 1: Design & Decisions - CoA Generation and Access

**Status:** ✅ Complete
**Date:** 2025-12-14

---

## 1.1 HTML Template Structure Review

**Reference:** `docs/references/CoATemplate.html`

### Template Overview
- **Format:** Standalone HTML5 document with embedded CSS and JavaScript
- **Page Size:** A4 (210mm × 297mm)
- **Localization:** Vietnamese language (all UI text)
- **Print-optimized:** Uses `@media print` rules and auto-triggers print dialog

### Key Sections

#### Header (3-column layout)
1. **Left:** Organization logo (CDC logo, 100px width)
2. **Center:** Organization details
   - Parent organization: "SỞ Y TẾ THÀNH PHỐ CẦN THƠ"
   - Organization name: "TRUNG TÂM KIỂM SOÁT BỆNH TẬT (CDC)"
   - Address: "400 Nguyễn Văn Cừ, P. An Bình, TP. Cần Thơ"
   - Form title: "PHIẾU KẾT QUẢ XÉT NGHIỆM" (red color: #b91c1c)
3. **Right:** QR code (90px × 90px) + Sample ID box

#### Patient Information Table
- **Fields:**
  - Họ tên (Patient name) - uppercase, bold, 16px
  - Năm sinh / Giới tính (DOB / Gender)
  - Số điện thoại (Phone number)
  - Địa chỉ (Address)
  - Đơn vị gửi mẫu (Referring organization/doctor)
  - Ngày lấy mẫu (Collection date)
  - Chất lượng mẫu (Sample quality) - defaults to "Đạt yêu cầu"

#### Results Table
- **Columns:**
  1. STT (Sequential number)
  2. Tên Xét Nghiệm (Test name)
  3. Kết Quả (Result) - bold, center, 15px
  4. Đơn Vị (Unit)
  5. Khoảng Tham Chiếu (Reference range)
  6. Phương Pháp / Thiết Bị (Method/Device)
- **Grouping:** Tests grouped by category with red category header rows
- **Category styling:** Red background (#fef2f2), red text (#dc2626), uppercase, bold

#### Footer (2-column layout)
1. **Left:** "PHỤ TRÁCH XÉT NGHIỆM" (Technician signature area)
2. **Right:** "LÃNH ĐẠO KHOA XÉT NGHIỆM" (Lab director signature area)
   - Includes date in Vietnamese format
   - Approver name (defaults to "TS.BS. .................................")
- **Disclaimer:** "Kết quả này chỉ có giá trị trên mẫu xét nghiệm tại thời điểm kiểm tra."

### Technical Features
- **QR Code:** External API (`https://api.qrserver.com/v1/create-qr-code/`) - generates QR from sample ID
- **Logo:** External image URL (`https://i.postimg.cc/8zFZ52j1/cdc-logo-150.png`)
- **Fonts:** Times New Roman (serif) for body text
- **Auto-print:** `window.onload` triggers `window.print()` after 500ms delay
- **Inline styles:** All CSS embedded in `<style>` tag for self-containment

### Data Binding Requirements
The template uses JavaScript template literals with the following variables:
- `sample.sampleId` - Sample identifier
- `sample.patientName` - Patient full name
- `sample.dob` - Date of birth
- `sample.gender` - Gender
- `sample.phoneNumber` - Phone number
- `sample.address` - Address
- `sample.doctorName` - Referring doctor/organization
- `sample.collectionDate` - Collection date
- `sample.sampleQuality` - Sample quality
- `sample.approver` - Approver name
- `sample.tests[]` - Array of test results with:
  - `code` - Test code
  - `name` - Test name
  - `result` - Test result value
  - `unit` - Unit of measurement
  - `refRange` - Reference range
  - `method` - Method/device
  - `category` - Test category for grouping

### Adaptations Needed for Static HTML Storage

1. **Remove auto-print trigger** - Replace `window.onload` print trigger with user-initiated print
2. **Embed external resources** - Download and embed logo as base64 data URI
3. **Add version watermark** - For amended reports, add "Amended Report v{N}" text
4. **Add generation timestamp** - Display HTML generation date
5. **Add file hash display (optional)** - Show SHA-256 hash for verification
6. **QR code handling** - Keep external API for simplicity, or generate server-side for offline support

---

## 1.2 CoA Retention Policy

### Policy Statement
**Certificate of Analysis (CoA) files shall be retained for a minimum of 2 years from the date of generation, in compliance with 21 CFR Part 11 requirements for electronic records in regulated laboratories.**

### Requirements

#### Minimum Retention Period
- **Duration:** 2 years (configurable via environment variable `COA_RETENTION_YEARS`)
- **Start date:** Date of CoA generation (`coa_reports.generated_at`)
- **Rationale:**
  - 21 CFR Part 11 requires retention of approved records for regulatory inspection
  - Vietnamese healthcare regulations may require longer retention (verify with legal)
  - Industry standard for clinical lab reports: 2-7 years

#### Retention Scope
- **All versions:** Preserve all CoA versions (original + amendments) for audit trail
- **Metadata:** Retain `coa_reports` database records even if files are archived
- **Audit logs:** Retain `coa_access_log` records for same duration as CoA files

#### Implementation

**Database Schema:**
- `coa_reports.deleted_at` - Soft delete timestamp (NULL = active)
- Use soft delete instead of hard delete to preserve metadata

**Storage Lifecycle:**
```sql
-- After retention period expires, mark for archival
UPDATE coa_reports
SET deleted_at = NOW()
WHERE generated_at < NOW() - INTERVAL '2 years'
AND deleted_at IS NULL;
```

**Archival Options (Future Enhancement):**
1. **Move to cold storage** - Transfer files to cheaper S3 Glacier-equivalent storage
2. **Compress archives** - Zip old files by year/month
3. **Backup to external media** - Copy to offline backup for long-term preservation

**Access After Retention:**
- Archived files remain accessible to managers for compliance audits
- Clients cannot access archived reports via public portal (filter by `deleted_at IS NULL`)

#### Configuration
```env
# .env
COA_RETENTION_YEARS=2  # Minimum 2, can increase for specific compliance needs
```

#### Compliance Notes
- **Immutability:** Files in Supabase Storage are never modified or deleted during retention period
- **Verification:** File hash stored in database allows integrity verification
- **Audit trail:** All access logged with timestamp and IP address
- **Amendment preservation:** Original approved reports preserved even when amended

---

## 1.3 RLS Policy Matrix

### Overview
Row Level Security (RLS) policies enforce access control at the database level for `coa_reports`, `coa_access_log` tables and `coa-reports` Storage bucket.

### Helper Functions Used
- `auth.uid()` - Returns authenticated user's UUID
- `get_user_role()` - Returns user's role ('analyst', 'manager', or NULL)

---

### Table: `coa_reports`

| Operation | Policy Name | Allowed When | Purpose |
|-----------|-------------|--------------|---------|
| **SELECT** | `coa_reports_select_authenticated` | `get_user_role() IN ('analyst', 'manager')` | Managers and analysts can view all CoA records |
| **INSERT** | `coa_reports_insert_service` | Service role only (bypass RLS in server action) | Only server action can create CoA records during generation |
| **UPDATE** | `coa_reports_update_status` | `get_user_role() = 'manager' AND status = 'failed'` | Managers can update failed CoA status for retry |
| **DELETE** | DENY ALL | No policy (deny by default) | Use soft delete (`deleted_at`) instead |

**Notes:**
- INSERT uses service role to bypass RLS (server action uses service key)
- UPDATE restricted to managers and only for failed status (prevent tampering with approved reports)
- No DELETE policy - soft delete via `deleted_at` column

---

### Table: `coa_access_log`

| Operation | Policy Name | Allowed When | Purpose |
|-----------|-------------|--------------|---------|
| **SELECT** | `coa_access_log_select_managers` | `get_user_role() = 'manager'` | Only managers can view audit logs |
| **INSERT** | `coa_access_log_insert_service` | Service role only (bypass RLS in server action) | Only server action can log access attempts |
| **UPDATE** | DENY ALL | No policy (deny by default) | Audit logs are immutable |
| **DELETE** | DENY ALL | No policy (deny by default) | Audit logs are immutable |

**Notes:**
- INSERT uses service role (public API endpoints log using service key)
- Audit logs are write-once, read-many (WORM) for compliance

---

### Storage Bucket: `coa-reports`

| Operation | Policy Name | Allowed When | Purpose |
|-----------|-------------|--------------|---------|
| **SELECT** | `coa_storage_select_authenticated` | `get_user_role() IN ('analyst', 'manager')` | Staff can read all CoA files |
| **SELECT** | `coa_storage_select_signed_url` | Public via signed URLs (handled by Supabase) | Clients access via signed URLs with expiry |
| **INSERT** | `coa_storage_insert_service` | Service role only | Only server action can upload CoA files |
| **UPDATE** | DENY ALL | No policy (deny by default) | CoA files are immutable |
| **DELETE** | DENY ALL | No policy (deny by default) | Use soft delete in database, keep files |

**Path Security:**
- Path prefix enforced: `coa-reports/{sample_id}/{version}-{timestamp}.html`
- Even if path is guessed, RLS + signed URL signature prevents unauthorized access

**Signed URL Configuration:**
- **Expiry:** 1 hour (3600 seconds)
- **Generated by:** Server action after JWT token validation
- **Access control:** Token includes `client_id` + `sample_id` to prevent URL sharing

---

### RLS Policy SQL Templates

#### `coa_reports` Table
```sql
-- Enable RLS
ALTER TABLE coa_reports ENABLE ROW LEVEL SECURITY;

-- SELECT: Authenticated staff
CREATE POLICY "coa_reports_select_authenticated"
ON coa_reports FOR SELECT
USING (get_user_role() IN ('analyst', 'manager'));

-- UPDATE: Managers can update failed status
CREATE POLICY "coa_reports_update_status"
ON coa_reports FOR UPDATE
USING (get_user_role() = 'manager' AND status = 'failed')
WITH CHECK (get_user_role() = 'manager' AND status IN ('pending', 'ready', 'failed'));
```

#### `coa_access_log` Table
```sql
-- Enable RLS
ALTER TABLE coa_access_log ENABLE ROW LEVEL SECURITY;

-- SELECT: Managers only
CREATE POLICY "coa_access_log_select_managers"
ON coa_access_log FOR SELECT
USING (get_user_role() = 'manager');
```

#### `coa-reports` Storage Bucket
```sql
-- SELECT: Authenticated staff
INSERT INTO storage.buckets (id, name, public) VALUES ('coa-reports', 'coa-reports', false);

CREATE POLICY "coa_storage_select_authenticated"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'coa-reports'
  AND get_user_role() IN ('analyst', 'manager')
);

-- Signed URLs handled by Supabase Storage automatically
```

---

## 1.4 Security Checklist and Rate Limiting Strategy

### Security Checklist

#### Authentication & Authorization
- [x] **Phone-based auth:** Passcode = last 6 digits of phone (simple but rate-limited)
- [x] **Generic error messages:** Don't reveal if phone exists in system
- [x] **JWT tokens:** Short expiry (1 hour) for download links
- [x] **Signed Storage URLs:** 1-hour expiry, includes signature validation
- [x] **Role-based RLS:** Analyst/manager roles enforced at database level
- [x] **Service role for inserts:** Public endpoints use service key for audit logging

#### Rate Limiting
- [x] **Auth endpoint:** 5 failed attempts per IP per 15 minutes
- [x] **Download endpoint:** Same JWT token cannot be reused (consider nonce or single-use)
- [x] **IP-based tracking:** In-memory cache (or Redis if available)
- [x] **Response:** HTTP 429 Too Many Requests with Retry-After header

#### Data Integrity
- [x] **File hash verification:** SHA-256 hash stored in database, verified on download
- [x] **Immutable storage:** Files never modified after upload (amendments = new version)
- [x] **Version tracking:** `superseded_by` field links amendment chain
- [x] **Audit trail:** All access attempts logged (success + failure) with IP and user agent

#### Privacy & Compliance
- [x] **Phone normalization:** Convert +84 ↔ 0 prefix to prevent bypass
- [x] **Audit log retention:** Retain logs for same duration as CoA files (2 years)
- [x] **IP anonymization (future):** Consider hashing IP after 30 days for privacy
- [x] **HTTPS enforcement:** All public endpoints must use HTTPS in production
- [x] **CAPTCHA (future):** Add if abuse detected

#### Input Validation
- [x] **Phone format:** Vietnamese mobile: `^(0|\+84)[3|5|7|8|9][0-9]{8,9}$`
- [x] **Passcode format:** 6 digits: `^[0-9]{6}$`
- [x] **Sample ID format:** UUID validation
- [x] **JWT validation:** Verify signature, expiry, claims (client_id, sample_id)

---

### Rate Limiting Strategy

#### Implementation Approach

**Storage Mechanism:**
- **Development:** In-memory Map (simple, no dependencies)
- **Production:** Redis (persistent, multi-instance support)

**Data Structure:**
```typescript
interface RateLimitEntry {
  ip: string;
  attempts: number;
  firstAttempt: number; // Unix timestamp
  blocked: boolean;
  blockExpiry?: number; // Unix timestamp
}
```

#### Rate Limit Rules

| Endpoint | Limit | Window | Action on Exceed |
|----------|-------|--------|------------------|
| `/api/coa/authenticate` | 5 failed attempts | 15 minutes | Block IP for 15 minutes |
| `/api/coa/download` | 10 requests | 1 minute | Block IP for 5 minutes |

#### Algorithm (Token Bucket)

```typescript
function checkRateLimit(ip: string, endpoint: string): boolean {
  const key = `ratelimit:${endpoint}:${ip}`;
  const entry = cache.get(key) || {
    ip,
    attempts: 0,
    firstAttempt: Date.now(),
    blocked: false
  };

  // Check if still blocked
  if (entry.blocked && entry.blockExpiry > Date.now()) {
    return false; // Still blocked
  }

  // Reset if window expired
  const windowMs = endpoint === 'auth' ? 15 * 60 * 1000 : 60 * 1000;
  if (Date.now() - entry.firstAttempt > windowMs) {
    entry.attempts = 0;
    entry.firstAttempt = Date.now();
    entry.blocked = false;
  }

  // Increment attempts
  entry.attempts++;

  // Check if limit exceeded
  const limit = endpoint === 'auth' ? 5 : 10;
  if (entry.attempts > limit) {
    entry.blocked = true;
    entry.blockExpiry = Date.now() + windowMs;
    cache.set(key, entry);
    return false; // Blocked
  }

  cache.set(key, entry);
  return true; // Allowed
}
```

#### Response Format

**Success (200 OK):**
```json
{
  "success": true,
  "data": { ... },
  "rateLimit": {
    "remaining": 3,
    "reset": 1640000000
  }
}
```

**Rate Limited (429 Too Many Requests):**
```json
{
  "success": false,
  "error": "Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.",
  "rateLimit": {
    "remaining": 0,
    "reset": 1640000900,
    "retryAfter": 900
  }
}
```

**HTTP Headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1640000000
Retry-After: 900  # Only on 429 response
```

#### Logging Strategy

**Log all rate limit events:**
```typescript
// Log to database (for monitoring)
await db.insert('rate_limit_events', {
  ip,
  endpoint,
  blocked: true,
  timestamp: new Date(),
  attempts: entry.attempts
});
```

**Monitoring Alerts:**
- Alert if single IP exceeds 10 failed auth attempts in 1 hour (potential attack)
- Alert if total failed auth attempts exceed 100/hour (mass brute force)
- Dashboard showing top blocked IPs and attack patterns

---

## 1.5 HTML Template Data Binding Approach

### Decision: **Server-side String Interpolation (Phase 1)**

**Rationale:**
- ✅ Simplest implementation - no additional dependencies
- ✅ Full control over HTML output
- ✅ Easy to embed inline CSS and scripts
- ✅ TypeScript type safety with template function
- ✅ Performance: ~1-2ms per render (negligible)
- ❌ No syntax highlighting in template strings
- ❌ Complex logic requires careful escaping

**Migration Path:** If template logic becomes complex (>100 lines of conditionals/loops), migrate to Handlebars or EJS in Phase 2.

---

### Implementation Design

#### Template Function Signature
```typescript
// src/lib/coa/generate-html.ts
import { ReportSampleData } from '@/types';

export async function generateCoAHtml(
  sample: ReportSampleData,
  options?: {
    version?: number;
    isAmendment?: boolean;
    previousVersionId?: string;
  }
): Promise<string> {
  // Generate HTML string
  const html = renderCoATemplate(sample, options);
  return html;
}
```

#### Data Type Definition
```typescript
// src/types/index.ts
export interface ReportSampleData {
  sampleId: string;
  patientName: string;
  dob?: string;
  gender?: string;
  phoneNumber?: string;
  address?: string;
  doctorName?: string; // Referring organization/doctor
  collectionDate: string;
  sampleQuality?: string;
  approver?: string; // Lab director name
  tests: ReportTestItem[];
}

export interface ReportTestItem {
  code: string;
  name: string;
  result?: string;
  unit?: string;
  refRange?: string; // Reference range
  method?: string; // Method/Device
  category?: string; // Test category for grouping
}
```

#### Template Rendering Logic
```typescript
function renderCoATemplate(
  sample: ReportSampleData,
  options: { version?: number; isAmendment?: boolean } = {}
): string {
  const { version = 1, isAmendment = false } = options;

  // Generate QR code URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(sample.sampleId)}&margin=0`;

  // Embed logo as base64 (or keep external URL)
  const logoUrl = "https://i.postimg.cc/8zFZ52j1/cdc-logo-150.png";

  // Format date
  const dateStr = new Date().toLocaleDateString('vi-VN');

  // Group tests by category
  const testsByCategory = groupTestsByCategory(sample.tests);

  // Render HTML (string interpolation)
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Kết Quả - ${escapeHtml(sample.sampleId)}</title>
  <style>
    /* Embedded CSS from template */
    ${getCoAStyles(isAmendment)}
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    ${renderHeader(sample, qrCodeUrl, logoUrl, version, isAmendment)}

    <!-- Patient Info -->
    ${renderPatientInfo(sample)}

    <!-- Results Table -->
    ${renderResultsTable(testsByCategory)}

    <!-- Footer -->
    ${renderFooter(sample, dateStr)}

    <!-- Disclaimer -->
    ${renderDisclaimer()}
  </div>
</body>
</html>`;
}
```

#### Helper Functions

**HTML Escaping:**
```typescript
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

**Category Grouping:**
```typescript
function groupTestsByCategory(tests: ReportTestItem[]): Record<string, ReportTestItem[]> {
  const grouped: Record<string, ReportTestItem[]> = {};
  tests.forEach(test => {
    const cat = test.category || 'KHÁC';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(test);
  });
  return grouped;
}
```

**Version Watermark:**
```typescript
function getVersionWatermark(version: number, isAmendment: boolean): string {
  if (!isAmendment || version === 1) return '';
  return `<div class="version-watermark">Amended Report v${version}</div>`;
}
```

---

### Advantages of This Approach

1. **Type Safety:** TypeScript validates template function parameters
2. **No Dependencies:** No external template engine required
3. **Testable:** Easy to unit test with mock data
4. **Performance:** Faster than template engine parsing
5. **Flexible:** Can inject dynamic logic (conditionals, loops) easily
6. **Self-Contained:** Generated HTML includes all CSS/JS inline

---

### Alternative: Template Engine (Future Consideration)

**If migrating to Handlebars/EJS:**

```handlebars
{{!-- coa-template.hbs --}}
<!DOCTYPE html>
<html lang="vi">
<head>
  <title>Kết Quả - {{sampleId}}</title>
</head>
<body>
  <h1>{{patientName}}</h1>
  {{#each testsByCategory}}
    <h2>{{@key}}</h2>
    {{#each this}}
      <p>{{name}}: {{result}} {{unit}}</p>
    {{/each}}
  {{/each}}
</body>
</html>
```

**Migration Trigger:** When template exceeds 200 lines or has >10 conditional branches.

---

## Summary

✅ **1.1 HTML Template Review:** Completed - analyzed structure, identified data binding needs, documented adaptations required
✅ **1.2 Retention Policy:** Defined - 2 years minimum, soft delete, configurable via env var
✅ **1.3 RLS Policy Matrix:** Completed - policies for tables and storage, service role for public endpoints
✅ **1.4 Security Checklist:** Completed - rate limiting strategy, audit logging, input validation
✅ **1.5 Template Data Binding:** Decided - Server-side string interpolation for Phase 1, migration path to template engine if needed

**Next Steps:** Proceed to Phase 2 (Database Migration)
