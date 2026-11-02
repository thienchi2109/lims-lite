# TASK-3 / #114 — bằng chứng capacity prototype

> **Hồ sơ lịch sử, đã được thay thế ngày 2026-11-02:** người dùng chọn file
> **<10.000.000 bytes**, bỏ count caps nghiệp vụ. Kết luận 10 MiB, COUNT_LIMIT
> và AC bên dưới mô tả lần đo cũ; JSON cũ giữ nguyên. Xem
> [quyết định và bằng chứng hiện hành](2026-11-02-import-file-limit-evidence.md).
> Nghĩa vụ DB/HTTP/end-to-end chuyển sang
> [TASK-7](../../../backlog/tasks/task-7%20-%20Nghiem-thu-capacity-va-atomicity-import-thuc.md);
> chúng chưa được chứng minh bằng prototype.

Trạng thái: **INCOMPLETE**, chỉ prototype Node CLI cục bộ, dữ liệu tổng hợp.
Không phải parser/generator template sản phẩm hoặc bằng chứng home server.

## Tiêu chí khai báo trước khi đo (2026-11-02)

Các budget dưới đây do người viết benchmark chọn để sàng lọc prototype,
không phải SLO được phê duyệt hoặc cap production. Mỗi case chạy trong
process mới, ba lần; báo min/median/max, không gọi ba mẫu là p95.

| Phạm vi | Budget sàng lọc |
| --- | --- |
| Parse XLSX | tối đa 2.000 ms mỗi lần |
| Validate trong bộ nhớ, chưa resolver | tối đa 1.000 ms mỗi lần |
| Dựng/serialize preview trong bộ nhớ, chưa durable commitment | tối đa 1.000 ms mỗi lần |
| Tổng ba stage | tối đa 4.000 ms mỗi lần |
| Peak RSS toàn child process | tối đa 512 MiB; V8 old-space 384 MiB |
| Watchdog toàn child, gồm startup/đọc file, không gồm generation ở parent | 30.000 ms; kill không được báo preview thành công |
| Guard thử nghiệm | 10 MiB ZIP, 32 MiB declared inflated bytes, 256 ZIP entries, 160.000 declared cells |
| Số lượng thử nghiệm | 500 clients / 1.000 samples / 20.000 assignments, **vẫn provisional** |

Nguồn config app có limit 1 GiB/1 CPU (`docker-compose.yml`); chưa xác minh
runtime deployed. Dành 512 MiB cho một CLI process không chứng minh app chịu
được một request hay nhiều request đồng thời. `next.config.ts` chưa override
`serverActions.bodySizeLimit`; upload/multipart, upload lại lúc confirm, proxy,
Next.js request limits và concurrency đều chưa đo.

DB gate đề xuất cho lần đo được cấp quyền sau: commit <= 5.000 ms, lock wait
<= 1.000 ms, `statement_timeout` 10.000 ms; tối đa một connection/confirm;
zero business rows/claims sau rollback; repeat confirm trả đúng receipt và
không thêm rows; zero deadlock trong case đơn luồng. Phải đo DB CPU/RSS, WAL
bytes, row/audit counts, connections, locks/deadlocks và disk trên baseline cùng
batch/actor. CPU/RSS/WAL budget phải được chốt từ baseline **trước** đánh giá
pass/fail tài nguyên DB; hiện chưa có baseline để chọn budget có căn cứ.
Đây là tiêu chí đề xuất trước phép đo DB, chưa được vận hành hoặc chứng minh.
Môi trường DB tương lai phải là home server hoặc môi trường disposable được
cấp quyền rõ ràng; ghi PG/image version, CPU/RAM limits, cardinality dữ liệu,
RLS/audit triggers, actor, catalog revision/generation và concurrency trước đo.

Matrix gồm normal, tăng độc lập từng chiều, combined boundary, mỗi chiều +1,
độ nén cao/thấp, kích thước file/inflated/entry vượt guard, dữ liệu invalid tại
cuối batch và watchdog. Không giữ workbook hoặc payload; chỉ metrics tổng hợp.

## Kết quả

**PASS_LOCAL** cho 45 trials (15 cases × 3 process mới), hoàn tất lúc
`2026-11-02T01:42:39.439Z`. Không có DB/HTTP/application benchmark.
Raw metrics không chứa workbook/payload:
[2026-11-02-import-capacity-results.json](2026-11-02-import-capacity-results.json).

Môi trường: Linux x64, Node `v20.20.2`, SheetJS `0.20.3`, TypeScript `5.9.3`,
QEMU Virtual CPU version 2.5+, 4 logical CPUs/available parallelism 4,
host RAM 7.961,70 MiB. Đây không phải phép đo bị giới hạn 1 CPU/1 GiB;
không đổi config host/container để giả lập production. Các child chạy tuần tự;
không chạy test/build đồng thời. Không có CPU pinning hoặc kiểm soát tải host.
Không suy từ ba lần đo sang p95, concurrency hoặc sustained throughput.

Timings dưới đây là **min / median / max**, đơn vị ms; RSS là high-water lớn
nhất trong ba child, đơn vị MiB. Mỗi child có `--max-old-space-size=384`;
512 MiB RSS là tiêu chí quan sát, không phải hard limit OS.

| Case (clients/samples/assignments) | Parse | Validate | Preview | Peak RSS |
| --- | --- | --- | --- | --- |
| Normal 10/20/100 | 23,43 / 23,52 / 30,01 | 5,15 / 6,65 / 10,79 | 0,44 / 0,56 / 0,56 | 133,63 |
| Clients 500/500/500 | 113,17 / 114,58 / 126,82 | 17,20 / 19,12 / 22,12 | 0,96 / 1,12 / 2,25 | 154,12 |
| Samples 10/1.000/1.000 | 73,10 / 82,40 / 85,33 | 8,14 / 17,17 / 17,85 | 1,56 / 1,62 / 2,38 | 152,24 |
| Assignments 10/1.000/20.000 | 278,31 / 297,49 / 309,30 | 55,61 / 75,29 / 90,39 | 10,40 / 11,24 / 14,71 | 161,46 |
| Combined 500/1.000/20.000 | 321,65 / 331,86 / 351,73 | 66,85 / 69,79 / 91,88 | 10,06 / 10,25 / 13,01 | 161,96 |
| Combined + 8M repeated chars | 411,16 / 444,60 / 479,05 | 78,10 / 91,23 / 101,14 | 6,63 / 12,57 / 13,39 | 187,59 |
| Combined + 8M entropy chars | 624,78 / 741,21 / 765,22 | 86,52 / 96,22 / 108,10 | 7,77 / 8,76 / 8,84 | 198,97 |

Fixture baseline combined: 743.991 ZIP bytes, 2.340.193 declared inflated bytes,
17 entries. Repeated-padding case: 820.768 / 10.353.341 bytes (ZIP / inflated);
entropy-padding: 9.973.167 / 12.134.506 bytes. Cùng số business rows nhưng độ nén
và dung lượng khác nhau. Các phần padding chỉ là hướng dẫn tổng hợp, không phải
PII hoặc nội dung template được server ký. Preview JSON combined là 337.743
bytes; đây chỉ là summary theo sample, không phải full response/payload sản phẩm.

| Case lỗi, mỗi case 3 lần | Kết quả quan sát |
| --- | --- |
| 501 clients, giữ 1.000 samples/20.000 assignments | `COUNT_LIMIT` sau parse, không dựng preview |
| 1.001 samples, giữ 500 clients/20.000 assignments | `COUNT_LIMIT` sau parse, không dựng preview |
| 20.001 assignments, giữ 500 clients/1.000 samples | `COUNT_LIMIT` sau parse, không dựng preview |
| Tham chiếu mẫu sai ở assignment cuối boundary | `INVALID_ASSIGNMENT`, không dựng preview |
| 13.432.629 ZIP bytes | `FILE_LIMIT` trước parse |
| 1.070.186 ZIP / 36.396.965 declared inflated bytes | `INFLATED_LIMIT` trước parse |
| 277 entries | `ENTRY_LIMIT` trước parse |
| Boundary parse xong rồi cố ý treo | parent kill sau 2.000 ms, xác nhận `PARSE_COMPLETED`, không có preview output |

Watchdog injection dùng 2 giây để kiểm tra cơ chế kill, không phải đề xuất timeout
sản phẩm. Guard không truncate dòng hoặc trả preview một phần. Các trường hợp
COUNT_LIMIT vẫn cần parse full workbook trước khi đếm. RSS không thu được từ
child bị SIGKILL; không điền số 0 làm bằng chứng memory cho case đó.

Điều phối chạy độc lập cùng lệnh benchmark, kết thúc
`2026-11-02T01:44:22.686Z`, exit 0: 15 cases/45 trials cùng outcome và local
budgets đều đạt. Combined max parse/validate/preview = 323,03 / 99,48 / 12,36 ms,
peak 163,29 MiB; entropy max = 698,68 / 101,25 / 10,92 ms, peak 199,06 MiB.
Điều phối cũng chạy lại focused checks: 6/6 PASS. Đây vẫn là bằng chứng CLI
cùng môi trường local, không mở rộng sang application hoặc home server.

## Cách chạy lại

Tại checkout có dependencies sẵn, dùng `node` trực tiếp. Trong worktree này tái
sử dụng dependencies đã cài ở source checkout, không install hoặc symlink:

```bash
rtk proxy env NODE_PATH=/root/lims-lite/node_modules node --test tests/import-capacity-prototype.test.mjs
rtk proxy env NODE_PATH=/root/lims-lite/node_modules node scripts/benchmark-import-capacity.mjs --output=/tmp/lims-import-capacity-results.json
rtk proxy env NODE_PATH=/root/lims-lite/node_modules node scripts/benchmark-import-capacity.mjs --case=combined-boundary --repetitions=3
```

`--case` chỉ nhận case có sẵn; `--repetitions` là integer 1–10. Exit code khác 0
nếu outcome sai kỳ vọng hoặc accepted case vượt local timing/RSS budgets.
File tổng hợp được tạo trong thư mục tạm riêng (permission 0600), xóa bằng
`finally` kể cả child timeout; output chỉ có counts/metrics/code lỗi an toàn.
Parent generation không nằm trong timings hoặc RSS child. Thư mục tạm có thể
còn lại nếu chính parent bị SIGKILL; không có retention/cleanup service nào.

Schema canonical được transpile từ đúng bốn module source hiện có bằng
TypeScript đã cài, không sửa/nhân bản schema hoặc thêm dependency. Module
`coa-auth.ts` tạo timer cleanup rate-limit không liên quan; harness chỉ `unref`
timer đó để CLI thoát tự nhiên. Schema loading/transpile và đọc file nằm ngoài
stage timings nhưng **nằm trong whole-child RSS high-water**.
`memory` trong JSON là snapshot sau từng stage (RSS/heap/external), không phải
peak của stage và không được dùng stage delta để tuyên bố peak.
`parse` gồm guard ZIP và SheetJS decode; `preflight` riêng cũng được ghi nhận.

## Phạm vi đã đo và phần chưa chứng minh

- Fixture dùng đúng tám tên sheet/header nghiệp vụ, metadata version 1,
  client/sample refs, catalog/pairs và dữ liệu literal Text tổng hợp. Client
  có CCCD/phone khác nhau, không dùng hồ sơ thực. Đây không phải template
  download sản phẩm; binding là `SYNTHETIC-UNVERIFIED`, chưa có server authority.
- Validation dùng `ResolveOrCreateClientInputSchema` cùng canonical ISO-date và
  phone validators; kiểm tra kiểu ô/formula/header, temporary refs, unique refs/
  assignment pairs, liên kết và orphan. Không chạy SQL canonical normalizers,
  shared resolver, cross-client collision guards hoặc nhánh reused client.
  Tất cả client là candidate tạo mới; không giả lập resolver trả `not_found`.
- Catalog chỉ kiểm tra đối chiếu tập pair tổng hợp trong RAM. Không xác thực
  descriptor, snapshot/generation, metadata/catalog integrity, authorization,
  RLS, quality, catalog/client drift, normalized hash/canonicalization #113,
  audit/provenance hoặc durable preview commitment/TTL.
- Preview chỉ group assays theo sample và serialize JSON để đo CPU/bytes.
  Không có React/browser rendering, toàn bộ client detail, lookup, hashing,
  durable batch state hoặc confirmation upload lần hai. Validation/preview
  thực tế có thể chậm/tốn RAM hơn đáng kể.
- Preflight đọc central-directory declared sizes/count trước SheetJS; không
  chứng minh actual inflated bound với ZIP độc hại, không có streaming inflate
  quota/CRC/local-header reconciliation. XML/ZIP bomb, malformed metadata khai
  sai, macros/external objects/defined names và toàn bộ quy tắc workbook cấm
  chưa được kiểm thử đầy đủ. File buffer đã đọc vào RAM trước file guard.
  Đây **không phải security-complete parser**.
- Không kết nối DB, Docker hoặc SSH. Không có business writes, vì vậy lỗi local
  không chứng minh rollback/atomicity, không chứng minh zero partial business
  rows hoặc zero duplicates trong persistent DB. Watchdog cũng không chứng minh
  HTTP unknown-outcome, retry, concurrency hoặc receipt recovery.

## Khuyến nghị giới hạn và trạng thái AC

Không đổi provisional limits #108 thành final production caps. Không thấy lý do
giảm các **số lượng thử nghiệm** từ phép đo CPU/RAM local này; đủ cơ sở tiếp tục
đo runtime thật ở 500 clients/1.000 samples/20.000 assignments. Đây không phải
bằng chứng commit hoặc khả năng chạy trong app 1 CPU/1 GiB.

| Giới hạn | Bằng chứng hiện có | Kết luận |
| --- | --- | --- |
| 500 clients / 1.000 samples / 20.000 assignments | Đã đo độc lập và combined trong RAM | Giữ là target prototype, final cap **unsupported** |
| 10 MB cũ | Harness định nghĩa rõ 10 MiB = 10.485.760 bytes; accepted lớn nhất 9.973.167 bytes | Cả 10 MB decimal lẫn exact 10 MiB accepted boundary chưa chứng minh; final cap **unsupported** |
| 32 MiB inflated / 256 entries / 160.000 cells | Guard thử nghiệm và over-limit rejection; chưa đo accepted exact boundary | Không đề xuất làm final security/resource caps |
| HTTP/DB/lock/polling timeouts, concurrency | Chưa đo application/DB/home server | **Unsupported**, không thay invariant #113 |

AC1 có môi trường/tiêu chí local khai báo trước và tiêu chí DB đề xuất; CPU/RSS/
WAL budgets DB còn cần baseline và approval cho môi trường đo. AC2 **PARTIAL**:
parse/validation-subset/preview-subset đã đo; atomic commit chưa đo. AC3
**PARTIAL**: local errors/guard/watchdog đã kiểm tra; DB rollback, retry và
duplicate-proof còn thiếu. AC4 **INCOMPLETE**: không thể chốt final caps.
AC5 **PASS**: điều phối đã ghi bằng chứng và kết luận vào
[#114](https://github.com/thienchi2109/lims-lite/issues/114), readback đúng nội
dung và giữ issue mở. Hai reviewer độc lập (Standards/Spec) chấp nhận phần
prototype local, không xác nhận hoàn tất toàn TASK-3.

Phần còn lại cần importer runtime thực sự và môi trường DB có quyền riêng:
normal/boundary/over-boundary commit; lỗi cuối transaction; disconnect/crash
trước và sau commit; mất HTTP response rồi status lookup; same-batch retry;
hai batch cùng hash; contention/TTL/drift; kiểm đếm business/audit/provenance/
claim trước-sau. Chưa viết speculative SQL hoặc chạy DB để thay thế bằng chứng.

Verification local: RED từ explicit unimplemented fixture/preflight stubs;
GREEN **6/6** native Node checks, gồm invalid cuối batch, numeric/formula/date,
duplicate/orphan, ZIP guards, declared-cell guard và watchdog. Full app test/
build/typecheck không được dùng để khẳng định capacity; không có app code đổi.
Scoped ESLint trên hai script và file test: **PASS**; chạy lại checks sau khi
đổi tên biến local `module` thành `loadedModule`: **6/6 PASS**. Đây chỉ là đổi
tên để đáp ứng lint rule Next.js, không đổi logic đã đo hoặc raw metrics.
