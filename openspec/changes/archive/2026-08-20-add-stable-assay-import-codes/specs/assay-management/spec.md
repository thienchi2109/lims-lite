## ADDED Requirements

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
