## Context

Luồng `/analyst/accession` hiện có một form dùng chung cho desktop và mobile nhưng lưu qua hai đường khác nhau:

- Mẫu không có xét nghiệm gọi `createSample` rồi `create_sample_atomic`.
- Mẫu có xét nghiệm gọi `accessionAndAssignTests` rồi `accession_and_assign_tests`.

Database live hiện có các mẫu lịch sử nhưng chưa có cột chất lượng mẫu. Audit trigger trên `public.samples` ghi toàn bộ row bằng JSONB, trong khi RLS và hai RPC tiếp nhận mẫu đang giới hạn việc tạo mẫu cho analyst.

Thay đổi này phải giữ nguyên workflow hiện tại, không suy diễn chất lượng cho dữ liệu cũ, đồng thời bảo đảm mọi mẫu mới đều có đánh giá rõ ràng.

## Goals / Non-Goals

**Goals:**

- Lưu `sample_quality` cho mọi mẫu mới với đúng một trong hai giá trị `Đạt` hoặc `Không đạt`.
- Không backfill hoặc gán mặc định cho mẫu lịch sử.
- Bắt buộc lựa chọn trên cả desktop và mobile trước khi cho phép lưu.
- Dùng Shadcn `Checkbox` và đặt nhóm lựa chọn ngay dưới trường `Loại mẫu`.
- Truyền giá trị qua cả hai nhánh lưu mẫu và bảo vệ contract tại UI, Zod, Server Action, RPC và database.
- Giữ audit, RLS, role checks và quyền RPC hiện có.

**Non-Goals:**

- Không thay đổi trạng thái mẫu hoặc ngăn gán xét nghiệm khi chất lượng là `Không đạt`.
- Không yêu cầu lý do cho lựa chọn `Không đạt`.
- Không thêm bộ lọc, cột danh sách hoặc báo cáo theo chất lượng mẫu trong change này.
- Không cung cấp luồng sửa lại đánh giá chất lượng sau khi mẫu đã được tiếp nhận.
- Không cập nhật giá trị cho các mẫu lịch sử.

## Decisions

### Lưu dưới dạng nullable boolean

Thêm `public.samples.sample_quality BOOLEAN NULL`:

- `TRUE` tương ứng `Đạt`.
- `FALSE` tương ứng `Không đạt`.
- `NULL` chỉ dành cho mẫu lịch sử chưa được đánh giá bằng tính năng này.

Cột không có default và migration không chạy backfill. Cách này giữ đúng sự thật lịch sử và tránh gán nhầm `Đạt` hoặc `Không đạt` cho dữ liệu cũ.

Alternative considered: enum ba trạng thái. Enum diễn đạt rõ hơn nhưng làm tăng contract và migration cho một yêu cầu nghiệp vụ hiện chỉ có hai kết quả. Nullable boolean đủ biểu đạt nếu `NULL` được giới hạn cho dữ liệu lịch sử.

### Dùng hai Shadcn Checkbox như một nhóm chọn duy nhất

UI hiển thị trực tiếp nhãn `Chất lượng mẫu` với hai Shadcn `Checkbox`: `Đạt` và `Không đạt`. Không dùng dropdown/select như trường `Loại mẫu`. Form giữ trạng thái ba giá trị `undefined | true | false`; chọn một checkbox phải bỏ chọn checkbox còn lại.

Nhóm được đặt:

- Ngay dưới `Loại mẫu` trong form desktop.
- Ngay dưới `Loại mẫu` và trước `Thời gian nhận` trong bước thông tin mẫu của mobile.
- Được hiển thị lại trong bước rà soát mobile trước khi xác nhận.

Không có lựa chọn mặc định. Nút lưu hoặc xác nhận phải bị vô hiệu hóa, đồng thời submit handler vẫn phải từ chối, khi giá trị còn `undefined`.

Alternative considered: radio group hoặc một checkbox đơn. Radio group có semantics tự nhiên hơn nhưng không đáp ứng yêu cầu UI đã chốt. Một checkbox đơn không phân biệt được `Không đạt` với trạng thái chưa đánh giá.

### Validation bắt buộc ở nhiều lớp

Form schema yêu cầu `sample_quality` là boolean thay vì optional. `CreateSampleSchema` và `CreateSampleWithAssignmentsSchema` cũng yêu cầu trường này để cả hai Server Actions không thể bỏ qua.

Hai RPC nhận thêm tham số boolean, từ chối `NULL`, và ghi trực tiếp vào `public.samples`. Database enforcement cuối rollout từ chối INSERT thiếu chất lượng kể cả khi caller bỏ qua application layer.

Các mẫu cũ có `NULL` vẫn được đọc và cập nhật các trường khác. Change này không thêm `sample_quality` vào generic update contract hoặc cung cấp UI sửa chất lượng sau tiếp nhận.

### `Không đạt` không thay đổi workflow

`sample_quality = FALSE` chỉ là dữ kiện tiếp nhận. Hai RPC tiếp tục:

- Tạo mẫu trạng thái `received` khi không có xét nghiệm.
- Tạo mẫu trạng thái `assigned` và tạo các result `pending` khi có xét nghiệm.

Không tái sử dụng `rejection_reason`, không chuyển sang `discarded`, và không gọi workflow từ chối của manager vì đó là nghiệp vụ khác.

### Rollout database theo hai bước tương thích

Thay đổi số lượng tham số tạo ra signature RPC mới. Để tránh khoảng dừng giữa migration và application deployment:

1. Migration tương thích thêm cột nullable và tạo các RPC overload mới có `p_sample_quality`, trong khi tạm giữ signature cũ.
2. Application được deploy để chỉ gọi signature mới.
3. Migration enforcement thu hồi và xóa signature cũ, sau đó thêm database guard bắt buộc chất lượng cho INSERT mới.

Các migration phải là forward-only, kiểm tra baseline trước khi thay đổi, giữ `SECURITY DEFINER`, fixed `search_path`, explicit analyst role checks, `REVOKE EXECUTE FROM PUBLIC`, và chỉ `GRANT EXECUTE` cho các role hiện được phép.

Alternative considered: thay RPC và application trong một maintenance window. Cách đó ít migration hơn nhưng tạo coupling triển khai chặt và rollback khó hơn.

### Audit và RLS dùng contract hiện có

Audit trigger hiện dùng `to_jsonb(NEW)` và tự bao gồm cột mới, nên không cần trigger audit riêng. SQL regression phải chứng minh audit log INSERT chứa `sample_quality`.

Không cần thay đổi policy RLS nếu policy live vẫn đáp ứng yêu cầu. Migration phải xác minh policy state thay vì tạo lại policy không liên quan.

### Giữ thay đổi UI và type có ranh giới nhỏ

Nhóm checkbox nên là component riêng để không tiếp tục làm lớn `sample-accession-form.tsx`. Nếu chạm vào module type đã vượt giới hạn dòng, phần sample schemas nên được tách theo domain và re-export qua barrel hiện có, không đổi public import surface.

## Risks / Trade-offs

- **Hai checkbox có thể gây hiểu nhầm là đa lựa chọn** → Điều khiển loại trừ lẫn nhau, nhóm dưới một label chung, giữ focus/keyboard behavior và có test accessibility cho trạng thái checked.
- **Signature cũ còn khả dụng trong cửa sổ rollout** → Giữ cửa sổ ngắn, deploy application ngay sau migration tương thích, rồi áp dụng migration enforcement và xác minh grants.
- **Application mới được deploy trước migration tương thích** → Quy định migration tương thích là deploy prerequisite và thêm kiểm tra RPC signature trước khi rollout application.
- **Mẫu lịch sử có `NULL` xuất hiện ở read path** → Type đọc cho phép nullable; nếu giá trị được hiển thị ngoài accession trong tương lai thì dùng nhãn `Chưa đánh giá`.
- **Thay đổi RPC làm mất hardening hiện có** → Copy baseline từ live database, thêm source-level SQL tests cho role checks, `search_path`, revoke/grant và chạy `run_security_tests()`.
- **Client chỉ disable nút nhưng vẫn có thể submit bằng đường khác** → Giữ validation độc lập tại submit handler, Zod, Server Action, RPC và database guard.

## Migration Plan

1. Thêm failing regression tests cho UI, application contracts và SQL security behavior.
2. Tạo migration tương thích kế tiếp: thêm cột nullable, không default, không backfill; tạo signature RPC mới và giữ signature cũ tạm thời.
3. Tạo migration enforcement kế tiếp nhưng chưa áp dụng: thu hồi/xóa signature cũ và chặn INSERT thiếu `sample_quality`.
4. Commit/push source artifacts và implementation, sau đó pull đúng commit trên home server.
5. Áp dụng migration tương thích, refresh PostgREST schema cache, chạy `run_security_tests()`, rồi deploy application dùng signature mới.
6. Xác minh cả hai nhánh tiếp nhận trước khi áp dụng migration enforcement; sau enforcement phải refresh PostgREST và chạy lại toàn bộ security tests.
7. Nếu cần rollback sau khi migration đã áp dụng, dùng migration forward-only mới; không sửa hoặc chạy lại migration cũ.

## Open Questions

Không còn câu hỏi nghiệp vụ mở cho scope này.
