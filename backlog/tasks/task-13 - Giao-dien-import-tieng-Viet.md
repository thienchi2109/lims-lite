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

OpenSpec [add-vietnamese-accession-import-workflow](../../openspec/changes/add-vietnamese-accession-import-workflow/proposal.md) đã có artifacts checkpoint 0; chưa triển khai UI. Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #112 §9, #113 §§4–6,8. TASK-8 đã có nút tải template; tái sử dụng, không tạo generator thứ hai.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 1 — một PR/session: đề xuất nút “Nhập từ Excel” cạnh nút tải/template ở AccessionPageHeader trên /analyst/accession, mobile wrap, giữ walkthrough; không thêm duplicate entry /samples, chốt theo user steering trước UI. Analyst chọn workbook, size boundary rõ <10 MB decimal, pending/cancel và preview summary/client resolution/row errors tiếng Việt (sheet/dòng/cột/lý do/cách sửa); không truncate lỗi thành valid preview hoặc cache payload/file ngoài browser memory; accessible keyboard/focus/labels dùng patterns hiện có.
- [ ] #2 Phase 2 — một PR/session: confirmation chỉ với valid unexpired preview, explicit attestation tất cả mẫu đã lấy/đạt; gửi đúng bytes file gốc, không chỉnh preview trong browser. Hiển thị official IDs/receipt sau commit; file đổi/role mất/drift/expiry phải hướng dẫn preview mới; api-client cho client mutations, loading/query invalidation có sẵn.
- [ ] #3 Phase 3 — một PR/session: timeout/unknown hiển thị đang tra cứu, gọi status trước retry; không báo failed giả hoặc upload mới trong khi chưa rõ outcome. Same receipt sau refresh/recovery; mất file vẫn lookup được success, còn preview_ready cần chọn lại exact file hoặc attempt mới. Owner isolation không lộ batch/receipt người khác.
- [ ] #4 Source gate mỗi phase: RED→GREEN focused accessible interaction tests cho success/error/expiry/drift/unknown/retry/double-click/file loss/size boundary; lint/typecheck/React checks phù hợp và OpenSpec strict. Không thêm count caps clients/samples/assignments.
- [ ] #5 Runtime rollout session riêng sau authorization: browser qua app/proxy đã deploy trên home server xác minh download→upload→preview→confirm→status/receipt bằng synthetic data; ghi revisions/timestamps/actors. TASK-7 thực hiện full DB/HTTP/end-to-end capacity/atomicity/security gate; UI mocks và local PASS không thay runtime evidence.
<!-- AC:END -->

## Implementation Notes

2026-11-07 — Checkpoint 0 chỉ có proposal/design/spec/tasks, dừng trước Phase 1 để review; các AC source/runtime chưa nghiệm thu. Phase 2 có gate truy vết đường đọc official sample IDs theo receipt/batch và quyền owner; chưa tìm thấy API hiện hành đáp ứng, không tự mở rộng receipt/backend. Theo dõi checkpoint và bằng chứng tại [OpenSpec tasks](../../openspec/changes/add-vietnamese-accession-import-workflow/tasks.md).
