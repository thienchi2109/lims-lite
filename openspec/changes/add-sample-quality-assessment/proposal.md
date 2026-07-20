## Why

Luồng tiếp nhận mẫu tại `/analyst/accession` chưa ghi nhận đánh giá chất lượng mẫu tại thời điểm analyst nhận mẫu. Khoảng trống này làm mất một dữ kiện nghiệp vụ cần được lưu và audit cùng hồ sơ mẫu.

## What Changes

- Bổ sung trường `sample_quality` cho mẫu để lưu đánh giá nhị phân `Đạt` hoặc `Không đạt`.
- Không backfill dữ liệu cũ; các mẫu đã tồn tại giữ `sample_quality = NULL` để biểu thị chưa từng được đánh giá theo tính năng này.
- Bắt buộc analyst chọn đúng một trong hai lựa chọn `Đạt` hoặc `Không đạt` trước khi lưu mẫu mới trên cả giao diện desktop và mobile.
- Hiển thị trực tiếp hai lựa chọn bằng Shadcn `Checkbox`, điều khiển theo cơ chế loại trừ lẫn nhau và không chọn mặc định; không dùng dropdown/select như trường `Loại mẫu`.
- Truyền và xác thực `sample_quality` qua cả hai nhánh tiếp nhận: tạo mẫu không có xét nghiệm và tạo mẫu kèm chỉ định xét nghiệm.
- Giữ nguyên workflow khi chọn `Không đạt`: mẫu vẫn được tạo, vẫn có thể được gán xét nghiệm, và không tự động đổi trạng thái, loại bỏ hoặc yêu cầu lý do.
- Ghi nhận giá trị trong audit log hiện có và bảo toàn RLS, kiểm tra vai trò, `SECURITY DEFINER`, `search_path`, revoke/grant của các RPC tiếp nhận mẫu.

## Capabilities

### New Capabilities

Không có.

### Modified Capabilities

- `sample-management`: Bổ sung yêu cầu đánh giá chất lượng bắt buộc cho mẫu mới trong luồng tiếp nhận của analyst, bao gồm lưu trữ, validation và hành vi UI desktop/mobile.

## Impact

- **Database:** Thêm cột nullable vào `public.samples`; cập nhật hai RPC `create_sample_atomic` và `accession_and_assign_tests` bằng migration forward-only mới. Không backfill các mẫu hiện có.
- **Application contracts:** Cập nhật Zod schemas, TypeScript types, Server Actions và client-action payloads cho cả hai nhánh tiếp nhận.
- **UI:** Cập nhật form desktop, bước thông tin mẫu mobile và bước rà soát mobile với nội dung tiếng Việt `Chất lượng mẫu`, `Đạt`, `Không đạt`.
- **Compliance and audit:** Audit trigger hiện tại ghi toàn bộ row JSONB nên phải tiếp tục ghi nhận `sample_quality`; migration phải chứng minh không làm yếu RLS hoặc quyền thực thi RPC.
- **Testing:** Cần regression tests cho lựa chọn loại trừ, validation bắt buộc, payload của hai nhánh, lưu trữ database, audit log và security contracts.
