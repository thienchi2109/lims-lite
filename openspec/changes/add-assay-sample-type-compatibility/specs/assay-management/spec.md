## ADDED Requirements

### Requirement: Quản lý xem được coverage compatibility của chỉ tiêu

Trang quản lý chỉ tiêu SHALL cung cấp workspace tiếng Việt hiển thị mã chỉ tiêu, method, trạng thái review, stale/candidate và số loại mẫu tương thích cho mỗi chỉ tiêu, với filter theo nhóm xét nghiệm và trạng thái coverage.

#### Scenario: Mở workspace compatibility

- **WHEN** Quản lý mở `/manager/assays/compatibility`
- **THEN** hệ thống SHALL hiển thị coverage của revision published và draft hiện tại
- **AND** mỗi trạng thái SHALL có nhãn tiếng Việt rõ ràng

#### Scenario: Người dùng không phải Quản lý truy cập

- **WHEN** Analyst hoặc user không hợp lệ mở workspace hoặc gọi query quản lý
- **THEN** hệ thống SHALL từ chối truy cập
- **AND** draft, review note và lịch sử diff SHALL không bị lộ

### Requirement: Quản lý review và publish compatibility theo chỉ tiêu

Workspace SHALL cho phép Quản lý accept/reject candidate, chọn loại mẫu compatible, đánh dấu chỉ tiêu không thể chỉ định kèm lý do, xem diff và publish draft với lý do bắt buộc.

#### Scenario: Cấu hình chỉ tiêu có loại mẫu tương thích

- **WHEN** Quản lý chọn một hoặc nhiều loại mẫu active cho chỉ tiêu trong draft
- **THEN** review SHALL chuyển sang `configured`
- **AND** draft SHALL lưu pair cùng provenance/actor

#### Scenario: Đánh dấu chỉ tiêu không thể chỉ định

- **WHEN** Quản lý chọn trạng thái không thể chỉ định
- **THEN** UI SHALL yêu cầu lý do
- **AND** draft SHALL không giữ allowlist pair cho chỉ tiêu đó

#### Scenario: Publish từ giao diện

- **WHEN** Quản lý xác nhận diff và nhập lý do publish
- **THEN** UI SHALL gọi mutation publish manager-only
- **AND** danh sách SHALL refresh sang revision mới mà không cần reload trình duyệt

### Requirement: Thay đổi method làm coverage của chỉ tiêu stale

Hệ thống SHALL snapshot `compatibility_generation` do database quản lý. Generation SHALL tăng khi `method_name` hoặc trạng thái xóa mềm thay đổi; rename assay, units và normal range SHALL không tự làm stale.

#### Scenario: Quản lý sửa method

- **WHEN** Quản lý thay đổi `method_name` của chỉ tiêu đã có pair published
- **THEN** workspace SHALL đánh dấu chỉ tiêu stale
- **AND** chỉ tiêu SHALL không còn được resolver trả cho đến khi publish revision mới

#### Scenario: Quản lý chỉ sửa tên hiển thị

- **WHEN** Quản lý đổi tên chỉ tiêu nhưng giữ nguyên import code và method
- **THEN** compatibility SHALL tiếp tục hợp lệ
- **AND** UI SHALL hiển thị tên mới cùng revision hiện hành

### Requirement: Vòng đời chỉ tiêu giữ ranh giới fail-closed

Chỉ tiêu mới, đã xóa mềm hoặc được khôi phục SHALL không tự nhận compatibility từ chỉ tiêu khác hoặc revision cũ.

#### Scenario: Tạo chỉ tiêu mới

- **WHEN** Quản lý tạo chỉ tiêu mới
- **THEN** coverage SHALL bắt đầu ở trạng thái chưa review
- **AND** chỉ tiêu SHALL chưa thể được gán cho mẫu

#### Scenario: Xóa mềm chỉ tiêu

- **WHEN** Quản lý xóa mềm chỉ tiêu
- **THEN** resolver SHALL ngừng trả chỉ tiêu đó
- **AND** snapshot/audit lịch sử SHALL được giữ nguyên

#### Scenario: Khôi phục chỉ tiêu

- **WHEN** một chỉ tiêu đã xóa mềm được khôi phục
- **THEN** database SHALL tăng compatibility generation
- **AND** hệ thống SHALL yêu cầu review trong revision mới
- **AND** pair lịch sử SHALL không tự kích hoạt lại
