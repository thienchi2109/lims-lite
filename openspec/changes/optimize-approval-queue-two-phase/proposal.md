## Why

Trang `/manager/approvals?tab=completed` đang chậm dần theo số lượng mẫu đã duyệt vì luồng hiện tại tải toàn bộ danh sách rồi mới phân trang ở client, đồng thời việc đổi mẫu còn có chi phí render/fetch vượt nhu cầu của thao tác xem chi tiết. Điều này tạo cảm giác lag khi thao tác liên tục và làm tăng tải database/app server theo thời gian.

## What Changes

- Triển khai tối ưu theo 2 phase cho Approval Queue:
  - **Phase 1 (Quick Win):** giảm độ trễ tương tác khi đổi mẫu, giảm truy vấn dư thừa ở luồng xem chi tiết, thêm index hỗ trợ sort/filter chính của queue.
  - **Phase 2 (Structural):** chuyển queue sang phân trang server-side thật sự, gom dữ liệu hàng đợi vào RPC chuyên dụng trả về dữ liệu đã tổng hợp theo trang.
- Chuẩn hóa chiến lược TDD cho cả 2 phase (RED → GREEN → REFACTOR) với regression test cho các hành vi hiệu năng quan trọng.
- Chuẩn bị task breakdown theo phạm vi độc lập để dispatch cho nhiều subagents mà không đụng chồng file.
- Giữ nguyên hành vi nghiệp vụ phê duyệt, không thay đổi semantics trạng thái mẫu/kết quả.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `sample-management`: bổ sung yêu cầu hiệu năng cho manager approval queue (không refetch toàn bộ queue khi chỉ đổi mẫu chi tiết, và dùng server-side pagination cho tập dữ liệu lớn).

## Impact

- **Code chính bị ảnh hưởng:**
  - `src/app/(dashboard)/manager/approvals/page.tsx`
  - `src/components/approval-tabs-client.tsx`
  - `src/components/approval-queue-table.tsx`
  - `src/components/approval-bottom-row.tsx`
  - `src/components/approval-mobile-layout.tsx`
  - `src/app/actions/sample-approvals.ts`
  - `src/types/query-keys.ts`
- **Database / migration:**
  - thêm index tối ưu pattern `status + updated_at` (partial trên `deleted_at IS NULL`)
  - thêm RPC read-only phân trang approval queue (Phase 2), `SECURITY INVOKER`, giữ RLS làm lớp kiểm soát cuối.
- **Compliance / audit / RLS:**
  - chỉ thay đổi read path, không thêm mutation mới, không thay đổi audit semantics.
  - migration phải ghi rõ security impact và chạy `run_security_tests()` sau khi apply.
- **Localization:**
  - không đổi copy nghiệp vụ tiếng Việt; chỉ thay đổi kiến trúc fetch/render.
