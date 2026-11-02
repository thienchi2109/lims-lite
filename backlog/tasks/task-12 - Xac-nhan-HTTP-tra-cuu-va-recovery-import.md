---
id: TASK-12
title: Xác nhận HTTP, tra cứu và recovery import
status: To Do
assignee: []
created_date: '2026-11-02'
labels: [excel-import, implementation, recovery]
dependencies: [TASK-9, TASK-10, TASK-11]
priority: high
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/140 (sub-issue #107).

OpenSpec dự kiến `add-accession-confirmation-recovery` (chưa tạo). Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #113 §§3–8 và TASK-7 runtime budgets.

Confirm gửi lại IDENTICAL original workbook; server reparse/revalidate và so commitment trước SQL boundary TASK-11. Không giữ file/payload giữa requests, không blind retry khi outcome chưa biết.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 1 — một PR/session: analyst owner-only confirm/status APIs, original byte limit <10.000.000 ở upload và confirm, identical source SHA256 và normalized commitment/version revalidation; request current data không được thay immutable preview. Attestation mẫu đã lấy/đạt, auth/role revocation, safe errors và no-store/privacy; chỉ gọi atomic RPC một lần.
- [ ] #2 Phase 2 — một PR/session: status lookup không cần workbook, trả receipt durable khi success, safe failed/expired và processing/unknown khi còn lock; timeout/mất response không suy failed. Retry cùng confirm khi unknown tra status trước; terminal retry thành linked attempt mới; mất file vẫn lấy receipt success, preview_ready cần đúng file hoặc attempt mới.
- [ ] #3 Phase 3 — một PR/session: migration/RPC forward-only và recovery runner tối thiểu cho preparing lease/heartbeat, abandoned requests, crash/disconnect, lock-safe physical purge của commitment sau hard logical expiry. Không purge receipt/dedup/mapping/audit; không hủy accepted transaction khi TTL tới; recovery không tự replay business writes. Chọn scheduler/runtime convention hiện có, không tạo framework mới.
- [ ] #4 Focused RED→GREEN API/security/integration scenarios: changed bytes, size boundary, wrong owner/manager/withdrawn role, before/after-commit disconnect, lost HTTP response, concurrent status/confirm/purge, worker restart/DB outage, expiry khi đợi lock; kiểm tra không lưu file/full payload ở proxy/temp/cache/log/disk. Lint/typecheck/OpenSpec strict và SQL source checks theo phase.
- [ ] #5 Runtime session riêng sau authorization: apply migration qua home-server SSH/Docker, SQL tests + run_security_tests(), rollout API/recovery runner và verify current image/config/proxy upload/no-buffer-to-disk path. Nếu hạ tầng không đáp ứng no-retention phải báo quyết định cụ thể, không tự nới contract; TASK-7 đo/chốt HTTP/DB/lock/poll/retry/purge budgets sau baseline.
- [ ] #6 Exit: status/recovery path testable qua app thực, không duplicate/false failure, physical purge phân biệt expiry; ghi evidence nguồn/runtime riêng. Full crash/concurrency/capacity acceptance vẫn chờ TASK-7, không claim từ mock hoặc prototype watchdog.
<!-- AC:END -->
