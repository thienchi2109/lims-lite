# TASK-3 / #114 — file-only scope và bằng chứng local mới

Quyết định người dùng ngày 2026-11-02: chỉ giới hạn nghiệp vụ theo dung lượng
file **<10 MB decimal = 10.000.000 bytes**; đúng ngưỡng cũng từ chối. Không có
count caps khách hàng/mẫu/chỉ định. 500/1.000/20.000 là các kích thước fixture
lịch sử để so sánh, không phải supported maxima. Giữ phòng vệ tài nguyên kỹ thuật.

**PASS_LOCAL**: 10/10 focused Node self-check, scoped ESLint và 54/54 trials
(18 cases × 3 child process tuần tự). Đây là prototype CLI local, không phải
bằng chứng parser đầy đủ, app/HTTP/DB/home server hoặc cam kết mọi file dưới
10 MB đều hợp lệ/xử lý được. Size pass vẫn phải qua validation và resource guards.

## Truy vết và thay đổi phạm vi

[Báo cáo trước](2026-11-02-import-capacity-evidence.md) mô tả PR #133 với 10 MiB
và COUNT_LIMIT; giữ lịch sử và đánh dấu superseded. Không sửa byte nào của
[JSON cũ](2026-11-02-import-capacity-results.json). Metrics mới ở
[2026-11-02-import-file-limit-results.json](2026-11-02-import-file-limit-results.json).

[TASK-3](../../../backlog/tasks/task-3%20-%20Kiem-chung-nang-luc-va-gioi-han-import.md)
đổi AC sang prototype local/file-only, đã được root review và GitHub sync để đóng.
Không tick AC DB cũ thành đã đạt. Toàn bộ runtime/DB/HTTP/end-to-end obligations
chuyển sang [TASK-7](../../../backlog/tasks/task-7%20-%20Nghiem-thu-capacity-va-atomicity-import-thuc.md).
[TASK-4](../../../backlog/tasks/task-4%20-%20Phan-chia-OpenSpec-va-task-trien-khai-import.md)
đủ điều kiện bắt đầu sau TASK-3; TASK-4 phân chia trước và chọn generator/download template
làm change implementation đầu tiên, rồi liên kết ID prerequisite runtime thực
vào TASK-7. TASK-7 không chặn TASK-4. Chưa thực
hiện TASK-4, chưa tạo proposal OpenSpec implementation.

## RED → GREEN và boundary fixture

Trước sửa implementation: 5/10 tests fail đúng kỳ vọng — ba case old-cap+1
nhận COUNT_LIMIT; exact 10.000.000 bytes không ném FILE_LIMIT; empty batch còn
mang mã COUNT_LIMIT. Sau sửa: 10/10 PASS, empty batch nhận EMPTY_BATCH; các guard
canonical/cấu trúc/tham chiếu/trùng/formula/date/orphan/cell/ZIP vẫn chạy.

Boundary fixture được sinh thành XLSX tám sheet, 500/1.000/20.000 business rows,
8.000.000 entropy characters trong sheet hướng dẫn. ZIP gốc 9.973.167 bytes,
17 entries, 12.134.506 declared inflated bytes. Thêm **ZIP EOCD comment hợp lệ**
26.832/26.833/26.834 bytes để đạt chính xác 9.999.999/10.000.000/10.000.001 bytes;
không dùng buffer giả workbook hoặc trailing bytes không khai báo. Case dưới
ngưỡng thực sự parse/validate/build preview đủ counts; hai case còn lại từ chối
FILE_LIMIT tại preflight trước decode, không có preview. Descriptor vẫn là
SYNTHETIC-UNVERIFIED; đây không phải template được server ký.

Một lần thử GREEN ban đầu dùng generator với samples=0 khiến phép chia trong
fixture cũ không hữu hạn và test process hết heap. Đã sửa setup empty-batch test
bằng cách thu worksheet range về header của workbook hợp lệ; lần GREEN sau đạt.
Không coi lần lỗi setup đó là phép đo runtime hoặc bằng chứng resource safety.

## Môi trường và budget khai báo trước phép đo

Kế thừa budget prototype trước: parse ≤2.000 ms, validate ≤1.000 ms, preview
≤1.000 ms, tổng ba stage ≤4.000 ms; observed child RSS ≤512 MiB, V8 old-space
384 MiB. Whole-child watchdog 30 giây; stalled-after-parse injection dùng 2 giây.
Guard thử nghiệm: 32 MiB **declared** inflated bytes, 256 entries, 160.000 declared
cells. RSS là observed high-water, không phải hard OS limit. Đây không phải SLO
production hoặc final security limits. Generation parent ngoài timings/RSS child.

Hoàn tất `2026-11-02T02:49:45.101Z`: Linux x64, Node v20.20.2, SheetJS 0.20.3,
TypeScript 5.9.3, QEMU Virtual CPU version 2.5+, 4 logical CPUs/available
parallelism, host RAM 7.961,70 MiB. Mỗi trial là process mới chạy tuần tự;
không chạy test/build đồng thời. Không CPU pinning hoặc kiểm soát tải host;
không suy p95/concurrency/sustained throughput từ ba mẫu.

Timings là **min / median / max**, đơn vị ms; RSS là max MiB của ba child.

| Case | Parse | Validate | Preview | Peak RSS |
| --- | --- | --- | --- | --- |
| Normal 10/20/100 | 25,06 / 25,32 / 26,93 | 4,99 / 5,77 / 11,53 | 0,43 / 0,44 / 0,70 | 133,19 |
| Historical clients 500/500/500 | 160,55 / 173,06 / 209,62 | 20,16 / 25,27 / 26,15 | 1,57 / 1,84 / 1,91 | 155,97 |
| Historical samples 10/1.000/1.000 | 111,92 / 128,86 / 133,86 | 21,65 / 23,24 / 24,78 | 1,98 / 2,57 / 3,05 | 152,57 |
| Historical assignments 10/1.000/20.000 | 262,93 / 277,46 / 375,56 | 57,47 / 58,87 / 79,36 | 9,37 / 10,10 / 11,90 | 160,66 |
| Historical combined 500/1.000/20.000 | 275,53 / 292,44 / 301,13 | 63,58 / 66,15 / 87,01 | 10,13 / 10,73 / 13,79 | 162,47 |
| 501/1.000/20.000 | 329,59 / 365,75 / 384,97 | 66,47 / 86,01 / 89,06 | 10,67 / 11,53 / 11,80 | 164,55 |
| 500/1.001/20.000 | 291,41 / 308,94 / 315,89 | 62,22 / 62,56 / 68,98 | 10,22 / 10,46 / 10,53 | 164,19 |
| 500/1.000/20.001 | 326,70 / 353,03 / 419,49 | 60,02 / 70,08 / 91,37 | 9,85 / 12,29 / 17,19 | 162,74 |
| Combined + repeated padding | 458,65 / 461,06 / 534,91 | 69,24 / 97,07 / 99,89 | 11,70 / 13,59 / 14,38 | 188,55 |
| Combined + entropy padding | 616,55 / 623,91 / 714,54 | 82,32 / 95,11 / 96,46 | 6,62 / 8,18 / 11,84 | 199,93 |
| Valid 9.999.999 bytes | 668,57 / 740,38 / 800,73 | 72,75 / 92,26 / 95,48 | 5,80 / 6,54 / 9,89 | 196,96 |

Các case còn lại đều đúng kỳ vọng, mỗi case ba lượt:

| Case | Kết quả |
| --- | --- |
| 10.000.000 / 10.000.001 / 13.432.629 file bytes | FILE_LIMIT tại preflight; không parse/preview |
| 36.396.965 declared inflated bytes | INFLATED_LIMIT tại preflight |
| 277 entries | ENTRY_LIMIT tại preflight |
| Invalid assignment cuối historical combined | INVALID_ASSIGNMENT; không preview |
| Historical combined parse xong rồi stall | WATCHDOG; parsedBeforeKill=true, previewEmitted=false; không có RSS child bị kill |

Matrix giữ 15 kịch bản cũ (đổi old-cap+1 thành accepted), thêm ba size boundaries
nên thành 18 cases/54 trials. Không overwrite metrics lịch sử để giả kết quả mới.

Root chạy độc lập sau code freeze: 10/10 self-check, scoped ESLint PASS và
18 cases/54 trials exit 0 lúc `2026-11-02T02:53:38.667Z`; mọi outcome/budget đều
đạt. Case 9.999.999 bytes accepted 3/3, max parse/validate/preview
681,83 / 70,83 / 9,09 ms, peak RSS 198,80 MiB; exact/above size từ chối trước
decode, cả ba former-count-cap+1 accepted. Historical combined max
318,43 / 82,41 / 13,91 ms, peak 162,07 MiB. Đây là rerun CLI cùng môi trường
local, không bổ sung bằng chứng app/DB/home server. JSON liên kết ở trên giữ
nguyên số đo worker để tránh trộn hai lần chạy.

## Chạy lại và giới hạn bằng chứng

Từ checkout/worktree này, dùng dependencies đã cài, không cài thêm:

```bash
rtk proxy env NODE_PATH=/root/lims-lite/node_modules node --test tests/import-capacity-prototype.test.mjs
rtk proxy env NODE_PATH=/root/lims-lite/node_modules /root/lims-lite/node_modules/.bin/eslint --config /root/lims-lite/eslint.config.mjs scripts/import-capacity-prototype.mjs scripts/benchmark-import-capacity.mjs tests/import-capacity-prototype.test.mjs
rtk proxy env NODE_PATH=/root/lims-lite/node_modules node scripts/benchmark-import-capacity.mjs --output=/tmp/lims-import-file-limit-results.json
```

Không có Docker/DB/Storage/SSH/deploy hoặc application upload feature trong diff.
Schema loader trusted allowlist/NOSONAR và bounded Atomics.wait giữ nguyên.
Validation/preview chỉ là tập con mô tả ở báo cáo lịch sử; chưa có server descriptor,
canonical resolver, durable preview/hash, SQL normalization, receipt hoặc UI.
Preflight dùng central-directory metadata, chưa chứng minh actual inflate quota,
CRC/local-header reconciliation hoặc ZIP/XML bomb safety; buffer đã ở RAM trước
guard. Watchdog kill không chứng minh rollback/unknown-outcome recovery của DB/HTTP.
TASK-7 phải chứng minh tất cả phần đó, audit/provenance/global dedup/retry/concurrency,
crash/status lookup/TTL/drift/authorization/RLS và budgets dựa trên DB baseline trong
môi trường được cấp quyền. Không dùng local PASS để đóng gate nghiệm thu đó.
