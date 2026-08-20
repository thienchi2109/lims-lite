## Why

Luồng tiếp nhận mẫu hàng loạt bằng Excel cần một mã chỉ tiêu ổn định, dễ nhập và không thay đổi khi tên, chuyên khoa, phương pháp hoặc trạng thái hoạt động của chỉ tiêu thay đổi. Dữ liệu hiện tại có các chỉ tiêu trùng về mặt ngữ nghĩa, nên tên hiển thị hoặc mã tự suy diễn không đủ an toàn để liên kết chỉ định xét nghiệm.

## What Changes

- Bổ sung `assay_definitions.import_code` làm mã nghiệp vụ bắt buộc, duy nhất, bất biến và không bao giờ được tái sử dụng.
- PostgreSQL tự cấp mã từ một sequence toàn cục, đơn điệu, theo định dạng `CT-000001`; khoảng trống sequence được chấp nhận.
- Backfill mã cho cả chỉ tiêu đang hoạt động và đã xóa mềm theo thứ tự xác định `created_at`, sau đó UUID.
- Ngăn mọi thao tác cập nhật `import_code` ở tầng cơ sở dữ liệu; thao tác tạo chỉ tiêu trả về mã nhưng không nhận mã từ người dùng.
- Mở rộng các hợp đồng đọc, danh sách và tìm kiếm chỉ tiêu để trả về mã; giao diện quản lý chỉ hiển thị mã ở trạng thái chỉ đọc.
- Giữ nguyên UUID làm khóa nội bộ, cơ chế xóa mềm, RLS, phân quyền quản lý và audit hiện có.
- Không triển khai parser Excel, resolver mã chỉ tiêu cho import, tương thích mẫu - chỉ tiêu hoặc thay đổi mô hình phương pháp trong change này.

## Capabilities

### New Capabilities

Không có.

### Modified Capabilities

- `assay-management`: Bổ sung vòng đời mã import do hệ thống cấp cho mỗi chỉ tiêu, gồm định dạng, backfill, tính duy nhất, bất biến, bảo lưu khi xóa mềm và khả năng hiển thị qua các hợp đồng đọc.

## Impact

- Cơ sở dữ liệu: `assay_definitions`, sequence cấp mã, trigger hoặc hàm bảo vệ tính bất biến, các RPC đọc/tạo chỉ tiêu và kiểm thử SQL liên quan.
- Ứng dụng: schema/type Zod cho chỉ tiêu, server actions và API client quản lý chỉ tiêu, trang và hộp thoại quản lý chỉ tiêu.
- Tuân thủ: migration phải là forward-only, nêu rõ tác động bảo mật, giữ nguyên `SECURITY DEFINER`, `search_path`, grant/revoke và RLS; mọi kiểm thử `run_security_tests()` phải đạt.
- Audit: mã được ghi nhận cùng bản ghi chỉ tiêu khi tạo/backfill và không thể thay đổi về sau; change không tạo cơ chế sửa lịch sử.
- Bản địa hóa: nhãn và nội dung giao diện mới phải dùng tiếng Việt có dấu, thống nhất thuật ngữ `Mã chỉ tiêu` trong `CONTEXT.md`.
- Phối hợp: không thay đổi `method_id`, `method_name`, `methods` hoặc `assay_methods`; khi triển khai phải điều phối với các change đang hoạt động `add-assay-method-m2m` và `remove-legacy-method-catalog-dependency`.

## Wayfinder Traceability

- Map: https://github.com/thienchi2109/lims-lite/issues/107
- Source decision: https://github.com/thienchi2109/lims-lite/issues/109
- Decision status: Resolved
- Promoted on: 2026-08-20
