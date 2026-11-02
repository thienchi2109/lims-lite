# Hợp đồng import nguyên tử và provenance

Ngày: 2026-11-01. Phạm vi: quyết định [#113](https://github.com/thienchi2109/lims-lite/issues/113), thuộc roadmap [#107](https://github.com/thienchi2109/lims-lite/issues/107).
Trạng thái: **Đã được người dùng duyệt ngày 2026-11-01** qua xác nhận “duyệt”, sau root review và verification đối với bản tại commit `38dff1c`. Các trạng thái, trường và boundary dưới đây là hợp đồng đã duyệt, chưa phải bảng/RPC/API hiện có.
Tài liệu chốt hành vi và bằng chứng cần giữ; chưa là implementation plan, migration, parser hoặc giao diện.
Hợp đồng template đã duyệt: [#112](2026-11-01-excel-template-contract-design.md). Không mở lại invariant #108/#109/#110/#111/#112.

## 1. Cơ sở và thuật ngữ

| Nguồn đã kiểm tra | Hành vi hiện có hoặc quyết định đã chốt |
| --- | --- |
| [Resolution #108](https://github.com/thienchi2109/lims-lite/issues/108#issuecomment-5349844886) | Upload chỉ preview, analyst xác nhận toàn lô; không lưu workbook/full normalized payload; preview server-owned bất biến 30 phút; thành công không nhập lại cùng payload chuẩn hóa. |
| [Template #112](2026-11-01-excel-template-contract-design.md), phần 4–8 | Client 1-N sample 1-N assignment; mọi lỗi chặn lô; catalog/version và client resolution phải kiểm tra lại lúc confirm. |
| [samples.ts](../../../src/app/actions/samples.ts), `createSample`, `accessionAndAssignTests` | Server actions hiện tại chặn ngoài analyst, validate schema và gọi RPC đơn mẫu; không cung cấp atomic transaction nhiều mẫu. |
| [client-resolution/server.ts](../../../src/lib/client-resolution/server.ts), `resolveClientIdentityV2` | Shared resolver chỉ đọc có sẵn; không gọi resolve-or-create để thử preview. Resolver hỗ trợ manager không có nghĩa manager được confirm import. |
| [Migration 228](../../../supabase/migrations/228_add_transactional_client_sample_cutover.sql), `resolve_and_lock_accession_client_v2_228` (dòng 124), `accession_and_assign_tests_with_client_resolution_v2` (dòng 416); [231](../../../supabase/migrations/231_enforce_client_canonical_integrity.sql) | Transactional client/sample cutover và canonical-integrity enforcement là baseline tái sử dụng; không dùng legacy upsert để né conflict. |
| [Audit baseline](../../../supabase/migrations/002_audit_triggers.sql), [scoped audit RLS](../../../supabase/migrations/077_tighten_audit_logs_rls.sql) | Business mutations có audit theo entity; import cần thêm batch correlation và audit thất bại. Không giả định policy lịch sử đã bao phủ bảng import mới. |

Giữ thuật ngữ nghiệp vụ trong [CONTEXT.md](../../../CONTEXT.md): khách hàng xét nghiệm → mẫu xét nghiệm → chỉ định xét nghiệm.
**Batch/attempt** là một lần upload được server cấp UUID; preview thuộc đúng attempt đó. Retry sau lỗi terminal là attempt mới liên kết attempt trước.
**Preview commitment** là hash và bindings server đã xác minh, không phải bản sao đầy đủ dữ liệu file.
**Payload chuẩn hóa** là ý định nhập sau quy tắc #112; không chứa timestamp tiếp nhận do client gửi hoặc quyết định sửa danh tính.
**Provenance** là chứng cứ batch và ánh xạ vị trí nguồn sang entity; hash chứng minh đối chiếu khi còn file gốc, không khôi phục nội dung file.

## 2. Lựa chọn giải quyết preview bất biến và không lưu payload

| Phương án | Đánh đổi |
| --- | --- |
| **Đã chọn: giữ commitment, gửi lại cùng file khi confirm** | Server không persist workbook/full normalized payload. Browser giữ file đã chọn trong bộ nhớ; confirm tự gửi lại file đó, không thêm thao tác chọn file khi còn trang. Server tái parse và đối chiếu commitment trước transaction. Mất file/tab thì preview mới. |
| Giữ toàn bộ normalized payload 30 phút | Đơn giản lúc confirm nhưng vẫn là lưu toàn bộ payload; không phù hợp invariant #108, kể cả mã hóa hoặc gọi là cache. Không chọn. |
| Giữ payload chỉ trong RAM server 30 phút | Vẫn giữ full payload, mất preview khi restart và khó bảo đảm nhiều instance. Không chọn. |

Đây là **lựa chọn đã được duyệt ở #113**; #108 vẫn không cho phép lưu tạm toàn bộ payload.
Workbook chỉ tồn tại trong bộ nhớ xử lý request upload/confirm và browser đang dùng. Không ghi Storage, filesystem tạm, DB, cache, log, tracing body, error report hoặc backup.
Full normalized object cũng chỉ tồn tại khi xử lý request/transaction; không serialize vào bảng preview hay job queue.
Nếu multipart/runtime không thể tránh disk spool thì chưa đạt contract; phải thay đường upload hoặc xin đổi quyết định trước triển khai.
Preview hiển thị chỉ sống trong response/browser; tải lại trang chỉ lấy metadata/trạng thái, không tái dựng PII preview từ server.
Hash của file confirm phải bằng file upload **theo byte**; file bị lưu lại bởi Excel dù không đổi ô cũng cần attempt mới.
Đối chiếu file/hash không thay validation/catalog/resolver tại confirmation. Server không tin normalized payload hoặc UUID client gửi lên.

## 3. Durable batch và vòng đời

Các tên logic dưới đây không bắt buộc tên SQL. Server tạo batch trước khi xử lý nội dung, sau authentication và kiểm tra request envelope.
Request không đăng nhập/bị chặn trước khi nhận file không được phép tạo batch dưới actor giả; security telemetry riêng chỉ giữ reason/request ID.

| Trạng thái durable | Ý nghĩa; chuyển tiếp hợp lệ |
| --- | --- |
| `preparing` | Đã cấp attempt và actor, chưa có preview hợp lệ. Chỉ → `preview_ready`, `rejected`, `failed`; request bị bỏ dở được recovery → `failed`. Không có business rows. |
| `preview_ready` | Parse/validate/resolver thành công, commitment đã seal. Chỉ → `succeeded`, `failed`, `expired`; không cập nhật nội dung preview. |
| `rejected` | Upload không hợp lệ/đã trùng thành công; terminal, không có business rows. |
| `failed` | Confirm bị từ chối vì drift, quyền, lỗi transaction, hoặc preparation không hoàn tất; terminal, không có business rows. |
| `expired` | Chưa được chấp nhận confirm trước deadline; terminal, không có business rows. |
| `succeeded` | Toàn bộ business rows, provenance, idempotency claim và audit đã commit; terminal. Không chuyển ngược dù entity sau này bị void/soft-delete. |

Không cần durable `confirming`: confirm giữ row lock batch trong một DB transaction; API có thể báo đang xử lý khi lock còn bận.
Terminal state không được reset/reuse. Retry tạo UUID mới với `retry_of_batch_id` cùng actor; server kiểm tra liên kết tồn tại và quyền đọc.
TTL tính `expires_at = preview_created_at + 30 phút` bằng giờ DB, không từ giờ tạo template/upload/browser.
`now >= expires_at` là hết hạn. Kiểm tra sau khi lấy locks và ngay tại điểm chấp nhận xác nhận trước business writes; request chờ lock có thể hết hạn.
Transaction đã được chấp nhận khi còn hạn có thể commit sau deadline; cleanup không được cướp lock hoặc tự tuyên bố expired khi transaction còn chạy.
Không kéo dài TTL khi reload, retry HTTP hoặc gặp lock contention. Deadline/commitment/bindings/actor đã seal là bất biến.

| Dữ liệu durable tối thiểu | Quy tắc |
| --- | --- |
| `batch_id`, `actor_id`, `retry_of_batch_id`, `status` | Actor từ session xác thực; client không được đặt owner/status. |
| `created_at`, `preview_created_at`, `expires_at`, `confirmation_received_at`, `finished_at` | Giờ server; timestamp chưa xảy ra là null. `confirmation_received_at` chỉ có giá trị receipt chính thức khi thành công. |
| `source_sha256`, `source_size_bytes` | SHA-256 byte workbook do server tính; không dùng filename làm nhận diện, không lưu filename vì có thể chứa PII. Có thể null nếu upload bị ngắt trước khi hash xong. |
| `normalized_payload_hash`, `canonicalization_version` | Hash do server tính theo phần 7; null nếu chưa chuẩn hóa đầy đủ. |
| `template_id/version`, descriptor ID/digest, compatibility revision, resolver/validation contract version | Bind đúng hợp đồng đã dùng; không chỉ lưu nhãn “hiện hành”. |
| Counts | Số dòng client/sample/assignment đã validate; khi thành công thêm created/reused clients, created samples/assignments. Chưa biết là null, không giả bằng 0. |
| Safe outcome | Reason code, sheet/row/column và counts; không lưu `temporaryReference` do người dùng nhập, kể cả ref đúng định dạng. Không raw cell, tên, DOB, giấy tờ, điện thoại, SQL exception/detail hoặc stack trong batch/history. |
| Audit/correlation IDs | Liên kết lifecycle và entity audit, duplicate successful batch nếu người đọc có quyền; không ghi nguyên request/response. |

Bindings riêng chỉ được dùng để nhận confirm mới trước deadline và khi chưa terminal: row/ref graph, code→canonical UUID/generation/method, client outcome (`matched`/`not_found`), matched UUID và keyed fingerprint của các trường quyết định resolution. Đây là dữ liệu preview có kiểm soát quyền, tách khỏi log lỗi; thời điểm purge vật lý theo phần 8.
Fingerprint do server tạo bằng HMAC-SHA-256 với key riêng chỉ server/DB biết, có key version và domain `lims-lite:bulk-accession:client-binding:v1`; input canonical bao gồm batch ID, row locator, outcome, matched UUID/null và dữ liệu decision/display đã nêu. Không lưu hash trần của CCCD/DOB/phone để tránh dò từ không gian giá trị nhỏ.
Giữ thêm digest của toàn bộ binding set trong metadata durable; không giữ các giá trị định danh đầu vào bên trong binding.
Đối với client `matched`, fingerprint bao phủ dữ liệu canonical dùng matching và các giá trị existing được trình bày để reuse; với `not_found`, kết quả absence được kiểm tra lại khi confirm.

## 4. Preview và confirmation

Upload kiểm tra quyền analyst, envelope/file limits, template/descriptor, toàn bộ quy tắc #112 và shared client resolver chỉ đọc; mọi lỗi từ chối toàn lô.
Preview không tạo client, sample, result/assignment; chỉ ghi batch/bindings/audit đã làm sạch.
Chỉ seal `preview_ready` sau khi có đủ hash, bindings, counts và preview response nhất quán. Không cho confirm một attempt còn `preparing`.
Preview phân biệt reuse/create; chỉ rõ optional fields của matched client không được cập nhật.

Confirm nhận `batch_id` và file gốc, xác thực lại analyst/owner; server reparse file, so SHA-256, chuẩn hóa lại và so hash với commitment.
File hoặc payload khác → `failed` với `PREVIEW_CONTENT_CHANGED`; không sửa preview theo file mới. Muốn sửa bất kỳ ô nào phải upload attempt mới.
Không nhận `received_at`, owner, resolved IDs hoặc trạng thái từ client làm authority.

**Một transaction DB duy nhất** bao gồm:

1. Lock batch; kiểm tra trạng thái, owner/role, deadline và commitment từ đường server tin cậy. `succeeded` trả receipt cũ sau authorization; terminal khác yêu cầu attempt mới.
2. Đồng bộ với các catalog publishers/client writers có liên quan: khóa revision/generation và canonical client keys/rows theo thứ tự ổn định. Recheck version support, published revision không null, descriptor/bindings, active entities, methods, pairs và generation. Revision đổi dù pair đang dùng giống nhau vẫn fail theo #112.
3. Rerun shared resolver trong cùng boundary, với mọi input đã tái xác minh. So outcome, matched UUID và fingerprint; `not_found`→`matched`, UUID đổi, conflict/ambiguous/restricted, deleted client hoặc reuse→create đều là drift, không tự chuyển kế hoạch. Các dòng trong cùng batch cũng phải qua duplicate/identity guards #111/#112.
4. Lấy một giá trị giờ DB tại điểm chấp nhận confirm, sau locks/validation; dùng chung làm `received_at` cho mọi sample và receipt batch, `received_by = actor_id`. Lưu UTC; UI theo timezone lab đã cấu hình. Chỉ `acceptable` quality; không cho per-row override.
5. Claim dedup key bằng DB uniqueness theo phần 7; tạo clients thực sự mới, samples hoàn toàn mới và assignments/results thuộc đúng samples đó. Không thêm assignment vào sample có sẵn; không overwrite/fill-null client cũ. Không gọi nhiều RPC đơn mẫu rồi bù trừ.
6. Ghi row-to-entity mappings, business audit correlation, batch success receipt/counts và lifecycle audit cùng transaction. Chỉ trả thành công sau commit.

Một lỗi ở bất kỳ bước nào, kể cả mapping/audit/idempotency, phải rollback **mọi** client/sample/assignment và claim mới của attempt.
Khoảng trống sequence ID sau rollback được phép; không phải entity tồn tại và không tái sử dụng ID để che khoảng trống.
Catalog/client writer khác không được chen thay đổi giữa recheck và commit; implementation phải chứng minh khóa/constraint hoặc isolation phù hợp, không chỉ recheck trước gọi RPC.
Đường DB confirm không được nhận arbitrary normalized JSON từ authenticated user rồi bỏ qua kiểm tra source/commitment: chỉ boundary server được cấp đặc quyền đưa dữ liệu đã verify, kèm actor đã ràng buộc; DB vẫn tự kiểm tra role/owner/state/hash/bindings/catalog/resolver.
Nếu dùng privileged server credential thì không cấp DB chức năng confirm trực tiếp cho browser, không tin actor trong body, và không dựa vào service-role bypass RLS thay authorization.

## 5. Thất bại, retry và đồng thời

| Tình huống | Kết quả bắt buộc |
| --- | --- |
| Hai confirm cùng batch | Row lock serialize; bên sau nhận cùng receipt nếu bên đầu commit, không tạo thêm rows. Nếu bên đầu failed, trả terminal failure. |
| Hai batch cùng normalized hash, khác file/actor | DB unique successful claim serialize. Tối đa một batch commit; batch thua `failed/ALREADY_IMPORTED`, không có business rows. Không lộ UUID/mapping của batch thắng cho actor thiếu quyền. |
| Browser/network timeout hoặc mất response | **Chưa biết kết quả**, không đánh dấu failed bằng timeout phía HTTP. Đọc status bằng `batch_id`; `succeeded` lấy receipt cũ. Nếu transaction còn lock, báo đang xử lý/cho tra cứu lại. |
| Lỗi DB có kiểm soát | Business writes chạy trong rollback boundary/savepoint; sau rollback ghi `failed` và safe audit ở outer transaction. Không nuốt lỗi rồi commit rows dở. |
| Crash/DB disconnect trước commit, không kịp lưu failure | DB rollback; batch vẫn `preview_ready`, không có claim/rows. Recovery chỉ kết luận sau khi lấy được batch lock và kiểm tra trạng thái/receipt; ghi failure nếu xác định request đã chết, hoặc owner có thể gửi lại cùng confirm khi còn hạn. |
| Crash sau commit | Batch, dedup claim, mappings và audit đều đã durable; lookup trả `succeeded`, không chạy lại business action. |
| Deadlock/serialization/lock timeout đã biết rollback | Ghi safe failure nếu kết nối còn dùng được; nếu chưa xác định thì lookup/recovery như trên. Attempt terminal phải retry bằng attempt mới; không tự replay write mù. |
| Preview hết hạn hoặc server restart | Preview vẫn có commitment durable tới deadline, không phụ thuộc RAM server. File phải còn ở browser để confirm; hết hạn thì attempt mới. |
| Client/catalog drift, mất role, unacceptable quality | Fail closed toàn lô; giữ safe reason, yêu cầu preview mới sau khi xử lý nguyên nhân; manager không được thay analyst confirm. |

HTTP retry của cùng confirm chưa có kết quả xác định không phải attempt nghiệp vụ mới. Chỉ terminal failure/rejection/expiry mới bắt buộc linked attempt mới.
Với endpoint đã trả terminal thành công, lặp confirm chỉ là đọc receipt; không gia hạn TTL hoặc tạo audit giả như đã tiếp nhận lần nữa.
Lookup không cần gửi lại file; trả trạng thái/receipt đã commit. Khi chưa commit tuyệt đối không trả official IDs dự kiến.
Nếu mất file sau timeout: vẫn lookup trước; success lấy receipt không cần file. Nếu còn `preview_ready` và không có transaction đang chạy, không thể confirm từ metadata: chọn lại đúng byte file gốc hoặc tạo linked attempt mới; không tái dựng payload trên server. Nếu kết quả còn chưa xác định thì tiếp tục lookup, không upload mới để đoán kết quả.
Chưa chốt timeout HTTP/DB/locks hay nhịp polling cứng: [TASK-7](../../../backlog/tasks/task-7%20-%20Nghiem-thu-capacity-va-atomicity-import-thuc.md) phải đo runtime và đặt chúng trong dung lượng đã chứng minh (chuyển từ #114 theo quyết định 2026-11-02); timeout không làm đổi invariants trên.

## 6. Authorization, RLS và audit

- Upload, preview contents và confirm: analyst hiện hành, đúng `actor_id`. Manager chỉ xem lịch sử được phép, không xác nhận hoặc nhận quyền sở hữu preview.
- Status/receipt/mapping: analyst xem batch của mình; manager xem lịch sử theo quyền nghiệp vụ hiện hành. Chi tiết entity tuân theo confidentiality/RLS hiện có; batch history không trở thành đường vòng lộ khách hàng/mẫu bị hạn chế.
- Quyền được kiểm tra lại trong DB khi confirm; role bị thu hồi giữa preview và confirm phải bị chặn. UUID batch khó đoán không thay access control.
- Không cấp INSERT/UPDATE/DELETE trực tiếp bảng batch/bindings/mapping/claim cho browser. Chỉ entrypoints được giới hạn thao tác; SECURITY DEFINER nếu cần phải fixed search_path, schema-qualified objects, least privileges, revoke public/anon và role checks rõ ràng.
- App dùng `src/lib/api-client.ts` theo repo convention; không import trực tiếp server actions vào client. DB enforcement không chỉ dựa vào nút bị ẩn.
- Lifecycle audit: created, preview_ready/rejected, confirm accepted→succeeded hoặc failure, expired/recovery và binding cleanup; actor, server time, batch ID, safe reason/counts/hash, correlation ID. Tránh ghi sự kiện accepted riêng ở ngoài transaction khiến audit tuyên bố thành công trước commit.
- Business audit cho mọi entity tạo mới giữ cơ chế compliant hiện hành, liên kết về batch; batch audit không nhân bản PII/full payload. Audit business values theo chính sách có sẵn không phải kho lưu workbook.
- Failure audit sống ngoài rollback của business subtransaction. Nếu toàn bộ DB unavailable thì không thể hứa đã lưu audit: không trả thành công, giữ batch để recovery, phát telemetry không PII; recovery ghi sự kiện thiếu kết quả khi DB trở lại.
- Không hard-delete/void tự động business rows để bù trừ lỗi import. Sửa sau thành công dùng workflow auditable hiện có; dedup claim không bị xóa khi sample bị void.
- Đây là hành động nghiệp vụ có audit, **không phải chữ ký điện tử**: không thêm OTP/signature semantics.

## 7. Hash và idempotency

`source_sha256 = SHA-256(raw workbook bytes)` phục vụ xác minh nguồn; cùng byte không phải tiêu chí dedup duy nhất.
`normalized_payload_hash = SHA-256(UTF-8("lims-lite:bulk-accession:intent:v1\n" + canonical import intent))`, biểu diễn digest là 64 ký tự hex lowercase; `\n` ở đây là đúng một byte LF `0A`, không phải hai ký tự backslash/n.
`canonicalization_version = accession-intent-v1` là contract độc lập template version/catalog revision; prefix trên phân miền và khóa phiên bản thuật toán.
Canonicalization chạy server-only sau validation #112, không dùng JSON stringify tùy ý theo thứ tự object nhận được.

Quy tắc `accession-intent-v1`:

1. Mọi field dùng giá trị normalized theo #112 và canonical client normalizers hiện có: name theo `normalize_client_name_v1` (NFC, trim/collapse whitespace, ICU lowercase giữ dấu), typed identity, phone chuẩn đầu `0`, ISO date, enum/null. [Định nghĩa normalizers](../../../supabase/migrations/215_add_client_canonical_foundation.sql) ở dòng 439/463/486 là authority; không tự viết gần giống rồi làm lệch resolver. Không bỏ dấu tên, làm mất số 0 đầu hoặc tự sửa input invalid. Field optional không có biểu diễn bằng JSON `null`, không `undefined`/empty string.
2. Biểu diễn một client block bằng tuple có thứ tự cố định: name, DOB, identity type/value, gender, phone, address, BHYT, expiry date; kèm danh sách sample blocks thuộc client đó. Đây là **input chuẩn hóa** kể cả field optional bị bỏ qua khi reuse, không phải snapshot entity sau ghi DB.
3. Sample block là tuple sample-type business code, `acceptable`, danh sách assay import codes đã sort; method được bind bởi assay code như #109/#112, không cho method name/UUID tự nhập. Giữ multiplicity của các sample blocks giống nhau vì đó có thể là nhiều mẫu thật; không tự dedup samples.
4. Sort assignment codes, serialized sample blocks và serialized client blocks đều theo UTF-8 byte lexicographic order. Root là array client blocks; client block là 9 scalar fields theo thứ tự bước 2 rồi sample-block array ở vị trí thứ 10. Serialize bằng ECMAScript `JSON.stringify` trên tuple arrays, UTF-8 không BOM, không newline cuối, không object keys; Unicode hợp lệ giữ nguyên, không thêm ASCII-only escaping. Input có unpaired surrogate bị từ chối. Giữ multiplicity client blocks và áp dụng duplicate-client rejection #112 trước hash.
5. Loại trừ refs tạm, sheet row order/formatting, filename, catalog-sheet display labels, descriptor/revision/generation, template version, actor, batch ID, resolver outcome/UUID và `received_at`. Graph client→samples→assignments vẫn được giữ bằng cấu trúc lồng nhau; không sort ba sheet độc lập làm mất quan hệ.

Vì vậy đổi ref, đảo dòng, đổi filename hoặc metadata catalog mới không lách dedup; upload lại cùng input sau khi client vừa được tạo vẫn cho cùng hash dù resolver nay trả `matched`.
Không hứa nhận diện hai file có dữ liệu nghiệp vụ khác nhau nhưng tình cờ tạo cùng kết quả. Đổi input thực sự cho hash khác; validation/identity guards vẫn áp dụng.
Phạm vi uniqueness: toàn LIMS hiện tại, mọi analyst, suốt vòng đời dữ liệu; không chỉ theo actor/30 phút/source hash. Không có nút force-import bỏ qua thành công trước.
Chỉ claim của **success** chặn lâu dài; failed/rejected/expired không giữ quyền chặn input. Claim được tạo và success cùng transaction; DB unique constraint/serialized guard là authority, precheck API chỉ để phản hồi sớm.
Canonicalization version không phải lối thoát dedup: không đổi thuật toán v1 âm thầm. Version mới phải duy trì tính hash tương thích cho mọi successful intent cũ hoặc có thiết kế chuyển tiếp được duyệt riêng trước bật; không tự namespace uniqueness theo version rồi cho nhập lại.
Hash và fingerprint chỉ ở server/protected metadata; không public endpoint dò hash có nhập hay chưa. SHA-256 digest không được xem là dữ liệu vô danh.

Vector kiểm tra serialization/hash độc lập parser/catalog: tên hiển thị `An` đã normalized thành `an`; `ST-DEMO` là mã giả phục vụ vector, không khẳng định catalog có mã này. Chạy bằng Node stdlib:

```sh
node <<'NODE'
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const canonical = JSON.stringify([['an','2000-01-01',null,null,'Nam','0901234567',null,null,null,[['ST-DEMO','acceptable',['CT-000001']]]]]);
const hash = createHash('sha256').update('lims-lite:bulk-accession:intent:v1\n' + canonical, 'utf8').digest('hex');
assert.equal(hash, '090da05ce3b97394845d98b5d3fde180f150b3d452b5f067155466859a4e908e');
console.log('PASS accession-intent-v1 hash vector');
NODE
```

## 8. Provenance, kết quả và retention

Success ghi mapping trong cùng transaction, đủ cho mỗi dòng nghiệp vụ ở ba sheet:

| Dòng nguồn | Mapping durable |
| --- | --- |
| `Khách hàng` | sheet ID, row number, client temp ref, canonical client UUID, outcome created/reused |
| `Mẫu` | sheet ID, row number, sample temp ref, parent client temp ref/UUID, new sample UUID và official sample identifier |
| `Chỉ định` | sheet ID, row number, parent sample temp ref/UUID, assay import code, canonical assay/method UUID, new assignment/result UUID |

Mappings thuộc batch, bất biến và unique theo vị trí nguồn; không nhân bản các field name/DOB/identity/phone/address hoặc raw cell/normalized row. Ref do người dùng chọn vẫn có thể chứa PII dù đúng định dạng, nên provenance mappings phải được bảo vệ như dữ liệu nghiệp vụ nhạy cảm.
Chỉ success provenance mappings và transient preview bindings được giữ ref đã validate theo #112 để liên kết dòng. Không đưa raw temp ref vào batch failure outcome, error log, audit lỗi hoặc telemetry, kể cả ref hợp lệ; đây là boundary riêng với UI response theo #112.
Entity bị soft-delete/void về sau không xóa mapping/receipt. Kết quả tải theo yêu cầu từ mappings + DB current state, phân biệt receipt lúc nhập và trạng thái hiện tại; không tuyên bố tái tạo workbook nguồn.
Lỗi có sheet/row/column/code/message/ref trong response đủ sửa file; `callerContext`/ref chỉ ở ephemeral UI response. Server chỉ giữ sheet/row/column/code/count và context vận hành không chứa raw ref/PII; không persist nguyên response lỗi. Error workbook nếu có sinh theo yêu cầu khi còn request/browser data, không lưu server.
File kết quả chỉ được sinh từ DB sau success và kiểm tra quyền hiện tại; không dựa vào payload đã purge. Download không làm đổi receipt.

| Dữ liệu | Thời gian/cleanup |
| --- | --- |
| Workbook/full normalized payload | Không lưu durable; giải phóng bộ nhớ request ngay khi xong, không cache/recovery từ server. |
| Preview bindings/fingerprints chi tiết | Hard logical expiry đúng `expires_at` sau 30 phút: không nhận confirm mới từ thời điểm này. Terminal hoặc deadline làm bindings eligible để purge khi lock-safe; transaction đã được chấp nhận trước deadline vẫn được hoàn tất. Physical purge có thể trễ vì row lock/DB outage; authorization/expiry vẫn chặn dùng lại, không gia hạn TTL. |
| `preparing` bỏ dở | Recovery có lease/heartbeat metadata không payload; chỉ đánh dấu failed sau khi xác nhận request không còn hoạt động. Ngưỡng cụ thể phải khớp timeout runtime được đo ở TASK-7. |
| Batch metadata, binding digest, audit, success mappings và dedup claim | Giữ durable, không TTL tự động trong MVP. Retention pháp lý/archival tương lai cần quyết định riêng; cleanup preview không xóa lịch sử hoặc mở đường nhập lại. |

Cleanup là tác vụ privileged nhỏ, lock batch trước quyết định, idempotent, chỉ purge bindings đã không còn dùng được và ghi audit count/time. Không hủy/đổi expired cho transaction đã được chấp nhận trước deadline; chờ commit/rollback rồi xử lý terminal state tương ứng.
Chưa có bằng chứng để hứa physical purge đúng phút thứ 30. Purge SLO, retry/recovery budget và lịch chạy phải được đo/chốt ở TASK-7; khi DB phục hồi phải quét các bindings quá hạn còn lại, không chỉ xử lý deadline mới.
Không ghi PII đã purge vào audit cleanup; không xóa batch/audit để giải quyết lỗi kỹ thuật. Không cần giữ workbook để chạy recovery.

## 9. Các tình huống phải chứng minh khi triển khai

Đây là acceptance scenarios, chưa phải test/runtime evidence của #113:

1. Upload hợp lệ chỉ tạo preview metadata; bad row bất kỳ không có client/sample/assignment mới.
2. Lỗi sau client đầu, sample giữa lô, assignment cuối, mapping và audit đều rollback toàn lô; audit failure vẫn còn khi DB hoạt động.
3. Hai confirm cùng batch và hai batch hash giống nhau chỉ có một success; khác actor không lộ receipt của nhau.
4. Timeout trước/sau commit tra cứu được kết quả chính xác; crash không để claim thành công thiếu business rows hoặc ngược lại.
5. File đổi byte, payload đổi, owner khác, role bị thu hồi, hết hạn tại thời điểm lấy lock đều không ghi business rows.
6. Catalog publish/generation change và client matching drift trong lúc confirm được serialize/reject; không âm thầm reuse↔create hoặc overwrite identity.
7. Mọi sample cùng `received_at` do DB cấp, acceptable, assignments thuộc samples mới, mọi source row có mapping đúng.
8. Canonicalization vectors: đảo dòng/đổi ref/name file không đổi hash; đổi quan hệ client–sample hoặc multiplicity làm đổi hash; cùng file sau client-create vẫn trùng hash; giữ leading zero, ISO/null/Unicode đúng contract.
9. Cleanup/restart/expiry không xóa receipt/dedup/audit, không lộ preview cho analyst khác/manager, không có workbook/full payload trong disk/cache/log/DB/backups.

## 10. Quyết định #113 và ranh giới tiếp theo

Người dùng đã duyệt #113 ngày 2026-11-01, gồm: commitment-only preview + gửi lại file khi confirm; state machine/atomic transaction; confirmation-time server receipt; dedup toàn LIMS bằng canonical input; safe metadata/mappings/audit retention và cleanup ở trên.
Xác nhận nguyên văn: “duyệt”. TASK-2 hoàn tất ở phạm vi quyết định, với liên kết hợp đồng và kết quả review/verification được ghi vào #113. Chưa có implementation hoặc runtime evidence cho atomic bulk import.
Quyết định người dùng 2026-11-02 thay giả thuyết caps #108: chỉ file **<10.000.000 bytes** (10 MB decimal), không có count caps nghiệp vụ. 500/1.000/20.000 chỉ còn là fixture lịch sử. #114/TASK-3 kiểm chứng prototype local theo [bằng chứng hiện hành](2026-11-02-import-file-limit-evidence.md); TASK-7 nhận nghĩa vụ runtime/DB/HTTP/end-to-end, timeouts, lock budgets, memory/transfer costs (gồm upload lại lúc confirm).
#115 mới phân chia dependency-safe OpenSpec changes; #113 không tạo whole-feature OpenSpec, implementation plan hay SQL/API/parser/UI.
Nếu runtime không thể đáp ứng no-payload-retention, atomicity hoặc phòng vệ tài nguyên trong phạm vi file đã duyệt, mang trade-off cụ thể quay lại quyết định; không âm thầm đổi invariant hoặc thêm count caps. Size pass không bảo đảm workbook hợp lệ hoặc xử lý an toàn mọi file.
