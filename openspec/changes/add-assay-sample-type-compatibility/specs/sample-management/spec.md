## ADDED Requirements

### Requirement: Mẫu tham chiếu loại mẫu chuẩn

Mẫu mới SHALL lưu `sample_type_id` tham chiếu loại mẫu active. Hợp đồng đọc SHALL trả UUID, mã và tên loại mẫu; cột text legacy chỉ là projection tương thích và không được mâu thuẫn với master data.

#### Scenario: Tiếp nhận mẫu với loại mẫu hợp lệ

- **WHEN** Analyst chọn một loại mẫu active và tạo mẫu
- **THEN** hệ thống SHALL lưu định danh loại mẫu chuẩn
- **AND** response SHALL trả mã và tên tiếng Việt hiện hành

#### Scenario: Loại mẫu không tồn tại hoặc đã xóa mềm

- **WHEN** caller gửi định danh/mã loại mẫu không hợp lệ
- **THEN** tạo mẫu SHALL thất bại
- **AND** hệ thống SHALL không fallback sang text tự do

#### Scenario: Backfill mẫu lịch sử

- **WHEN** migration ánh xạ mẫu lịch sử sang master data
- **THEN** mỗi mẫu SHALL nhận đúng một `sample_type_id`
- **AND** `samples.type` SHALL tiếp tục khớp tên loại mẫu trong giai đoạn tương thích

### Requirement: Picker chỉ hiển thị chỉ tiêu tương thích

Sau khi người dùng chọn loại mẫu, accession desktop/mobile và module gán bổ sung SHALL tải chỉ tiêu từ revision published hiện hành và chỉ hiển thị pair hợp lệ, không stale.

#### Scenario: Chọn loại mẫu

- **WHEN** Analyst chọn loại mẫu trong accession
- **THEN** picker SHALL tải các chỉ tiêu compatible cùng revision number
- **AND** chỉ tiêu không compatible hoặc stale SHALL không xuất hiện

#### Scenario: Đổi loại mẫu sau khi đã chọn chỉ tiêu

- **WHEN** Analyst đổi sang loại mẫu khác
- **THEN** selection không còn compatible SHALL bị loại khỏi form
- **AND** UI SHALL thông báo bằng tiếng Việt rằng danh sách chỉ tiêu đã được cập nhật

#### Scenario: Catalog đổi trước submit

- **WHEN** UI submit với revision không còn hiện hành
- **THEN** server SHALL từ chối toàn bộ thao tác
- **AND** UI SHALL yêu cầu tải lại catalog, không tự submit lại theo revision mới

### Requirement: Mọi đường tạo chỉ định dùng cùng validator database

Các RPC assignment v2 thay thế `accession_and_assign_tests`/`assign_tests_to_sample` SHALL gọi cùng resolver fail-closed trong transaction. Contract cũ SHALL chỉ tồn tại trong cửa sổ chuyển đổi và SHALL bị retire trước khi enforcement hoàn tất. Mọi INSERT production vào `results` SHALL được trigger bảo vệ; client-side filtering SHALL không thay thế enforcement ở database.

#### Scenario: Tiếp nhận kèm nhiều chỉ định hợp lệ

- **WHEN** mọi pair trong payload hợp lệ theo cùng revision
- **THEN** sample và toàn bộ result SHALL được tạo nguyên tử
- **AND** response SHALL ghi revision đã dùng

#### Scenario: Một pair trong batch nhỏ không hợp lệ

- **WHEN** payload có ít nhất một chỉ tiêu missing, incompatible hoặc stale
- **THEN** toàn bộ thao tác SHALL rollback
- **AND** không sample, result hoặc audit một phần nào được giữ lại

#### Scenario: Gán bổ sung cho mẫu hiện có

- **WHEN** Analyst hoặc Quản lý gán thêm chỉ tiêu
- **THEN** database SHALL resolve theo loại mẫu hiện tại của mẫu
- **AND** cặp không hợp lệ SHALL bị từ chối trước khi INSERT

#### Scenario: Ghi trực tiếp bỏ qua RPC

- **WHEN** một role có đường ghi cố INSERT result không qua RPC
- **THEN** trigger SHALL thực thi cùng compatibility check
- **AND** RLS/grants hiện có SHALL vẫn là lớp bảo vệ bổ sung

#### Scenario: Chuyển đổi contract không làm hỏng app cũ

- **WHEN** migration additive tạo RPC v2
- **THEN** RPC cũ SHALL tiếp tục hoạt động trong cửa sổ chuyển đổi
- **AND** ứng dụng v2 SHALL được deploy/smoke trước khi migration enforcement retire RPC cũ

### Requirement: Loại mẫu bất biến sau chỉ định đầu tiên

Khi mẫu đã có ít nhất một result, `sample_type_id` và projection `type` SHALL không được thay đổi trực tiếp. Mẫu chưa có result MAY đổi sang loại mẫu active qua mutation có quyền và audit.

#### Scenario: Sửa loại mẫu trước khi gán chỉ tiêu

- **WHEN** người có quyền đổi loại mẫu của sample chưa có result
- **THEN** mutation SHALL thành công nếu loại mẫu mới active
- **AND** audit SHALL ghi before/after

#### Scenario: Sửa loại mẫu sau khi đã gán chỉ tiêu

- **WHEN** caller cố đổi loại mẫu của sample đã có result
- **THEN** database SHALL từ chối
- **AND** chỉ định và loại mẫu lịch sử SHALL giữ nguyên

### Requirement: Chỉ định lịch sử không bị diễn giải lại

Enforcement mới SHALL áp dụng cho INSERT result mới, không xóa, sửa trạng thái hoặc đánh dấu invalid các result đã tồn tại trước publication/enforcement.

#### Scenario: Catalog đầu tiên được publish

- **WHEN** revision đầu tiên trở thành hiện hành
- **THEN** mọi result lịch sử SHALL giữ nguyên dữ liệu và audit
- **AND** absence của pair hiện tại SHALL không tự thay đổi result cũ

#### Scenario: Pair bị bỏ ở revision mới

- **WHEN** Quản lý publish revision bỏ một pair
- **THEN** result lịch sử của pair đó SHALL vẫn đọc được
- **AND** chỉ các assignment mới SHALL bị từ chối

### Requirement: Lỗi compatibility có contract ổn định và tiếng Việt

Database SHALL phát error code phân biệt missing catalog, stale revision, unknown sample type, unreviewed assay, incompatible pair và stale assay fingerprint. Application SHALL map các code này sang thông báo tiếng Việt nhất quán.

#### Scenario: Pair không tương thích

- **WHEN** assignment bị từ chối vì pair không nằm trong allowlist
- **THEN** UI SHALL hiển thị thông báo tiếng Việt nêu loại mẫu và mã chỉ tiêu liên quan
- **AND** SHALL không hiển thị raw database stack hoặc dữ liệu nhạy cảm

#### Scenario: Catalog chưa sẵn sàng

- **WHEN** chưa có revision published hoàn chỉnh
- **THEN** assignment SHALL fail-closed
- **AND** UI SHALL hướng dẫn liên hệ Quản lý để hoàn tất catalog
