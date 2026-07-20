## ADDED Requirements

### Requirement: Analyst must select sample quality during accession

Hệ thống SHALL yêu cầu analyst đánh giá chất lượng của mỗi mẫu mới bằng đúng một trong hai giá trị `Đạt` hoặc `Không đạt` trong luồng `/analyst/accession`.

#### Scenario: Desktop displays the required quality choices below sample type

- **WHEN** analyst mở form tiếp nhận mẫu trên desktop
- **THEN** hệ thống SHALL hiển thị nhãn `Chất lượng mẫu` ngay dưới trường `Loại mẫu`
- **AND** hệ thống SHALL hiển thị hai Shadcn `Checkbox` có nhãn `Đạt` và `Không đạt`
- **AND** hệ thống SHALL hiển thị trực tiếp hai lựa chọn thay vì dùng dropdown/select
- **AND** không checkbox nào SHALL được chọn mặc định.

#### Scenario: Mobile displays the required quality choices below sample type

- **WHEN** analyst mở bước thông tin mẫu trong mobile accession wizard
- **THEN** hệ thống SHALL hiển thị `Chất lượng mẫu` ngay dưới `Loại mẫu` và trước `Thời gian nhận`
- **AND** hệ thống SHALL dùng cùng hai lựa chọn Shadcn `Checkbox` như desktop.

#### Scenario: Selecting one quality clears the other

- **WHEN** analyst chọn `Đạt` trong khi `Không đạt` đang được chọn
- **THEN** hệ thống SHALL chọn `Đạt` và bỏ chọn `Không đạt`
- **AND** hành vi tương tự SHALL áp dụng khi analyst chọn `Không đạt`.

#### Scenario: Missing quality blocks accession

- **WHEN** analyst chưa chọn `Đạt` hoặc `Không đạt`
- **THEN** hệ thống SHALL không cho lưu mẫu trên desktop
- **AND** hệ thống SHALL không cho xác nhận lưu trong mobile accession wizard
- **AND** submit validation SHALL trả về thông báo tiếng Việt cho trường bắt buộc.

#### Scenario: Mobile review shows the selected quality

- **WHEN** analyst đã chọn chất lượng và chuyển đến bước rà soát mobile
- **THEN** hệ thống SHALL hiển thị lại giá trị `Đạt` hoặc `Không đạt` trước khi analyst xác nhận.

### Requirement: Sample quality must persist through every accession path

Hệ thống SHALL truyền, xác thực và lưu `sample_quality` cho cả mẫu không có xét nghiệm và mẫu được tạo kèm chỉ định xét nghiệm.

#### Scenario: Accession without tests stores acceptable quality

- **WHEN** analyst chọn `Đạt` và tiếp nhận mẫu không có xét nghiệm
- **THEN** mẫu mới SHALL được lưu với `sample_quality = TRUE`
- **AND** trạng thái mẫu SHALL tiếp tục tuân theo workflow không có xét nghiệm hiện tại.

#### Scenario: Accession without tests stores unacceptable quality

- **WHEN** analyst chọn `Không đạt` và tiếp nhận mẫu không có xét nghiệm
- **THEN** mẫu mới SHALL được lưu với `sample_quality = FALSE`
- **AND** mẫu SHALL vẫn được tạo theo workflow không có xét nghiệm hiện tại
- **AND** hệ thống SHALL không tự động loại bỏ mẫu hoặc yêu cầu lý do.

#### Scenario: Accession with tests stores acceptable quality

- **WHEN** analyst chọn `Đạt` và tiếp nhận mẫu có các xét nghiệm đã chọn
- **THEN** mẫu mới SHALL được lưu với `sample_quality = TRUE`
- **AND** các xét nghiệm SHALL được tạo và gán theo workflow hiện tại.

#### Scenario: Accession with tests stores unacceptable quality

- **WHEN** analyst chọn `Không đạt` và tiếp nhận mẫu có các xét nghiệm đã chọn
- **THEN** mẫu mới SHALL được lưu với `sample_quality = FALSE`
- **AND** các xét nghiệm SHALL vẫn được tạo và gán theo workflow hiện tại
- **AND** trạng thái mẫu hoặc result SHALL không bị thay đổi chỉ vì chất lượng là `Không đạt`.

#### Scenario: Server contract rejects a missing quality value

- **WHEN** client gửi một trong hai mutation tiếp nhận mẫu mà không có `sample_quality`
- **THEN** Zod và Server Action contract SHALL từ chối payload
- **AND** không mẫu hoặc result nào SHALL được tạo.

#### Scenario: Database contract rejects a missing quality value for new samples

- **WHEN** một caller cố tạo mẫu mới mà không cung cấp chất lượng sau khi rollout enforcement hoàn tất
- **THEN** database SHALL từ chối INSERT
- **AND** caller SHALL không thể dùng RPC signature cũ để bỏ qua yêu cầu.

### Requirement: Sample quality must preserve historical truth and audit controls

Hệ thống SHALL giữ dữ liệu lịch sử không bị suy diễn và SHALL ghi nhận đánh giá chất lượng mới trong audit trail hiện có.

#### Scenario: Existing samples remain unassessed

- **WHEN** migration thêm `sample_quality` được áp dụng
- **THEN** các mẫu tồn tại trước migration SHALL giữ `sample_quality = NULL`
- **AND** migration SHALL không backfill hoặc đặt default cho các bản ghi đó.

#### Scenario: New sample audit log includes quality

- **WHEN** một mẫu mới được tạo với chất lượng `Đạt` hoặc `Không đạt`
- **THEN** audit log INSERT của mẫu SHALL chứa giá trị `sample_quality`
- **AND** `changed_by` SHALL tiếp tục nhận diện analyst thực hiện tiếp nhận.

#### Scenario: Accession authorization remains unchanged

- **WHEN** caller không phải analyst cố gọi RPC tiếp nhận mẫu
- **THEN** hệ thống SHALL từ chối thao tác như contract hiện tại
- **AND** migration SHALL giữ fixed `search_path`, RLS behavior và quyền execute tối thiểu của các `SECURITY DEFINER` RPC.
