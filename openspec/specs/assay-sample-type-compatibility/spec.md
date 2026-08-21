# assay-sample-type-compatibility Specification

## Purpose
TBD - created by archiving change add-assay-sample-type-compatibility. Update Purpose after archive.
## Requirements
### Requirement: Loại mẫu có định danh import ổn định

Hệ thống SHALL quản lý loại mẫu dưới dạng master data có UUID, mã `LM-NNNNNN` do PostgreSQL cấp, tên hiển thị tiếng Việt, trạng thái active/xóa mềm và audit timestamps. Mã loại mẫu SHALL duy nhất, bất biến và không được tái sử dụng.

#### Scenario: Tạo loại mẫu mới

- **WHEN** Quản lý tạo một loại mẫu hợp lệ
- **THEN** hệ thống SHALL cấp mã tiếp theo từ sequence
- **AND** client SHALL không thể cung cấp hoặc sửa mã

#### Scenario: Xóa mềm loại mẫu

- **WHEN** Quản lý xóa mềm một loại mẫu đã có mã
- **THEN** mã SHALL được bảo lưu
- **AND** loại mẫu SHALL không xuất hiện trong catalog dùng cho chỉ định mới

#### Scenario: Dữ liệu lịch sử có collision

- **WHEN** migration phát hiện loại mẫu rỗng hoặc nhiều giá trị không thể ánh xạ duy nhất sau chuẩn hóa
- **THEN** migration SHALL abort nguyên transaction
- **AND** hệ thống SHALL không tự gộp hoặc đoán ánh xạ

### Requirement: Compatibility được lưu theo revision bất biến

Hệ thống SHALL lưu mỗi phiên bản catalog dưới dạng snapshot gồm review của từng chỉ tiêu và allowlist cặp chỉ tiêu - loại mẫu. Tối đa một draft SHALL được mở và đúng một revision SHALL là published hiện hành sau khi rollout enforcement hoàn tất.

#### Scenario: Tạo draft từ revision hiện hành

- **WHEN** Quản lý bắt đầu chỉnh catalog
- **THEN** hệ thống SHALL clone revision published hiện hành thành draft mới
- **AND** revision nguồn SHALL không bị thay đổi

#### Scenario: Bootstrap draft đầu tiên

- **WHEN** migration foundation chạy khi chưa có revision published
- **THEN** hệ thống SHALL tạo đúng một revision 1 draft với `source_revision_id = NULL`
- **AND** candidate lịch sử SHALL được gắn vào draft trong cùng transaction
- **AND** audit SHALL xác định actor là hệ thống/migration, không giả mạo manager

#### Scenario: Sửa revision đã publish

- **WHEN** caller cố cập nhật hoặc xóa entry của revision đã publish hoặc superseded
- **THEN** database SHALL từ chối thao tác
- **AND** correction SHALL phải dùng draft/revision mới

### Requirement: Lịch sử chỉ cung cấp candidate có provenance

Hệ thống SHALL cho phép tạo candidate từ các cặp loại mẫu - chỉ tiêu đã quan sát trong dữ liệu lịch sử nhưng SHALL không coi candidate là compatible trước khi Quản lý review.

#### Scenario: Seed catalog ban đầu

- **WHEN** migration foundation tổng hợp các cặp lịch sử
- **THEN** mỗi candidate SHALL ghi provenance `historical_observation`
- **AND** candidate SHALL không được resolver chấp nhận khi chưa được review

#### Scenario: Không có dữ liệu lịch sử

- **WHEN** một chỉ tiêu active chưa từng xuất hiện với loại mẫu nào
- **THEN** hệ thống SHALL không tự tạo allowlist
- **AND** Quản lý SHALL phải cấu hình hoặc đánh dấu không thể chỉ định

### Requirement: Publish yêu cầu coverage đầy đủ và có audit

Trưởng khoa/phụ trách chuyên môn, được hệ thống biểu diễn bằng role `manager`, SHALL là chủ sở hữu nghiệp vụ của quyết định compatibility. Mỗi chỉ tiêu active SHALL có disposition `configured` với ít nhất một loại mẫu active hoặc `not_assignable` với lý do trước khi publish. Publish SHALL yêu cầu review confirmation, ghi actor, thời điểm, lý do, content hash và diff audit trong cùng transaction; cùng một manager MAY lập và publish trong MVP.

#### Scenario: Publish catalog hoàn chỉnh

- **WHEN** Quản lý publish draft có coverage đầy đủ
- **THEN** draft SHALL trở thành revision published hiện hành
- **AND** revision cũ SHALL trở thành superseded
- **AND** toàn bộ thay đổi trạng thái/audit SHALL commit nguyên tử

#### Scenario: Publish catalog thiếu coverage

- **WHEN** draft còn chỉ tiêu active chưa review, configured không có pair hoặc not-assignable thiếu lý do
- **THEN** publish SHALL thất bại
- **AND** revision hiện hành SHALL giữ nguyên

#### Scenario: Analyst cố sửa catalog

- **WHEN** Analyst hoặc role không hợp lệ gọi mutation/publish
- **THEN** hệ thống SHALL từ chối theo auth/RLS
- **AND** không có revision hoặc audit giả được tạo

#### Scenario: Manager tự publish draft đã review

- **WHEN** cùng một manager đã lập draft xác nhận diff, nhập lý do và publish
- **THEN** hệ thống SHALL cho phép theo contract MVP
- **AND** audit SHALL lưu cùng actor ở preparation/review/publication thay vì che giấu việc không có maker-checker

### Requirement: Resolver compatibility luôn fail-closed

Resolver SHALL chỉ chấp nhận một cặp khi có revision published hiện hành, hai entity active, review `configured`, allowlist pair tồn tại và `compatibility_generation` của cả chỉ tiêu lẫn loại mẫu còn khớp snapshot. Mọi trạng thái thiếu, không xác định hoặc stale SHALL bị từ chối bằng error code ổn định.

#### Scenario: Cặp tương thích hợp lệ

- **WHEN** caller resolve một loại mẫu active và chỉ tiêu active có pair đã publish, fingerprint còn khớp
- **THEN** resolver SHALL trả thành công
- **AND** kết quả SHALL chứa revision number đã dùng

#### Scenario: Pair bị thiếu

- **WHEN** review hoặc allowlist pair không tồn tại
- **THEN** resolver SHALL từ chối
- **AND** hệ thống SHALL không mặc định tương thích

#### Scenario: Method thay đổi sau publish

- **WHEN** `method_name` của chỉ tiêu khác fingerprint trong revision published
- **THEN** mọi pair của chỉ tiêu đó SHALL được coi là stale
- **AND** chỉ revision mới đã review SHALL cho phép chỉ định lại

#### Scenario: Loại mẫu đổi tên hoặc được khôi phục

- **WHEN** loại mẫu đổi tên chuẩn hóa, bị retire hoặc được restore sau publication
- **THEN** database SHALL tăng compatibility generation
- **AND** mọi pair cũ của loại mẫu SHALL stale cho đến revision mới

#### Scenario: Chỉ tiêu được khôi phục

- **WHEN** chỉ tiêu bị retire rồi restore dù import code và method không đổi
- **THEN** database SHALL tăng compatibility generation
- **AND** pair lịch sử SHALL không tự kích hoạt lại

#### Scenario: Entity không còn active

- **WHEN** loại mẫu hoặc chỉ tiêu đã xóa mềm
- **THEN** resolver SHALL từ chối dù pair còn trong snapshot lịch sử

### Requirement: Consumer có thể khóa theo revision dự kiến

Resolver/read contract SHALL công bố revision number hiện hành và hỗ trợ `expected_revision_number`. Nếu caller cung cấp revision, hệ thống SHALL không tự nâng sang revision mới.

#### Scenario: Revision dự kiến còn hiện hành

- **WHEN** caller gửi revision đúng với revision published hiện hành
- **THEN** resolver SHALL đánh giá pair theo revision đó

#### Scenario: Revision dự kiến đã stale

- **WHEN** caller gửi revision khác revision published hiện hành
- **THEN** resolver SHALL từ chối với lỗi stale-catalog
- **AND** caller SHALL phải tải lại catalog thay vì tự diễn giải

### Requirement: Catalog đọc phục vụ UI và template không làm lộ draft

Analyst SHALL chỉ đọc được revision published và các pair hợp lệ cần cho luồng chỉ định. Quản lý SHALL đọc được coverage, candidate, draft diff và lịch sử revision theo RPC có quyền.

#### Scenario: Analyst tải catalog

- **WHEN** Analyst tải danh sách chỉ tiêu cho một loại mẫu
- **THEN** hệ thống SHALL chỉ trả chỉ tiêu active có pair published không stale
- **AND** response SHALL chứa mã loại mẫu, mã chỉ tiêu và revision number

#### Scenario: Analyst cố đọc draft

- **WHEN** Analyst truy vấn draft hoặc review notes
- **THEN** RLS/RPC SHALL từ chối hoặc không trả dữ liệu

### Requirement: Mọi mutation catalog có audit bất biến

Create/update/soft-delete loại mẫu, thay đổi draft và publish SHALL được ghi vào `audit_logs` với actor thực, entity/revision, before/after và lý do khi áp dụng.

#### Scenario: Quản lý thay đổi draft

- **WHEN** Quản lý thêm hoặc bỏ một compatibility pair
- **THEN** audit SHALL ghi đúng actor và before/after
- **AND** thay đổi SHALL chỉ tác động draft

#### Scenario: Mutation và audit không thể tách rời

- **WHEN** ghi audit thất bại
- **THEN** mutation catalog SHALL rollback nguyên transaction

