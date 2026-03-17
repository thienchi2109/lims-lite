# QR Scanner CCCD/VNeID Optimization Walkthrough (2026-03-16)

## Mục tiêu

Triển khai OpenSpec change `update-qr-scanner-cccd-vneid` theo TDD để tăng độ ổn định quét QR nhỏ/mật độ cao (CCCD/VNeID), đồng thời giữ nguyên luồng nghiệp vụ tiếp nhận mẫu và fallback USB/Bluetooth.

## Tóm tắt triển khai theo phase (TDD + commit)

### Phase 1 - Scanner configuration hardening

- **Red:** thêm test cho constructor/start profile tối ưu + fallback khi constraint không hỗ trợ.
- **Green:** triển khai:
  - QR-only decode (`formatsToSupport: [QR_CODE]`)
  - Explicit BarcodeDetector preference
  - Profile tối ưu: `fps=8`, `disableFlip=true`, `qrbox` thu hẹp, HD-oriented `videoConstraints`
  - Fallback an toàn sang profile tương thích khi lỗi constraint
- **Commit:** `3cd926f` - `feat: optimize QR scanner startup profile`

### Phase 2 - Capability-aware runtime tuning

- **Red:** thêm test cho runtime tuning theo capability.
- **Green:** triển khai best-effort runtime constraints:
  - `zoom`
  - `torch`
  - `focusMode='continuous'`
  - `focusDistance`
- **Commit:** `efb5e88` - `feat: add capability-aware QR camera tuning`

### Phase 3 - UX guidance, telemetry, continuity

- **Red:** thêm test cho:
  - Guidance tiếng Việt không chặn luồng
  - Compatibility guidance khi downgrade constraint
  - Success/failure telemetry
  - Continuity USB/Bluetooth + camera trong cùng dialog
- **Green:** triển khai:
  - Guidance mặc định: mẹo khoảng cách/ánh sáng/giữ ổn định
  - Guidance tương thích khi fallback constraint
  - Telemetry event:
    - success: `timeToFirstDecodeMs`, `decoderSource`, `usedCompatibilityMode`
    - failure: `bucket` (`no_code_found`, `constraints`, ...)
  - Giữ nguyên auto-close khi decode thành công
- **Commit:** `43545e1` - `feat: add QR scan guidance and telemetry`

## File thay đổi chính

- `src/components/qr-scanner.tsx`
- `src/lib/qr/camera-scan-profile.ts`
- `src/components/__tests__/qr-scanner.test.tsx`
- `src/components/__tests__/client-qr-scanner-dialog.test.tsx`

## Kết quả verification

### Pass (change-focused)

- `npm run typecheck` ✅
- `npx vitest run src/components/__tests__/qr-scanner.test.tsx src/components/__tests__/client-qr-scanner-dialog.test.tsx` ✅ (11 tests)
- `npx eslint <changed-files>` ✅ (0 error, chỉ còn warning hook-deps trong `qr-scanner.tsx`)
- `npm run build` ✅

### Baseline repo issues (pre-existing, không thuộc phạm vi change này)

- `npm run lint` ❌ với lỗi tồn đọng toàn repo (318 issues, 174 errors)
- `npx vitest run --bail=1` ❌ do test tồn đọng ngoài phạm vi QR (ví dụ `reports.test.ts` và các `.mjs` suite không tương thích Vitest)

## Checklist regression thủ công cho CCCD/VNeID

- [ ] Quét CCCD vật lý (QR nhỏ, mật độ cao) trên mobile camera sau.
- [ ] Quét QR từ màn hình VNeID với độ sáng màn hình thấp/trung bình/cao.
- [ ] Kiểm tra trong điều kiện ánh sáng yếu (không bật torch, bật torch nếu máy hỗ trợ).
- [ ] Xác nhận fallback guidance hiển thị khi thiết bị không đáp ứng constraint HD.
- [ ] Xác nhận decode thành công vẫn tự đóng scanner và điền đúng thông tin khách hàng.
- [ ] Xác nhận luồng máy quét USB/Bluetooth trong cùng dialog vẫn hoạt động.
- [ ] Ghi nhận telemetry để so sánh baseline vs optimized:
  - `timeToFirstDecodeMs`
  - `decoderSource`
  - failure buckets
