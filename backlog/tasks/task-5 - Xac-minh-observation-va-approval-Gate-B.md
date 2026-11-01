---
id: TASK-5
title: Xác minh observation và approval client canonical Gate B
status: To Do
assignee: []
created_date: '2026-11-01'
labels: [excel-import, client-canonical, verification]
dependencies: []
priority: medium
---

## Description

Theo dõi evidence gate còn thiếu xác minh, không kết luận chưa làm chỉ vì checkbox. Đây là luồng song song với import Excel dùng resolver v2; không làm lại Gate A và không tự chạy production từ workspace này.

Nguồn: [canonical integrity tasks 4.1–4.3](../../openspec/changes/enforce-client-canonical-integrity/tasks.md), [legacy retirement tasks 1.1–1.5](../../openspec/changes/retire-client-canonical-legacy-paths/tasks.md), [Gate B design](../../openspec/changes/retire-client-canonical-legacy-paths/design.md).

Gate A có migration 231 và [hồ sơ apply 2026-08-29](../../openspec/changes/enforce-client-canonical-integrity/gate-a-preflight-evidence.md). Gate B có static code-search record ở task 1.4/commit `0d62612`; không làm lại hoặc coi task đó thiếu chỉ vì chưa đủ observation evidence. Hồ sơ cũ nói app image trước Gate A, nhưng current app revision/window chưa được xác minh. Proposal tồn tại chưa phải evidence đã được duyệt.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Đối chiếu evidence mới nhất và ghi rõ revision app thực chạy, thời điểm Gate A/observation, nguồn và ngày kiểm tra; không dùng source HEAD hoặc tuổi của tài liệu để suy runtime.
- [ ] #2 Xác minh hoặc lấy phê duyệt riêng cho observation window và closeout criteria của proposal; bảy ngày UTC hiện là đề xuất, không tự ghi thành đã duyệt.
- [ ] #3 Thu thập đủ PII-free shadow/integrity/compatibility aggregates cho window đã duyệt, có timestamp, phạm vi và gap; nếu thiếu thì ghi chưa xác minh thay vì PASS.
- [ ] #4 Đối chiếu lại static callers với source hiện hành, phân loại từng candidate retained/remove cùng lý do; giữ truy vết kết quả task 1.4 đã có.
- [ ] #5 Ghi evidence và approval/readiness cho Gate B, cập nhật các OpenSpec task tương ứng bằng chứng thực tế trước mở TASK-6; runtime/deployment chỉ thực hiện đúng môi trường home server và phạm vi được cho phép.
<!-- AC:END -->
