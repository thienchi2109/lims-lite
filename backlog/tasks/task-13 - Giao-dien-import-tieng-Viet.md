---
id: TASK-13
title: Giao diện import tiếng Việt và tích hợp luồng
status: In Progress
assignee: []
created_date: '2026-11-02'
labels: [excel-import, implementation, ui]
dependencies: [TASK-8, TASK-9, TASK-10, TASK-11, TASK-12]
priority: medium
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/141 (sub-issue #107).

OpenSpec [add-vietnamese-accession-import-workflow](../../openspec/changes/add-vietnamese-accession-import-workflow/proposal.md) đã nghiệm thu checkpoint 0 và Phase 1/2 source; dừng trước Phase 3. Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #112 §9, #113 §§4–6,8. TASK-8 đã có nút tải template; tái sử dụng, không tạo generator thứ hai.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Phase 1 — một PR/session: đề xuất nút “Nhập từ Excel” cạnh nút tải/template ở AccessionPageHeader trên /analyst/accession, mobile wrap, giữ walkthrough; không thêm duplicate entry /samples, chốt theo user steering trước UI. Analyst chọn workbook, size boundary rõ <10 MB decimal, pending/cancel và preview summary/client resolution/row errors tiếng Việt (sheet/dòng/cột/lý do/cách sửa); không truncate lỗi thành valid preview hoặc cache payload/file ngoài browser memory; accessible keyboard/focus/labels dùng patterns hiện có.
- [x] #2 Phase 2 — một PR/session: confirmation chỉ với valid unexpired preview, explicit attestation tất cả mẫu đã lấy/đạt; gửi đúng bytes file gốc, không chỉnh preview trong browser. Hiển thị official IDs/receipt sau commit; file đổi/role mất/drift/expiry phải hướng dẫn preview mới; api-client cho client mutations, loading/query invalidation có sẵn.
- [ ] #3 Phase 3 — một PR/session: timeout/unknown hiển thị đang tra cứu, gọi status trước retry; không báo failed giả hoặc upload mới trong khi chưa rõ outcome. Same receipt sau refresh/recovery; mất file vẫn lookup được success, còn preview_ready cần chọn lại exact file hoặc attempt mới. Owner isolation không lộ batch/receipt người khác.
- [ ] #4 Source gate mỗi phase: RED→GREEN focused accessible interaction tests cho success/error/expiry/drift/unknown/retry/double-click/file loss/size boundary; lint/typecheck/React checks phù hợp và OpenSpec strict. Không thêm count caps clients/samples/assignments.
- [ ] #5 Runtime rollout session riêng sau authorization: browser qua app/proxy đã deploy trên home server xác minh download→upload→preview→confirm→status/receipt bằng synthetic data; ghi revisions/timestamps/actors. TASK-7 thực hiện full DB/HTTP/end-to-end capacity/atomicity/security gate; UI mocks và local PASS không thay runtime evidence.
<!-- AC:END -->

## Implementation Notes

2026-11-07 — Checkpoint 0 chỉ có proposal/design/spec/tasks, khi đó dừng trước Phase 1 để review và các AC source/runtime chưa nghiệm thu. Phase 2 có gate truy vết đường đọc official sample IDs theo receipt/batch và quyền owner; chưa tìm thấy API hiện hành đáp ứng, không tự mở rộng receipt/backend. Theo dõi checkpoint và bằng chứng tại [OpenSpec tasks](../../openspec/changes/add-vietnamese-accession-import-workflow/tasks.md).

2026-11-07 — Phase 1 **SOURCE ONLY** nghiệm thu sau user release: worker `gpt-6.1-sol/high`, Luna `gpt-6-luna/max` scout tái sử dụng UI, root review và verify độc lập. RED 20/20 thiếu nút → GREEN 78/78 tests liên quan; lint/typecheck/OpenSpec/diff PASS, React Doctor 100/100 đủ 3 file source. Spec/Standards PASS. OpenSpec 8/24; chỉ AC #1 được tick, AC #4 giữ mở vì các phase sau chưa có source gate. Dừng trước Phase 2; browser/runtime/deploy/DB NOT RUN.

2026-11-07 — User duyệt bổ sung reader chỉ đọc sau khi xác nhận thiếu API, tận dụng session/RLS sẵn có và không đổi SQL/receipt; reader ở `cbf007a`. Phase 2 UI **SOURCE ONLY** nghiệm thu với cùng worker/Luna và root verify độc lập: RED 18/18 → GREEN cuối 192/192, có regression RED→GREEN cho cache sau unmount; lint/typecheck/OpenSpec/CRLF-aware whitespace PASS, React Doctor 100/100 đủ 11 file source, Spec/Standards PASS. Tái sử dụng Checkbox/Label/SampleIdCell và query keys; lỗi đọc IDs vẫn giữ receipt thành công, unknown giữ guard qua đóng/mở dialog. OpenSpec 15/24, AC #1/#2 tick; dừng trước Phase 3. Browser/runtime/RLS thực/deploy/SQL NOT RUN. [Bằng chứng và lệnh chạy lại](../../openspec/changes/add-vietnamese-accession-import-workflow/tasks.md#phase-2-ui-source-acceptance--2026-11-07).
