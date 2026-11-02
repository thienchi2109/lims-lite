---
id: TASK-7
title: Nghiệm thu capacity và atomicity của importer thực
status: To Do
assignee: []
created_date: '2026-11-02'
labels: [excel-import, verification]
dependencies: [TASK-4]
priority: high
---

## Description

Issue nghiệm thu: https://github.com/thienchi2109/lims-lite/issues/134 (sub-issue #107; phụ thuộc #115 trước khi liên kết prerequisite implementation).

Gate nghiệm thu sau triển khai nhận toàn bộ nghĩa vụ DB/HTTP/end-to-end chưa chứng minh từ TASK-3/#114 theo quyết định ngày 2026-11-02. Chỉ giới hạn nghiệp vụ file **<10.000.000 bytes**, không giới hạn số khách hàng/mẫu/chỉ định. Size pass không thay validation hoặc bảo đảm xử lý mọi workbook. Không chặn TASK-4 phân chia và không thực hiện production operations lúc tạo task này.

Nguồn: [template #112](../../docs/superpowers/specs/2026-11-01-excel-template-contract-design.md), [atomic/provenance #113](../../docs/superpowers/specs/2026-11-01-atomic-import-provenance-contract-design.md), [prototype lịch sử](../../docs/superpowers/specs/2026-11-02-import-capacity-evidence.md), [file-only local evidence](../../docs/superpowers/specs/2026-11-02-import-file-limit-evidence.md), [TASK-3](task-3%20-%20Kiem-chung-nang-luc-va-gioi-han-import.md), [TASK-4](task-4%20-%20Phan-chia-OpenSpec-va-task-trien-khai-import.md).

Prerequisite hiện biết: TASK-4. Các task implementation generator/download, server descriptor/catalog binding và resolver, safe parser, durable preview/hash, atomic confirmation/provenance, API/UI và recovery chưa được phân chia; TASK-4 phải tạo và liên kết ID thực vào dependencies trước bắt đầu gate này. Không giả định chúng đã tồn tại hoặc đã chạy được. TASK-4 không phụ thuộc TASK-7.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Liên kết prerequisite runtime từ TASK-4 và xác minh importer thực: server-authoritative descriptor/catalog revision/generation, canonical client resolver gồm reused/collision cases, durable preview commitment và canonical normalized hash đúng #112/#113; không dùng mô phỏng local làm bằng chứng.
- [ ] #2 Chốt trước phép đo môi trường home server hoặc disposable được cấp quyền, app/PG/image revisions, CPU/RAM limits, dataset cardinality, actors/RLS/audit, catalog và concurrency. Đo baseline CPU/RSS/WAL/disk/connections/locks/deadlocks, chốt DB budgets có căn cứ; đánh giá đề xuất commit ≤5.000 ms, lock wait ≤1.000 ms, statement_timeout 10.000 ms, tối đa một connection/confirm, zero deadlock đơn luồng. Chốt HTTP/DB/lock/poll/retry/recovery/purge budgets từ runtime, ghi lý do nếu điều chỉnh đề xuất.
- [ ] #3 Đo riêng parse, validation/resolver, durable preview/hash và commit với fixture tổng hợp normal, historical count scenarios và former cap+1, dữ liệu nhiều/ít nén, valid 9.999.999 bytes; đo CPU/RSS/heap/external/transfer gồm upload lại lúc confirm. Chứng minh cả upload và confirm đi qua app/proxy thực chấp nhận file hợp lệ dưới ngưỡng và từ chối đúng 10.000.000 bytes/trên ngưỡng, không có business count caps.
- [ ] #4 Xác minh actual inflated-byte quota, ZIP/XML cấu trúc/cell/entry guards, thời gian và bộ nhớ trong parser/runtime thực; malformed, adversarial declared sizes, compression bomb và resource exhaustion fail closed trước write, không truncate/partial preview. Declared central-directory metadata trong prototype chưa chứng minh actual inflate safety hoặc mọi quy tắc workbook cấm.
- [ ] #5 Đo commit và lỗi ở cuối batch/transaction; lỗi bất kỳ không để lại business rows/claims tạo dở. Đối chiếu before/after counts clients/samples/assignments/audit/provenance/row mappings, chung server received_at và receipt; không âm thầm ghi đè identity, không giữ workbook hoặc full normalized payload.
- [ ] #6 Xác minh idempotency/global dedup: same-batch retry, hai batch cùng file/normalized hash, simultaneous confirms và contention không tạo duplicate; retry sau timeout trả đúng durable receipt. Inject disconnect/crash trước/sau commit, mất HTTP response, unknown outcome và status lookup/recovery, không báo thất bại giả khi commit đã thành công.
- [ ] #7 Xác minh hard logical TTL 30 phút và lock-safe physical purge, lease/heartbeat preparing, abandoned-request recovery, catalog/client drift trước confirm; TTL không hủy transaction đã được chấp nhận. Đo purge/recovery/retry budgets và recovery sau DB gián đoạn; không suy physical purge đúng phút 30 từ hợp đồng logical expiry.
- [ ] #8 Chạy authorization analyst-only và RLS/security tests, audit/provenance/privacy/error-context checks qua server/database thật; lưu PII-free evidence có timestamp/revision/command/outcome cho từng gate. Tách source/local/disposable/home/deployed evidence; production chỉ SSH vào home server đúng phạm vi được cấp quyền, không vận hành production từ workspace.
- [ ] #9 Root review bằng chứng đầy đủ, ghi PASS/INCOMPLETE theo từng gate và cập nhật backlog/GitHub/OpenSpec tương ứng; chỉ đóng nghiệm thu khi có DB/HTTP/end-to-end proof thực, không từ tick spec hoặc thành công của prototype.
<!-- AC:END -->
