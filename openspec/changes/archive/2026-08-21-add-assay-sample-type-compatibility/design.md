## Context

`samples.type` hiện là text tự do, còn `results` liên kết trực tiếp mẫu với `assay_definitions`. Hai RPC ghi chính là `accession_and_assign_tests` và `assign_tests_to_sample`; chúng kiểm tra quyền/trạng thái nhưng không kiểm tra loại mẫu. Validation phía client hiện chỉ yêu cầu có ít nhất một chỉ tiêu và xử lý method thiếu.

Kiểm tra read-only trên home server ngày 2026-08-20 cho thấy dữ liệu hiện tại có một giá trị loại mẫu `Máu`, 91 mẫu, 85 result rows trên 12 mẫu và 34 cặp loại mẫu - chỉ tiêu đã từng quan sát; có 84 chỉ tiêu active trên 290 chỉ tiêu lịch sử. Các quan sát này hữu ích để lập draft nhưng không đủ để chứng minh tương thích lâm sàng.

Change phải tạo nguồn sự thật dùng chung cho tiếp nhận hiện tại và bulk Excel tương lai, giữ audit/RLS, không sửa migration đã áp dụng và không diễn giải lại chỉ định lịch sử.

## Goals / Non-Goals

**Goals:**

- Chuẩn hóa loại mẫu thành master data có mã `LM-NNNNNN` ổn định, duy nhất và bất biến.
- Lưu compatibility dưới dạng allowlist snapshot theo revision, có trạng thái draft/published/superseded và provenance.
- Giao quyền sở hữu nghiệp vụ cho Trưởng khoa/phụ trách chuyên môn, được ánh xạ vào role `manager`; Analyst chỉ tiêu thụ catalog đã publish.
- Cho phép dùng dữ liệu lịch sử để tạo candidate nhưng bắt buộc review rõ ràng trước publish.
- Phát hiện thiếu/stale ở database và từ chối nguyên tử mọi chỉ định mới.
- Cung cấp revision và catalog export ổn định để Issue #112 tạo/kiểm tra workbook.
- Giữ toàn bộ chỉ định lịch sử và rollout theo thứ tự không làm dừng vận hành ngoài cửa sổ chuyển đổi đã kiểm soát.

**Non-Goals:**

- Không parse, preview hoặc confirm workbook Excel.
- Không đối soát khách hàng, tạo batch import, provenance batch hoặc idempotency key.
- Không tự suy luận compatibility từ tên chỉ tiêu, specialty, method hoặc tần suất lịch sử.
- Không hồi tố xóa/sửa result đã tồn tại do catalog mới.
- Không yêu cầu hai quản lý độc lập hoặc thêm cơ chế e-signature mới trong MVP. Cùng một manager được lập và publish sau bước review xác nhận có lý do vì mô hình quyền hiện tại chỉ có `analyst`/`manager`; actor, diff và lý do vẫn phải được audit đầy đủ để change dual-control sau này có thể mở rộng mà không mất lịch sử.
- Không xóa ngay cột legacy `samples.type`; việc loại bỏ sau giai đoạn tương thích cần change riêng.

## Decisions

### Dùng master data loại mẫu với mã do hệ thống cấp

Tạo `sample_types` gồm UUID, `import_code`, tên tiếng Việt, tên chuẩn hóa để phát hiện collision, `compatibility_generation`, timestamps và `deleted_at`. Mã có dạng `LM-NNNNNN`, dùng sequence toàn cục `MAXVALUE 999999 NO CYCLE`, do PostgreSQL cấp và không nhận từ client.

`compatibility_generation` do database tăng khi tên chuẩn hóa đổi hoặc `deleted_at` chuyển trạng thái. Revision snapshot generation này; rename, retire hoặc restore loại mẫu đều làm pair cũ stale cho đến khi review/publish lại.

`samples.sample_type_id` là nguồn sự thật mới. Cột `samples.type` được giữ như projection tương thích trong rollout và được đồng bộ từ `sample_types.name`; client không được tạo hai giá trị mâu thuẫn.

**Alternatives considered:**

- Dùng text loại mẫu làm khóa quan hệ: diff nhỏ hơn nhưng rename/case/Unicode làm workbook và lịch sử không ổn định.
- Dùng slug do quản lý nhập: dễ collision và tạo thêm quy tắc sửa/reuse; mã sequence phù hợp với contract chỉ tiêu từ #109.

### Catalog compatibility là snapshot toàn cục, không phải JSON trên chỉ tiêu

Tạo các thực thể:

- `assay_sample_type_catalog_revisions`: header revision, trạng thái, revision nguồn, actor/thời gian, lý do publish và content hash.
- `assay_sample_type_reviews`: đúng một disposition cho mỗi chỉ tiêu active trong revision: `configured` hoặc `not_assignable`.
- `assay_sample_type_compatibilities`: các cặp allowlist `(revision_id, assay_definition_id, sample_type_id)` cùng provenance.

Chỉ có tối đa một draft mở và một published revision hiện hành. Bootstrap tạo revision 1 draft từ baseline rỗng với `source_revision_id = NULL`, actor hệ thống/migration và candidate lịch sử trong cùng transaction; manager review tiếp trên draft này. Từ revision 2, draft được clone từ revision published hiện hành. Publish khóa draft, tính content hash, supersede revision cũ và tạo audit trong cùng transaction. Published/superseded revisions và entries là bất biến; sửa tiếp phải clone thành draft mới.

**Alternatives considered:**

- Mảng `sample_type_ids` trong `assay_definitions`: khó audit từng cặp, không có snapshot/revision và dễ bị ghi đè.
- Bảng M:N mutable duy nhất: phù hợp UI nhưng không thể chứng minh workbook dùng catalog nào.
- Revision riêng mỗi chỉ tiêu: giảm kích thước snapshot nhưng làm template và confirm phải ghép nhiều version, tăng nguy cơ trạng thái hỗn hợp.

### Phụ trách chuyên môn sở hữu quyết định qua role manager

Trưởng khoa/phụ trách chuyên môn phòng xét nghiệm chịu trách nhiệm xác nhận compatibility theo SOP; ứng dụng biểu diễn trách nhiệm đó bằng role `manager`. MVP cho phép manager tạo draft, thực hiện review confirmation và publish chính draft đó. Publish yêu cầu lý do và xác nhận diff, ghi actor/thời gian/before-after; không có đường publish tự động hoặc service-role.

Không bắt buộc maker-checker trong change này vì repo chưa có role/phân công reviewer chuyên môn độc lập và yêu cầu đó có thể làm catalog không thể vận hành. Một change compliance sau có thể bắt buộc `published_by <> prepared_by` mà vẫn dùng lịch sử revision hiện có.

### Lịch sử chỉ tạo candidate

Migration foundation tạo loại mẫu từ các giá trị lịch sử không rỗng sau khi trim, abort nếu có blank hoặc collision chuẩn hóa không thể xác định. Nó có thể tạo candidate pair từ các result lịch sử với provenance `historical_observation`, nhưng candidate chưa được review SHALL không được resolver chấp nhận.

Trước publish, mỗi chỉ tiêu active phải có review:

- `configured`: có ít nhất một cặp với loại mẫu active.
- `not_assignable`: không có cặp và có lý do bắt buộc.

Mỗi entry candidate phải được Quản lý accept hoặc loại khỏi draft. Chỉ tiêu mới sau lần publish không làm thay đổi revision cũ nhưng không thể được chỉ định cho đến khi có revision mới review nó.

**Alternatives considered:**

- Tự publish toàn bộ cặp lịch sử: nhanh nhưng biến dữ liệu vận hành cũ thành kết luận lâm sàng không được xác nhận.
- Mặc định mọi chỉ tiêu tương thích mọi loại mẫu: vi phạm fail-closed.
- Bắt buộc dual approval: kiểm soát mạnh hơn nhưng chưa phù hợp staffing MVP; có thể bổ sung bằng change compliance riêng.

### Resolver fail-closed dùng chung ở database

Một hàm nội bộ resolve theo `(sample_type_id, assay_definition_id, expected_revision_number nullable)` và trả revision đã dùng. Nó chỉ thành công khi:

- Có published revision hiện hành.
- Nếu caller gửi expected revision thì giá trị đó bằng revision hiện hành.
- Loại mẫu và chỉ tiêu tồn tại, active.
- Chỉ tiêu có review `configured`.
- Cặp allowlist tồn tại.
- Fingerprint compatibility của chỉ tiêu vẫn khớp snapshot review.

Mỗi `assay_definition` có `compatibility_generation` do database tăng khi `method_name` đổi hoặc `deleted_at` chuyển trạng thái. Revision snapshot generation của cả assay và sample type. Rename assay, units hoặc normal range không làm stale; đổi method, retire/restore assay, đổi tên chuẩn hóa hoặc retire/restore loại mẫu làm pair liên quan fail-closed cho đến revision mới.

`accession_and_assign_tests`, `assign_tests_to_sample` và trigger `BEFORE INSERT` trên `results` cùng gọi validator. Trigger là defense in depth cho đường ghi ngoài RPC. Lỗi dùng SQLSTATE/message ổn định để application map sang tiếng Việt.

**Alternatives considered:**

- Chỉ lọc ở UI: có thể bị bypass bởi API/RPC cũ hoặc race sau khi catalog đổi.
- Chỉ validate trong bulk import tương lai: để luồng thủ công tạo dữ liệu mà bulk lại từ chối.
- TTL theo ngày: không phản ánh thay đổi nghiệp vụ thực và tạo lỗi vận hành không cần thiết.

### Không sửa lại lịch sử; khóa thay đổi loại mẫu sau chỉ định

Result đã tồn tại trước enforcement được giữ nguyên và không cần cặp compatibility hồi tố. Khi mẫu chưa có result, người có quyền có thể đổi sang loại mẫu active qua RPC có audit. Sau result đầu tiên, `sample_type_id` và projection `type` là bất biến; sửa sai phải dùng workflow void/re-accession riêng thay vì làm thay đổi ngữ nghĩa chỉ định lịch sử.

### UI quản lý theo danh sách coverage, không dùng ma trận khổng lồ

Thêm route `/manager/assays/compatibility` liên kết từ trang chỉ tiêu. Danh sách assay-centric hiển thị mã chỉ tiêu, method, trạng thái coverage, stale/candidate và số loại mẫu tương thích; filter theo specialty/trạng thái. Quản lý chỉnh một assay hoặc nhóm đã lọc trong draft, xem diff và publish với lý do.

Accession desktop/mobile nhận catalog đã publish theo loại mẫu đang chọn. UI ẩn chỉ tiêu không tương thích và hiển thị lỗi rõ ràng nếu catalog đổi trước submit; selection cũ không được âm thầm giữ khi đổi loại mẫu.

### Dùng RPC v2 additive trước khi enforcement để rollout an toàn

Foundation thêm schema/catalog, backfill và RPC quản lý nhưng chưa chặn assignment. Sau khi app quản lý được deploy và revision đầu tiên được review/publish, một migration additive tạo resolver cùng các RPC assignment v2 nhận `sample_type_id`/`expected_revision_number`; RPC cũ vẫn hoạt động nên app cũ không hỏng.

Server/API và UI được phát triển ở hai PR riêng nhưng chỉ deploy cùng một release sau khi cả hai đã merge. Release này chuyển caller mới sang v2, giữ endpoint legacy chỉ để trả lỗi fail-closed yêu cầu tải lại cho browser tab cũ, và giữ RPC DB cũ làm rollback path. Chỉ migration enforcement cuối mới xác minh không còn caller cũ, revoke/drop signature cũ theo cách forward-only và bật trigger `results` fail-closed. Thứ tự production bắt buộc là: foundation DB -> manager app -> publish revision 1 -> v2 DB -> merge server/API + UI v2 -> deploy v2 app -> enforcement DB.

Các migration đã chạy là bất biến. Nếu apply thất bại, transaction rollback; correction dùng migration forward-only tiếp theo. Sau khi enforcement thành công, không rollback bằng cách xóa catalog hoặc nới fail-closed; sửa bằng forward migration.

## Risks / Trade-offs

- **Catalog ban đầu thiếu quyết định lâm sàng cho nhiều assay** → Import candidate từ lịch sử, báo coverage và không cho publish cho đến khi mọi assay active có disposition.
- **Thay đổi method hoặc lifecycle có thể chặn pair đang dùng** → Hiển thị stale ngay trong trang quản lý, cho clone draft nhanh và giữ lỗi cụ thể theo entity; không hạ fail-closed.
- **Global snapshot nhân bản nhiều rows** → Quy mô hiện tại nhỏ; unique indexes và chỉ một draft mở giữ chi phí thấp, đổi lại audit/template contract rõ ràng.
- **Trigger trên `results` ảnh hưởng fixtures hoặc worker** → Tất cả đường ghi production phải qua cùng validator; tests tạo dữ liệu lịch sử phải seed trước enforcement hoặc tạo published fixture rõ ràng.
- **Dual representation `sample_type_id` và `type` có thể lệch** → Trigger/constraint đồng bộ, cấm payload mâu thuẫn và kiểm thử hậu điều kiện.
- **Deploy foundation rồi chưa publish catalog** → Assignment cũ tiếp tục hoạt động vì RPC cũ chưa bị retire; release checklist không cho deploy v2 app/enforcement trước publication.
- **App và DB lệch version trong rollout** → Tạo RPC v2 additive trước, deploy app v2 khi cả contract cũ/mới cùng tồn tại, chỉ retire contract cũ sau smoke và kiểm tra usage.
- **Draft đồng thời bị ghi đè** → Dùng row/advisory lock, optimistic revision token và chỉ cho một draft mở.
- **Manager publish nhầm** → Bắt buộc preview diff, lý do publish, audit actor và snapshot bất biến; correction là revision mới, không sửa revision cũ.

## Migration Plan

1. Thêm sample-type foundation/backfill rồi compatibility revision core; bootstrap revision 1 draft có audit hệ thống và candidate provenance, chưa enforcement.
2. Thêm manager RPC/application contracts và UI; deploy foundation/app quản lý rồi để phụ trách chuyên môn review/publish revision 1.
3. Thêm resolver và RPC assignment v2 additive; apply migration khi app cũ vẫn chạy.
4. Chuyển server actions/API và UI sang v2 trong hai PR, sau đó deploy cùng một release; smoke toàn bộ caller trong khi RPC cũ còn rollback path.
5. Thêm/apply migration enforcement forward-only để retire contract cũ, bật trigger và khóa thay đổi loại mẫu sau assignment.
6. Chạy security tests, transactional drills, health checks và archive sau khi runtime evidence được ghi vào #107/#110.

## Open Questions

Không còn câu hỏi mở trong phạm vi Issue #110. Quy tắc cột/template, thời điểm preview-confirm, payload batch và giới hạn file tiếp tục thuộc #112-#115.
