## ADDED Requirements

### Requirement: Public CoA Access Portal

The system SHALL provide a public-facing portal at `/coa/access` allowing clients to retrieve their Certificate of Analysis reports using phone-based authentication without requiring system login credentials.

#### Scenario: Client accesses CoA portal

**GIVEN** a client has a phone number registered in the system
**WHEN** the client navigates to `/coa/access`
**THEN** the system SHALL:
- Display a public page (no authentication required to view form)
- Show Vietnamese UI with labels: "Truy cập Giấy chứng nhận phân tích", "Số điện thoại", "Mật khẩu (6 chữ số cuối của số điện thoại)"
- Provide phone input field (validates Vietnamese format: `^(0|\+84)[0-9]{9,10}$`)
- Provide passcode input field (6 digits, masked)
- Show submit button to authenticate

#### Scenario: Successful phone-based authentication

**GIVEN** a client submits valid phone number and passcode
**WHEN** the authentication request is processed
**THEN** the system SHALL:
- Normalize phone number (convert +84 ↔ 0 prefix consistently)
- Query `clients` table WHERE `phone = normalized_phone`
- Extract last 6 digits from stored phone number
- Compare with provided passcode
- If match: generate JWT token (15-minute expiry) containing client_id
- Return list of client's approved samples with CoA download links
- Display Vietnamese message: "Mẫu của bạn" (Your Samples)
- Show each sample with: sample_id, collection date, sample type, "Tải xuống CoA" link
- Log successful access to `coa_access_log` with client_id, timestamp, IP, success=true

#### Scenario: Failed authentication

**GIVEN** a client submits invalid phone number or passcode
**WHEN** the authentication request is processed
**THEN** the system SHALL:
- Log failed attempt to `coa_access_log` with IP, success=false, failure_reason
- Return generic error message (do not reveal if phone exists): "Không tìm thấy mẫu hoặc mật khẩu không đúng"
- NOT display whether phone number exists in system
- Track attempt count per IP address

#### Scenario: Rate limiting prevents brute force

**GIVEN** an IP address has made 5 failed authentication attempts within 15 minutes
**WHEN** another authentication request is received from the same IP
**THEN** the system SHALL:
- Reject the request immediately
- Return HTTP 429 Too Many Requests
- Display Vietnamese message: "Quá nhiều lần thử. Vui lòng thử lại sau 15 phút." (Too many attempts. Please try again after 15 minutes.)
- Log rate limit violation
- Reset attempt counter after 15 minutes

#### Scenario: Client downloads CoA report

**GIVEN** a client has successfully authenticated and sees their sample list
**WHEN** the client clicks "Tải xuống CoA" link
**THEN** the system SHALL:
- Validate JWT token (verify signature, check expiry, extract client_id and sample_id)
- Verify the sample belongs to the authenticated client
- Fetch `coa_reports.file_path` for the sample_id
- Generate a signed Storage URL with 15-minute expiry
- Log access to `coa_access_log` with client_id, sample_id, accessed_at, IP, success=true
- Return/redirect to the signed URL
- Client's browser downloads the PDF file
- Update `coa_reports.accessed_at` timestamp

#### Scenario: Expired or invalid token

**GIVEN** a client attempts to download CoA with expired or tampered JWT token
**WHEN** the download request is processed
**THEN** the system SHALL:
- Validate token signature and expiry
- If invalid or expired: reject request with HTTP 401 Unauthorized
- Display Vietnamese message: "Phiên đã hết hạn. Vui lòng đăng nhập lại." (Session expired. Please login again.)
- Log failed download attempt
- Do not generate signed URL or access CoA file

#### Scenario: Client has no approved samples

**GIVEN** a client authenticates successfully but has no samples with status='approved'
**WHEN** the authentication completes
**THEN** the system SHALL:
- Return empty sample list
- Display Vietnamese message: "Chưa có kết quả phân tích nào." (No analysis results yet.)
- Log successful authentication (success=true)
- NOT show error or suggest trying different credentials

#### Scenario: Phone normalization handles both formats

**GIVEN** a client's phone is stored as "0901234567" in the database
**WHEN** the client authenticates using "+84901234567" (with country code)
**THEN** the system SHALL:
- Normalize both stored and input phone to same format (remove +84, ensure leading 0)
- Successfully match the records
- Complete authentication normally
- Same behavior applies in reverse (stored +84, input 0)
