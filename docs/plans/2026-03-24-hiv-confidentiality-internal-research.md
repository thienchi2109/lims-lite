# Thiết kế kiểm soát bảo mật dữ liệu HIV/AIDS cho CDC-LIMS (dựa trên mã nguồn nội bộ)

## 1) Phạm vi và nguồn dữ liệu nghiên cứu

- Báo cáo này **chỉ dùng nguồn nội bộ** theo yêu cầu (“ngưng web research”).
- Cơ sở pháp lý nghiệp vụ được lấy từ mô tả bạn cung cấp và file tham chiếu `implementation_plan.md.resolved` (nêu rõ: kết quả xét nghiệm HIV là bí mật y tế; chỉ người được ủy quyền truy cập; dữ liệu nghiên cứu/giám sát phải ẩn danh). [1]

---

## 2) Kết luận nhanh (Executive Summary)

Hiện trạng hệ thống đang dùng RBAC theo vai trò (`analyst`/`manager`) nhưng **chưa có lớp “ủy quyền dữ liệu HIV”**. Kết quả:

- `results` hiện đọc được bởi mọi user đã đăng nhập (`auth.uid() IS NOT NULL`). [2][3]
- `samples` và `clients` cũng đang có policy đọc rộng cho user đã đăng nhập. [2][4]
- Tầng search (`search_results`, `global_search`) là `SECURITY INVOKER`; khi RLS nền đang rộng thì dữ liệu nhạy cảm vẫn bị lộ theo quyền hiện có. [5]
- CoA public flow dùng xác thực bằng số điện thoại + token và truy cập qua admin client (bypass RLS), nên cần hardening riêng cho trường hợp HIV. [6][7]
- Chưa thấy pipeline ẩn danh/pseudonym hóa cho mục đích nghiên cứu/giám sát dịch tễ. [8]

=> Cần bổ sung ngay mô hình “**phân loại xét nghiệm + ủy quyền truy cập dữ liệu bảo mật**”, khóa ở tầng DB/RLS trước, rồi cập nhật app layer và kiểm thử bảo mật.

---

## 3) Phân tích hiện trạng (Gap Analysis)

### 3.1. RLS hiện tại chưa chặn dữ liệu HIV

- Policy đọc `results` hiện là:
  - `CREATE POLICY "Authenticated users can read results" ... USING ((select auth.uid()) IS NOT NULL)` trong migration tối ưu RLS. [2]
  - Bản nền cũ cũng cùng logic “all authenticated users can read results”. [3]
- `samples` cũng cho đọc rộng toàn bộ user đã đăng nhập. [2][3]
- `clients` cũng cho đọc rộng toàn bộ user đã đăng nhập. [2][4]

**Hệ quả**: chưa phân biệt “xét nghiệm HIV/bảo mật” với xét nghiệm thường ở tầng dữ liệu.

### 3.2. App/API hiện phản ánh đúng RLS nhưng chưa có “ủy quyền HIV”

- `getResultsBySample()` truy vấn trực tiếp bảng `results` và join assay/method/sample. Nếu RLS cho qua thì dữ liệu trả ra đầy đủ. [9]
- `getSample()` và `/api/samples/[id]` trả cả PII client (DOB, giới tính, phone, address, BHYT...) khi query thành công. [10][11]
- UI trang samples đang set `canViewResults: true` cho cả analyst và manager (UX gate), không phải kiểm soát pháp lý. [12]

### 3.3. Search/reporting là điểm khuếch đại rò rỉ nếu RLS nền rộng

- Các hàm `search_*` và `global_search` khai báo `SECURITY INVOKER` (đúng kỹ thuật), nhưng mô tả access là “All authenticated users (RLS enforced)”. [5]
- Khi RLS `results/clients/samples` đang rộng, search có thể giúp truy vấn nhanh dữ liệu nhạy cảm.

### 3.4. CoA có bề mặt rủi ro riêng

- `/api/coa/authenticate` dùng `createAdminClient()` và xác thực bằng **phone** để lấy danh sách mẫu completed cho client. [6]
- `/api/coa/download` dùng `createAdminClient()` + token `client_id` để tải CoA. [7]
- Staff view `/api/coa/view` cho analyst/manager xem CoA nếu có session hợp lệ. [13]
- Policy storage CoA hiện cho staff (`analyst`,`manager`) đọc file trong bucket riêng. [14]

**Nhận xét**: với HIV, CoA cần xác thực mạnh hơn phone-only và phải tích hợp quy tắc “chỉ người được ủy quyền” đối với nhân sự nội bộ.

### 3.5. Security tests hiện có nhưng chưa test logic HIV confidentiality

- `run_security_tests()` hiện tập trung vào số lượng policy, role check tổng quát, orphan policy, RLS coverage. [15][16]
- Chưa có test nào xác nhận “user không có quyền thì không đọc được HIV result”.

### 3.6. Chưa có luồng dữ liệu ẩn danh cho nghiên cứu/giám sát dịch tễ

- Không tìm thấy artifact migration/code dành cho anonymization/pseudonymization/export dịch tễ trong repo (ngoài các nội dung không liên quan QC notes). [8]

---

## 4) Thiết kế mục tiêu đề xuất

## 4.1. Mô hình dữ liệu & ủy quyền

### Pha MVP (ít thay đổi, triển khai nhanh)

1. **Phân loại xét nghiệm bảo mật**
   - Thêm `assay_definitions.is_confidential BOOLEAN NOT NULL DEFAULT FALSE`.
2. **Cờ ủy quyền theo user**
   - Thêm `users.can_access_confidential BOOLEAN NOT NULL DEFAULT FALSE`.
3. **Hàm kiểm tra quyền**
   - `user_can_access_confidential()` (SECURITY DEFINER, STABLE) trả bool theo user hiện tại.

> Hướng này khớp với định hướng trong `implementation_plan.md.resolved` (migrations 123/124/125). [1]

### Pha mở rộng (khuyến nghị cho vận hành thực tế)

4. Tách quyền theo mục đích:
   - `users.can_access_hiv_confidential`
   - `users.can_export_hiv_anonymized`
5. (Tùy chọn) bảng grant theo danh mục:
   - `confidential_access_grants(user_id, domain, granted_by, granted_at, revoked_at, reason)`

Mục tiêu: đáp ứng “nhân viên được ủy quyền” có chứng cứ cấp quyền/thu hồi theo thời gian.

## 4.2. Thiết kế RLS bắt buộc

### A. `results` (bắt buộc khóa chặt)

- SELECT: chỉ thấy row khi:
  - assay không confidential **hoặc**
  - user có `can_access_confidential = true`.
- INSERT/UPDATE: nếu row thuộc assay confidential thì người thao tác cũng phải có quyền confidential (kể cả manager, theo nguyên tắc “ủy quyền rõ ràng”).

### B. `samples` và `clients` (giảm suy diễn HIV)

Tối thiểu nên làm:

- Không trả PII client trong API chi tiết sample nếu sample có assay confidential và user không có quyền.
- Mask trường nhạy cảm (`name/phone/address`) hoặc trả `null`.

Khuyến nghị DB-first:

- Dùng view/RPC “safe projection” cho list/detail thay vì query thẳng bảng khi role không có quyền confidential.
- Giữ RLS bảng lõi đủ chặt, app chỉ đọc từ projection đã làm sạch dữ liệu.

## 4.3. Hardening CoA cho HIV

1. Public authenticate không nên chỉ dựa phone:
   - Nâng lên tối thiểu 2 yếu tố: phone + DOB/ID fragment/OTP.
2. Token CoA nên mang claim mục đích + sample scope + thời hạn ngắn.
3. Nếu sample chứa assay confidential (HIV), áp chính sách:
   - hoặc chặn CoA public hoàn toàn,
   - hoặc yêu cầu xác thực mạnh hơn và log truy cập mức cao.
4. Nội bộ staff view CoA phải đi qua check confidential permission.

## 4.4. Ẩn danh cho nghiên cứu/giám sát dịch tễ

Thiết kế chuẩn:

- Tạo dataset/view chuyên dụng (không cho query bảng nghiệp vụ trực tiếp).
- Loại bỏ định danh trực tiếp: tên, số ĐT, địa chỉ, CCCD/BHYT.
- Pseudonym ổn định bằng hash có salt nội bộ (không lưu salt trong output).
- Generalization: tuổi theo nhóm, địa lý mức quận/huyện, thời gian theo tuần/tháng.
- Ngưỡng `k-anonymity` tối thiểu (vd `k>=5`), nhóm không đạt ngưỡng phải suppress.
- Chỉ user có `can_export_hiv_anonymized` mới chạy RPC export.

---

## 5) Kế hoạch triển khai đề xuất (không phá hệ thống)

### Giai đoạn 1 — Schema + RLS lõi

1. Migration A:
   - thêm `is_confidential`, `can_access_confidential`, function `user_can_access_confidential()`.
2. Migration B:
   - cập nhật policy `results` SELECT/INSERT/UPDATE theo confidential logic.
3. Backfill:
   - gắn `is_confidential=true` cho assay HIV đã seed trong hệ thống. [17]

### Giai đoạn 2 — App layer an toàn

4. Cập nhật type schemas:
   - `src/types/core.ts` thêm `can_access_confidential` cho user schema. [18]
   - `src/types/lab.ts` thêm `is_confidential` cho assay schema. [19]
5. Cập nhật actions:
   - `assay-mutations.ts` nhận/lưu `is_confidential`. [20]
   - `users.ts` nhận/lưu `can_access_confidential`. [21]
   - `results-approval.ts`: manager duyệt kết quả confidential phải có quyền confidential.

### Giai đoạn 3 — PII/API/Search/CoA hardening

6. `getSample` + `/api/samples/[id]`: không trả PII nếu user thiếu quyền confidential và sample chứa assay confidential. [10][11]
7. Search:
   - rà lại `search_results`/`global_search` để đảm bảo output không lộ tín hiệu HIV cho user không quyền. [5]
8. CoA:
   - harden auth (không phone-only) và áp confidential checks cho nội bộ/public flow. [6][7][13]

### Giai đoạn 4 — Anonymized research export

9. Tạo RPC/view xuất dữ liệu ẩn danh + policy riêng theo mục đích nghiên cứu.
10. Audit bắt buộc cho mọi lần export: ai, khi nào, bộ lọc nào, số bản ghi.

---

## 6) Kế hoạch kiểm thử & xác nhận tuân thủ

## 6.1. Security tests DB (mở rộng `run_security_tests`)

Thêm test mới:

1. Tồn tại cột `assay_definitions.is_confidential`.
2. Tồn tại cột `users.can_access_confidential`.
3. Tồn tại function `user_can_access_confidential()`.
4. Policy `results` SELECT chứa điều kiện confidential.
5. Negative test:
   - user không quyền: query result HIV = 0 row.
6. Positive test:
   - user có quyền: query result HIV = có row.

Nền test hiện có đã sẵn framework để mở rộng. [15][16]

## 6.2. Kiểm thử ứng dụng

- Analyst không quyền:
  - Không xem được result HIV.
  - Không duyệt/nhập HIV result.
  - Không thấy PII gắn sample HIV.
- Analyst/Manager có quyền:
  - Workflow bình thường.
- CoA:
  - sample HIV phải theo policy mới (chặn hoặc xác thực tăng cường).
- Search:
  - không trả dữ liệu HIV cho user không quyền.

---

## 7) Rủi ro và biện pháp giảm thiểu

1. **Rủi ro vận hành**: cấp cờ confidential trước khi cấp user quyền => người dùng “mất dữ liệu”.
   - Giảm thiểu: runbook theo thứ tự (grant quyền trước, sau đó bật confidential).
2. **Rủi ro hiệu năng RLS**:
   - thêm index theo `assay_id`, `sample_id`, cờ confidential; dùng function `STABLE`.
3. **Rủi ro bypass ở endpoint admin client**:
   - bắt buộc check nghiệp vụ riêng cho confidential ở mỗi endpoint admin-bypass.
4. **Rủi ro re-identification trong research dataset**:
   - áp generalization + suppression + ngưỡng k-anonymity.

---

## 8) Ưu tiên thực thi khuyến nghị

1. **Ưu tiên P0**: migration schema + RLS `results` confidential.
2. **Ưu tiên P1**: update actions/types và approval guard.
3. **Ưu tiên P1**: khóa PII ở sample detail + search output.
4. **Ưu tiên P2**: CoA hardening cho case HIV.
5. **Ưu tiên P2**: pipeline ẩn danh cho nghiên cứu/giám sát.

---

## 9) Đối chiếu với tài liệu tham chiếu bạn gửi

Thiết kế đề xuất ở trên **tương thích** với `implementation_plan.md.resolved`:

- Giữ mô hình `is_confidential` (assay) + `can_access_confidential` (user) + helper function + update RLS + thêm security tests. [1]
- Bổ sung thêm phần còn thiếu trong file tham chiếu:
  - kiểm soát PII/sample detail,
  - hardening CoA public flow,
  - pipeline ẩn danh cho nghiên cứu/giám sát.

---

## Trích dẫn

[1] `/root/implementation_plan.md.resolved` (đặc biệt dòng 5-11, 105-147, 152-175, 187-207)  
[2] `supabase/migrations/048_optimize_rls_policies.sql` (dòng 25-30, 136-139, 169-172)  
[3] `supabase/migrations/003_rls_policies.sql` (dòng 87-90, 110-113)  
[4] `supabase/migrations/039_add_clients_table.sql` (dòng 90-97) + `053_allow_analysts_update_clients.sql` (dòng 11-19)  
[5] `supabase/migrations/075_create_search_functions.sql` (dòng 3, 27, 69, 147, 231; mô tả access ở 12, 56, 133, 219)  
[6] `src/app/api/coa/authenticate/route.ts` (dòng 48-50, 98-103, 129-141, 173-177)  
[7] `src/app/api/coa/download/route.ts` (dòng 40-42, 121-127, 146-162, 172-181, 201-205)  
[8] Tìm kiếm nội bộ không thấy artifact anonymization/pseudonymization chuyên biệt: glob `src/**/*{anonym,anonymized,pseudonym,epidemi,research}*.{ts,tsx,sql,md}` -> no match; rà migrations chỉ thấy mục không liên quan confidentiality HIV  
[9] `src/app/actions/results.ts` (dòng 20-58)  
[10] `src/app/actions/samples.ts` (dòng 153-175, 163-171)  
[11] `src/app/api/samples/[id]/route.ts` (dòng 17-25)  
[12] `src/app/(dashboard)/samples/page.tsx` (dòng 58-64)  
[13] `src/app/api/coa/view/route.ts` (dòng 35-53, 67-74, 89-112)  
[14] `supabase/migrations/055_add_coa_tables_and_triggers.sql` (dòng 121-127) + `056_create_coa_storage_bucket.sql` (dòng 54-60)  
[15] `supabase/migrations/026_security_verification_tests.sql` (dòng 11-31, 33-58, 169-214)  
[16] `supabase/migrations/028_fix_security_verification_tests.sql` (dòng 10-37, 45-83)  
[17] `supabase/migrations/050_seed_new_assays_specialties.sql` (dòng 261-273, 497-499) + `051_fix_encoding_seed.sql` (dòng 273-285, 509-511)  
[18] `src/types/core.ts` (dòng 35-74)  
[19] `src/types/lab.ts` (dòng 82-103)  
[20] `src/app/actions/assay-mutations.ts` (dòng 30-38, 50-57, 103-111, 123-130)  
[21] `src/app/actions/users.ts` (dòng 166-177, 210-216)  
