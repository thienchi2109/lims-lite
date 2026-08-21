# assay-management Specification

## Purpose
TBD - created by archiving change fix-assays-auto-refresh. Update Purpose after archive.
## Requirements
### Requirement: Auto-refresh assays list after mutation

The system SHALL refresh the manager assays list after a successful create, update, or delete of an assay definition so that the UI reflects the latest server state without manual browser reload.

#### Scenario: Manager updates an assay definition

**GIVEN** an authenticated user with manager role on `/manager/assays`  
**WHEN** the user saves changes in the assay edit dialog  
**THEN** the system SHALL:
- Revalidate server data for `/manager/assays`
- Refresh the route client-side so the table shows updated assay fields (name, specialty, units, rules)
- Preserve current filters and pagination

#### Scenario: Manager creates a new assay definition

**GIVEN** an authenticated user with manager role on `/manager/assays`  
**WHEN** the user submits the create assay dialog successfully  
**THEN** the system SHALL:
- Refresh the assays list to include the new assay
- Respect current specialty filter/search/pagination
- Require no manual browser refresh

#### Scenario: Manager deletes an assay definition

**GIVEN** an authenticated user with manager role on `/manager/assays`  
**WHEN** the user confirms deletion of an assay definition  
**THEN** the system SHALL refresh the assays list so the deleted assay no longer appears.

### Requirement: Manager can save free-form assay method text

The system SHALL allow a manager to create and update an assay definition with a `Phương pháp` value entered as free-form text, without requiring the value to exist in the `methods` catalog or an `assay_methods` relationship.

#### Scenario: Manager creates assay with custom method

- **GIVEN** an authenticated manager is creating a new assay definition
- **WHEN** the manager enters a method name in the create dialog that does not exist in the method catalog and saves the assay
- **THEN** the system SHALL store the typed method text on the assay definition
- **AND** the system SHALL refresh the manager assay list without requiring a catalog method record

#### Scenario: Manager creates assay without required method select

- **GIVEN** an authenticated manager opens the create dialog for a new assay
- **WHEN** the dialog renders assay fields
- **THEN** the system SHALL show a free-form `Phương pháp` text field instead of a required catalog method select
- **AND** the system SHALL save the typed text as the assay's initial method value

#### Scenario: Manager updates method text

- **GIVEN** an authenticated manager is editing an existing assay definition
- **WHEN** the manager changes the `Phương pháp` text and saves
- **THEN** the system SHALL persist the new method text for that assay definition
- **AND** the system SHALL show the updated method text in the assay list and detail view

#### Scenario: Manager edits assay without catalog method controls

- **GIVEN** an authenticated manager opens the edit dialog for an assay
- **WHEN** the dialog renders editable assay fields
- **THEN** the system SHALL show a free-form `Phương pháp` text field
- **AND** the system SHALL NOT show catalog-bound method add, remove, set-default, or required select controls for the new assay management workflow

#### Scenario: Non-manager cannot change method text

- **GIVEN** an authenticated user without manager role attempts to create or update assay method text
- **WHEN** the request reaches the server action or database policy boundary
- **THEN** the system SHALL reject the mutation using the existing manager-only authorization model

### Requirement: Method suggestions do not constrain assay method entry

The system SHALL provide method name suggestions as an input convenience only, and saving SHALL depend on the text value rather than a selected method identifier.

#### Scenario: Manager chooses a suggested method

- **GIVEN** method name suggestions are available from existing assay method text or legacy method catalog names
- **WHEN** the manager selects a suggestion
- **THEN** the system SHALL populate the `Phương pháp` text input with that suggestion
- **AND** the saved assay definition SHALL store the method name text without requiring a `method_id`

#### Scenario: Manager ignores suggestions

- **GIVEN** the manager is entering `Phương pháp`
- **WHEN** the manager types a new method name and saves without selecting a suggestion
- **THEN** the system SHALL accept and persist the typed method text

### Requirement: Manager can view assay details from the assay table

The system SHALL provide an action on each manager assay table row to open a read-only detail dialog for that assay.

#### Scenario: Manager opens assay detail

- **GIVEN** an authenticated manager is viewing `/manager/assays`
- **WHEN** the manager activates the `Xem chi tiết` action for an assay row
- **THEN** the system SHALL open a modal showing the assay name, specialty, method text, units, confidentiality flag, validation rules, timestamps when available, and method-related display data supported by the current schema
- **AND** the modal SHALL not submit mutations while in detail mode

#### Scenario: Assay dialogs share field structure

- **GIVEN** the assay create, edit, and detail dialogs are rendered
- **WHEN** they show assay fields such as name, specialty, method text, units, confidentiality, and validation rules
- **THEN** the system SHALL render those fields through a shared form/detail component
- **AND** the system SHALL switch behavior by mode rather than duplicating create, edit, or detail field markup

### Requirement: Assay method text remains visible in downstream assay usage

The system SHALL surface the assay method text in assignment/result display paths that previously depended on catalog method names for newly created assay data.

#### Scenario: New assay is used in test assignment

- **GIVEN** an assay definition has method text and no required catalog method identifier
- **WHEN** the assay is assigned to a sample or displayed in result-oriented UI
- **THEN** the system SHALL display the assay method text without failing on a missing `method_id`

### Requirement: Hệ thống cấp mã import ổn định cho chỉ tiêu

Hệ thống SHALL duy trì `import_code` cho mỗi chỉ tiêu dưới dạng `CT-` theo sau bởi đúng sáu chữ số. Mã SHALL do PostgreSQL cấp từ một sequence toàn cục, SHALL là duy nhất, SHALL không được tái sử dụng và SHALL không thay thế UUID làm khóa nội bộ.

#### Scenario: Quản lý tạo chỉ tiêu mới

- **GIVEN** một quản lý đã xác thực gửi dữ liệu tạo chỉ tiêu hợp lệ mà không có `import_code`
- **WHEN** hệ thống tạo chỉ tiêu
- **THEN** PostgreSQL SHALL cấp mã tiếp theo theo định dạng `CT-NNNNNN`
- **AND** phản hồi tạo SHALL trả về mã đã cấp

#### Scenario: Client cố gửi mã khi tạo chỉ tiêu

- **GIVEN** một client gửi thêm `import_code` trong yêu cầu tạo chỉ tiêu
- **WHEN** hệ thống xác thực yêu cầu
- **THEN** hệ thống SHALL không dùng giá trị do client cung cấp để cấp mã
- **AND** mã lưu trong cơ sở dữ liệu SHALL chỉ do PostgreSQL tạo

#### Scenario: Sequence đã hết miền sáu chữ số

- **GIVEN** sequence đã đạt giá trị `999999`
- **WHEN** hệ thống cố tạo thêm chỉ tiêu
- **THEN** thao tác SHALL thất bại
- **AND** hệ thống SHALL không tạo mã sai định dạng hoặc tái sử dụng mã cũ

### Requirement: Mọi chỉ tiêu lịch sử có mã xác định

Migration SHALL cấp đúng một mã cho mọi bản ghi `assay_definitions` hiện có, bao gồm chỉ tiêu đang hoạt động và đã xóa mềm, theo thứ tự `created_at` rồi `id`. Sau backfill, `import_code` SHALL là `NOT NULL`, đúng định dạng và duy nhất.

#### Scenario: Backfill dữ liệu hiện có

- **GIVEN** cơ sở dữ liệu có chỉ tiêu đang hoạt động và chỉ tiêu đã xóa mềm chưa có mã
- **WHEN** migration được áp dụng
- **THEN** mọi chỉ tiêu SHALL nhận đúng một mã
- **AND** thứ tự cấp mã SHALL được xác định bởi `created_at`, sau đó UUID
- **AND** sequence SHALL tiếp tục sau mã lớn nhất đã backfill

#### Scenario: Baseline hoặc hậu điều kiện không hợp lệ

- **GIVEN** trạng thái schema không đúng baseline hoặc kết quả backfill có mã thiếu, sai định dạng hay trùng
- **WHEN** migration kiểm tra điều kiện
- **THEN** migration SHALL thất bại nguyên tử
- **AND** hệ thống SHALL không để lại schema được áp dụng một phần

### Requirement: Mã chỉ tiêu bất biến và được bảo lưu

Sau khi được cấp, `import_code` SHALL không thay đổi khi sửa tên, chuyên khoa, phương pháp, đơn vị hoặc khi xóa mềm chỉ tiêu. Cơ sở dữ liệu SHALL từ chối mọi cập nhật làm thay đổi mã, kể cả cập nhật trực tiếp hoặc qua RPC.

#### Scenario: Cập nhật thuộc tính chỉ tiêu

- **GIVEN** một chỉ tiêu đã có mã
- **WHEN** quản lý cập nhật thuộc tính được phép của chỉ tiêu
- **THEN** thao tác SHALL giữ nguyên `import_code`

#### Scenario: Cố thay đổi mã trực tiếp

- **GIVEN** một chỉ tiêu đã có mã
- **WHEN** một câu lệnh SQL hoặc RPC cố thay đổi `import_code` sang giá trị khác
- **THEN** cơ sở dữ liệu SHALL từ chối toàn bộ thao tác

#### Scenario: Xóa mềm chỉ tiêu

- **GIVEN** một chỉ tiêu đã có mã
- **WHEN** quản lý xóa mềm chỉ tiêu
- **THEN** chỉ tiêu SHALL giữ nguyên mã
- **AND** mã đó SHALL tiếp tục được bảo lưu, không được cấp cho chỉ tiêu khác

### Requirement: Hợp đồng quản lý chỉ tiêu công bố mã ở dạng chỉ đọc

Các hợp đồng đọc, danh sách và tìm kiếm chỉ tiêu SHALL trả về `import_code`. Hợp đồng tạo SHALL trả về mã do DB cấp, còn hợp đồng tạo và cập nhật SHALL không nhận mã như một trường có thể chỉnh sửa.

#### Scenario: Đọc danh sách hoặc chi tiết chỉ tiêu

- **WHEN** người dùng có quyền đọc danh sách, kết quả tìm kiếm hoặc chi tiết chỉ tiêu
- **THEN** mỗi chỉ tiêu trả về SHALL có `import_code` tương ứng

#### Scenario: Hiển thị mã trong giao diện quản lý

- **GIVEN** quản lý mở bảng hoặc chế độ xem chi tiết chỉ tiêu
- **WHEN** dữ liệu chỉ tiêu được hiển thị
- **THEN** giao diện SHALL hiển thị nhãn tiếng Việt `Mã chỉ tiêu`
- **AND** mã SHALL ở trạng thái chỉ đọc

#### Scenario: Tạo hoặc sửa chỉ tiêu trên giao diện

- **GIVEN** quản lý mở hộp thoại tạo hoặc sửa chỉ tiêu
- **WHEN** quản lý gửi biểu mẫu
- **THEN** giao diện SHALL không cung cấp control để nhập hoặc sửa mã
- **AND** payload SHALL không chứa `import_code`

### Requirement: Mã chỉ tiêu giữ nguyên ranh giới bảo mật hiện có

Việc thêm `import_code` SHALL không mở rộng quyền tạo, cập nhật, xóa mềm hoặc đọc chỉ tiêu. Mọi RPC được thay đổi SHALL giữ nguyên các ràng buộc `SECURITY DEFINER`, `search_path`, grant/revoke, RLS và audit đang áp dụng.

#### Scenario: Người dùng không có quyền cố quản lý chỉ tiêu

- **GIVEN** một người dùng không có quyền quản lý chỉ tiêu
- **WHEN** người dùng cố tạo, cập nhật hoặc xóa mềm chỉ tiêu
- **THEN** thao tác SHALL bị từ chối theo ranh giới phân quyền hiện có

#### Scenario: Chạy kiểm thử bảo mật sau migration

- **WHEN** migration đã được áp dụng
- **THEN** `run_security_tests()` SHALL đạt
- **AND** kiểm thử SHALL xác nhận mã đúng định dạng, duy nhất, bất biến và không làm mở rộng quyền trên bảng hoặc sequence

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

