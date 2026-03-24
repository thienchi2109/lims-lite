# Kế hoạch triển khai bảo mật dữ liệu HIV/AIDS cho CDC-LIMS

## 1) Bối cảnh và mục tiêu

Tài liệu này tổng hợp kế hoạch triển khai từ kết quả rà soát hệ thống hiện tại để đáp ứng yêu cầu:

- Kết quả xét nghiệm HIV là dữ liệu nhạy cảm/bí mật y tế.
- Chỉ nhân sự được ủy quyền mới được truy cập.
- Dữ liệu phục vụ nghiên cứu/giám sát dịch tễ phải được ẩn danh.

Phạm vi tài liệu dùng bằng chứng nội bộ của codebase và tài liệu tham chiếu người dùng cung cấp, không dùng nguồn web bên ngoài.

---

## 2) Kiến trúc mục tiêu (Target Architecture)

### 2.1. Nguyên tắc kiến trúc

1. **DB-first enforcement**: RLS là lớp kiểm soát chính, không phụ thuộc UI.
2. **Least privilege**: quyền truy cập theo dữ liệu, không chỉ theo role.
3. **Defense in depth**: DB policy + application guard + audit + test.
4. **Separation of purpose**: dữ liệu vận hành và dữ liệu nghiên cứu tách luồng.

### 2.2. Mô hình dữ liệu quyền truy cập

- `assay_definitions.is_confidential BOOLEAN NOT NULL DEFAULT FALSE`
- `users.can_access_confidential BOOLEAN NOT NULL DEFAULT FALSE`
- Hàm helper `user_can_access_confidential()` (SECURITY DEFINER, STABLE)

Mở rộng giai đoạn sau:

- `users.can_export_hiv_anonymized`
- (Tùy chọn) `confidential_access_grants` để lưu lịch sử cấp/thu hồi chi tiết.

### 2.3. Luồng thực thi quyền

1. Truy cập kết quả xét nghiệm đi qua bảng `results`.
2. RLS `results` quyết định row-level visibility:
   - Không confidential: cho phép theo policy chuẩn.
   - Confidential: yêu cầu `user_can_access_confidential() = true`.
3. API trả sample/client phải áp mask PII nếu user không đủ quyền với sample có assay confidential.
4. Search/CoA/export phải tái dùng cùng quy tắc quyền, không tạo đường vòng.

---

## 3) Gap Coverage Matrix (không bỏ sót bề mặt)

| Bề mặt | Hiện trạng | Rủi ro | Kế hoạch xử lý | Ưu tiên |
|---|---|---|---|---|
| RLS `results` SELECT | `authenticated` đọc rộng | Lộ HIV result cho user không ủy quyền | Cập nhật policy theo `is_confidential` + quyền user | P0 |
| RLS `results` INSERT/UPDATE | Chưa phân loại confidential | User không quyền vẫn có thể thao tác HIV | Thêm điều kiện quyền cho thao tác confidential | P0 |
| RLS `samples`/`clients` | Đọc rộng `authenticated` | Suy diễn tình trạng HIV + lộ PII | Thêm projection/mask theo quyền confidential | P1 |
| API sample detail | Trả PII đầy đủ | Rò rỉ PII khi user thiếu quyền | Mask/ẩn trường nhạy cảm khi sample có assay confidential | P1 |
| Search/RPC | `SECURITY INVOKER` nhưng phụ thuộc RLS nền rộng | Truy vấn nhanh dữ liệu nhạy cảm | Xiết RLS nền + kiểm tra output search | P1 |
| CoA public auth/download | Có đường admin-bypass + phone-only auth | Lộ dữ liệu qua kênh CoA | Hardening auth + claim scope + check confidential | P1 |
| CoA staff view | Role-based (analyst/manager) | Chưa xét ủy quyền confidential | Bổ sung check quyền confidential trước render | P1 |
| Security tests | Chưa có test HIV confidentiality | Regression không bị phát hiện sớm | Mở rộng `run_security_tests()` với test chuyên biệt | P0 |
| Nghiên cứu/giám sát | Chưa có pipeline ẩn danh | Vi phạm yêu cầu ẩn danh | Tạo RPC/view anonymized + policy export riêng | P2 |
| UI permission flags | UX gate rộng (`canViewResults=true`) | Nhầm lẫn “UI cho thấy” = “được phép” | Đồng bộ UI với enforcement backend, hiển thị trạng thái quyền rõ | P2 |

---

## 4) Lộ trình triển khai chi tiết

## Giai đoạn 1 — Schema + RLS lõi (P0)

1. Tạo migration thêm cột:
   - `assay_definitions.is_confidential`
   - `users.can_access_confidential`
2. Tạo function:
   - `user_can_access_confidential()`
3. Cập nhật policy `results`:
   - SELECT/INSERT/UPDATE có điều kiện confidential.
4. Backfill:
   - Gắn `is_confidential = true` cho các assay HIV hiện có.

**Tiêu chí hoàn thành**: user không quyền không đọc/thao tác result HIV ở mức DB.

## Giai đoạn 2 — Đồng bộ types + actions (P1)

1. Types:
   - Bổ sung `can_access_confidential` vào user schema.
   - Bổ sung `is_confidential` vào assay schema.
2. Server actions:
   - `assay-mutations`: nhận/lưu cờ confidential.
   - `users`: nhận/lưu quyền confidential.
   - `results-approval`: manager duyệt HIV cần quyền confidential.

**Tiêu chí hoàn thành**: app không “mù” metadata quyền/confidential.

## Giai đoạn 3 — PII/API/Search/CoA hardening (P1)

1. Sample detail/API:
   - Ẩn/mask PII khi user thiếu quyền confidential.
2. Search:
   - Rà output `search_results`, `global_search`, `search_clients` theo quyền.
3. CoA:
   - Tăng cường xác thực (không phone-only cho case nhạy cảm).
   - Token scope theo `sample_id`, TTL ngắn.
   - Staff view thêm check confidential.

**Tiêu chí hoàn thành**: không còn lộ thông tin HIV/PII qua API tìm kiếm/CoA.

## Giai đoạn 4 — Dữ liệu ẩn danh cho nghiên cứu (P2)

1. Tạo view/RPC export riêng:
   - Bỏ định danh trực tiếp (name/phone/address/CCCD/BHYT).
   - Pseudonym ổn định bằng hash + salt nội bộ.
   - Generalization + suppression theo `k-anonymity`.
2. Policy export:
   - Chỉ user có quyền export anonymized mới truy cập.
3. Audit bắt buộc:
   - Lưu ai export, khi nào, phạm vi gì, số bản ghi.

**Tiêu chí hoàn thành**: có luồng nghiên cứu tách biệt, không truy cập thẳng dữ liệu vận hành.

---

## 5) Kiến trúc kiểm thử và nghiệm thu

## 5.1. Mở rộng DB security tests

Thêm test vào `run_security_tests()`:

1. Cột `is_confidential` tồn tại.
2. Cột `can_access_confidential` tồn tại.
3. Function `user_can_access_confidential()` tồn tại.
4. Policy `results` có confidential predicate.
5. Negative test: user không quyền -> 0 row HIV.
6. Positive test: user có quyền -> thấy đúng dữ liệu HIV.

## 5.2. Test tích hợp ứng dụng

- Analyst không quyền:
  - Không xem HIV result.
  - Không sửa/duyệt HIV result.
  - Không thấy PII ở sample HIV.
- Analyst/Manager có quyền:
  - Thực hiện workflow đầy đủ.
- CoA:
  - Case HIV theo policy mới (hardened flow).
- Search:
  - Không trả dữ liệu vượt quyền.

---

## 6) Rủi ro chính và biện pháp giảm thiểu

1. **Rủi ro rollout**: bật confidential trước khi cấp quyền.
   - Biện pháp: runbook rollout theo thứ tự (grant trước, enable sau).
2. **Rủi ro hiệu năng policy**:
   - Biện pháp: index phù hợp (`assay_id`, `sample_id`, cờ confidential), function STABLE.
3. **Rủi ro bypass ở admin client endpoints**:
   - Biện pháp: bắt buộc business check quyền confidential ở mọi endpoint bypass.
4. **Rủi ro tái định danh trong data nghiên cứu**:
   - Biện pháp: áp ngưỡng k-anonymity + suppression.

---

## 7) Checklist coverage cuối cùng (Definition of Done)

- [ ] Đã triển khai cột và function confidential ở DB.
- [ ] Đã cập nhật đầy đủ policy `results` cho confidential access.
- [ ] Đã cập nhật types và actions liên quan.
- [ ] Đã khóa PII ở sample/API theo quyền confidential.
- [ ] Đã harden CoA public + staff flows.
- [ ] Đã mở rộng `run_security_tests()` cho HIV confidentiality.
- [ ] Đã có luồng export nghiên cứu ẩn danh tách biệt.
- [ ] Đã chạy typecheck và security tests thành công.

---

## 8) Nguồn đối chiếu nội bộ

- Báo cáo nghiên cứu nội bộ đã lưu:  
  `docs/plans/2026-03-24-hiv-confidentiality-internal-research.md`
- Tài liệu tham chiếu user cung cấp:  
  `/root/implementation_plan.md.resolved`
