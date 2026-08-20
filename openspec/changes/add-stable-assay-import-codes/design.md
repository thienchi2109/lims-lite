## Context

`assay_definitions.id` hiện là UUID nội bộ và các luồng quản lý chỉ tiêu chủ yếu nhận diện chỉ tiêu bằng tên hiển thị cùng các thuộc tính như chuyên khoa, phương pháp và đơn vị. Cách nhận diện này không phù hợp cho Excel vì các thuộc tính có thể thay đổi và dữ liệu hiện có vẫn có các chỉ tiêu trùng ngữ nghĩa.

Change này là điều kiện tiên quyết cho tiếp nhận mẫu hàng loạt, nhưng chỉ thiết lập vòng đời mã chỉ tiêu. Hệ thống phải giữ nguyên mô hình `Khách hàng 1-N Mẫu 1-N Chỉ định`, RLS, audit, xóa mềm và các ranh giới phân quyền hiện tại. Mọi migration đã áp dụng là bất biến; thay đổi cơ sở dữ liệu phải dùng migration mới, forward-only và được áp dụng trên máy chủ nhà theo quy trình Docker của repository.

Các bề mặt hiện hữu chịu tác động gồm:

- `assay_definitions` và các RPC `get_assay_definitions`, `get_assay_definition_by_id`, `create_assay_definition`, `update_assay_definition`.
- `src/types/lab.ts`, các server action truy vấn/đột biến chỉ tiêu và `src/lib/api-client.ts`.
- Bảng và hộp thoại quản lý chỉ tiêu.
- Kiểm thử migration, RPC, schema/type, server action, component và `run_security_tests()`.

## Goals / Non-Goals

**Goals:**

- Cấp cho mọi chỉ tiêu, kể cả bản ghi đã xóa mềm, một mã `CT-NNNNNN` duy nhất và ổn định.
- Đảm bảo mã do PostgreSQL cấp, không do người dùng hoặc client gửi lên.
- Backfill dữ liệu hiện có theo thứ tự xác định và không làm mất liên kết lịch sử.
- Chặn thay đổi hoặc tái sử dụng mã ở tầng cơ sở dữ liệu.
- Trả mã qua các hợp đồng đọc/tạo hiện hữu và hiển thị mã chỉ đọc cho quản lý.
- Chia triển khai thành các PR/session nhỏ có thể kiểm thử và review độc lập.

**Non-Goals:**

- Không tạo hoặc đọc workbook Excel.
- Không phân giải mã chỉ tiêu trong luồng import; change import sau này sẽ chỉ nhận mã chính xác của chỉ tiêu đang hoạt động.
- Không xác định tương thích loại mẫu - chỉ tiêu.
- Không thay đổi quy tắc đối soát khách hàng, mô hình mẫu hoặc chỉ định xét nghiệm.
- Không thay đổi `method_id`, `method_name`, `methods` hoặc `assay_methods`.
- Không cấp lại mã đã dùng và không cho phép quản lý tùy chỉnh mã.

## Decisions

### Dùng sequence toàn cục với định dạng sáu chữ số

Tạo sequence chuyên biệt có giới hạn `999999` và `NO CYCLE`. Giá trị mới được định dạng thành `CT-` cộng sáu chữ số, ví dụ `CT-000001`. UUID vẫn là khóa chính và mã chỉ là định danh nghiệp vụ.

Sequence toàn cục được chọn thay vì mã theo chuyên khoa vì chuyên khoa có thể thay đổi. Mã ngữ nghĩa theo tên hoặc phương pháp bị loại vì các trường đó có thể đổi và không duy nhất. UUID bị loại khỏi giao diện Excel vì khó nhập và khó kiểm tra bằng mắt.

### Backfill xác định trong một migration nguyên tử

Migration mới sẽ:

1. Xác nhận trạng thái nền dự kiến và tạo column/sequence chưa phát hành ra ứng dụng.
2. Khóa thay đổi cấu trúc cần thiết trong transaction migration.
3. Gán mã cho toàn bộ bản ghi, gồm cả bản ghi có `deleted_at`, theo `created_at`, sau đó `id`.
4. Đặt sequence tiếp tục sau giá trị lớn nhất đã gán.
5. Thêm default do DB cấp, `NOT NULL`, regex check và unique constraint.
6. Cài bảo vệ bất biến trước khi mở rộng các hợp đồng ứng dụng.

Không dùng số lượng bản ghi cố định làm điều kiện triển khai vì số lượng có thể tăng hợp lệ trước ngày áp dụng. Baseline assertion tập trung vào trạng thái schema, khả năng sắp xếp đầy đủ và việc mọi row nhận đúng một mã hợp lệ, không trùng.

### Bảo vệ bất biến ở tầng cơ sở dữ liệu

Trigger `BEFORE UPDATE` sẽ từ chối khi `NEW.import_code IS DISTINCT FROM OLD.import_code`. Xóa mềm không sửa mã; bản ghi đã nghỉ dùng tiếp tục giữ unique reservation. Sequence không cycle nên giá trị đã cấp không được quay vòng.

Chỉ bỏ trường khỏi payload ứng dụng là chưa đủ vì SQL hoặc RPC khác vẫn có thể cập nhật trực tiếp. Constraint định dạng/duy nhất cũng không ngăn đổi từ một mã hợp lệ sang mã hợp lệ khác, nên cần trigger riêng.

### Hợp đồng ghi không nhận mã, hợp đồng đọc luôn trả mã

Schema tạo/cập nhật và `FormData` không có trường đầu vào `import_code`. RPC tạo dùng default của DB và trả row có mã; RPC cập nhật không nhận tham số mã. Các RPC đọc, danh sách và tìm kiếm trả thêm `import_code` mà không làm thay đổi bộ lọc hoặc phân trang hiện tại.

Cách này giữ server là nguồn sự thật và tránh client đặt trước mã. Resolver chỉ tiêu đang hoạt động theo mã chính xác sẽ thuộc change import Excel sau, không được thêm sớm vào change này.

### Giao diện quản lý chỉ hiển thị mã

Bảng chỉ tiêu và chế độ xem chi tiết hiển thị nhãn `Mã chỉ tiêu`. Hộp thoại tạo không có control nhập mã; sau khi tạo thành công, row trả về chứa mã để bảng và chế độ xem có thể hiển thị ngay. Hộp thoại sửa hiển thị mã dạng chỉ đọc và không đưa mã vào payload.

Không thêm khả năng sửa hoặc tái tạo mã. Việc tìm kiếm theo mã không phải yêu cầu của change này; hợp đồng tìm kiếm chỉ cần trả mã trong mỗi kết quả.

### Không phụ thuộc vào thay đổi mô hình phương pháp

Các migration/RPC có thể đồng thời bị các change về phương pháp sửa đổi. Khi triển khai từng phase, người thực hiện phải đọc định nghĩa RPC mới nhất trên nhánh đích và giữ nguyên contract phương pháp đang có tại thời điểm đó, chỉ bổ sung `import_code`.

Không copy lại một định nghĩa RPC cũ nếu việc đó làm sống lại `method_id` hoặc xóa mất `method_name`. Đây là ranh giới phối hợp bắt buộc với `add-assay-method-m2m` và `remove-legacy-method-catalog-dependency`.

## Risks / Trade-offs

- **Hai change cùng sửa RPC chỉ tiêu có thể ghi đè contract của nhau** → Mỗi phase phải rebase trước khi viết migration, so sánh định nghĩa mới nhất và có regression test cho toàn bộ row shape liên quan.
- **Backfill không xác định khi `created_at` trùng nhau** → Luôn dùng UUID làm khóa sắp xếp phụ.
- **Sequence vượt sáu chữ số** → Dùng `MAXVALUE 999999 NO CYCLE` để dừng rõ ràng thay vì phát sinh mã sai định dạng; theo dõi dung lượng trước khi gần giới hạn.
- **Quyền trên sequence làm mở rộng bề mặt ghi** → Không grant quyền cấp sequence trực tiếp cho client; giữ thao tác tạo qua ranh giới manager/RPC hiện hữu và xác minh bằng security test.
- **Chỉ kiểm tra ở TypeScript có thể bị bỏ qua** → Constraint và trigger DB là nguồn thực thi cuối cùng.
- **Xóa mềm rồi tạo chỉ tiêu tương tự làm người dùng nhầm mã** → Mã cũ vẫn được bảo lưu; mã mới luôn được cấp mới và bảng hiển thị mã rõ ràng.
- **Rollback sau khi mã đã được sử dụng làm mất định danh lịch sử** → Không rollback bằng cách xóa column/sequence sau khi áp dụng trên persistent database; sửa lỗi bằng migration forward-only.

## Migration Plan

1. Hoàn thiện regression test mô tả schema, backfill, định dạng, uniqueness, immutability và quyền trước khi viết migration.
2. Tạo migration mới theo số thứ tự hiện hành; không sửa migration assay đã áp dụng.
3. Trên máy chủ nhà, xác minh baseline read-only, áp dụng migration đã commit bằng `sudo -n docker exec ... psql -v ON_ERROR_STOP=1`.
4. Chạy kiểm thử SQL tập trung và `SELECT * FROM run_security_tests();`.
5. Triển khai mở rộng type, server action/RPC contract và UI theo các phase sau khi schema đã sẵn sàng.
6. Xác minh chỉ tiêu cũ, mới và đã xóa mềm đều giữ đúng mã qua thao tác đọc, sửa và xóa mềm.

Nếu một bước hậu triển khai thất bại, dừng rollout ứng dụng và sửa bằng migration forward-only kế tiếp. Không chỉnh sửa hoặc chạy lại migration đã áp dụng, không tái sử dụng sequence value và không xóa mã đã backfill.

## Open Questions

Không còn câu hỏi mở trong phạm vi change này. Quy tắc tương thích mẫu - chỉ tiêu, resolver import, hợp đồng workbook, giới hạn dung lượng và phân rã toàn bộ tính năng tiếp tục được theo dõi tại Wayfinder #107.
