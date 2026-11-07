---
id: TASK-12
title: Xác nhận HTTP, tra cứu và recovery import
status: Done
assignee: []
created_date: '2026-11-02'
labels: [excel-import, implementation, recovery]
dependencies: [TASK-9, TASK-10, TASK-11]
priority: high
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/140 (sub-issue #107).

OpenSpec: `add-accession-confirmation-recovery`. Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #113 §§3–8 và TASK-7 runtime budgets.

Confirm gửi lại IDENTICAL original workbook; server reparse/revalidate và so commitment trước SQL boundary TASK-11. Không giữ file/payload giữa requests, không blind retry khi outcome chưa biết.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Phase 1 — một PR/session: analyst owner-only confirm/status APIs, original byte limit <10.000.000 ở upload và confirm, identical source SHA256 và normalized commitment/version revalidation; request current data không được thay immutable preview. Attestation mẫu đã lấy/đạt, auth/role revocation, safe errors và no-store/privacy; chỉ gọi atomic RPC một lần.
- [x] #2 Phase 2 — một PR/session: status lookup không cần workbook, trả receipt durable khi success, safe failed/expired và processing/unknown khi còn lock; timeout/mất response không suy failed. Retry cùng confirm khi unknown tra status trước; terminal retry thành linked attempt mới; mất file vẫn lấy receipt success, preview_ready cần đúng file hoặc attempt mới.
- [x] #3 Phase 3 — một PR/session: migration/RPC forward-only và recovery runner tối thiểu cho preparing lease/heartbeat, abandoned requests, crash/disconnect, lock-safe physical purge của commitment sau hard logical expiry. Không purge receipt/dedup/mapping/audit; không hủy accepted transaction khi TTL tới; recovery không tự replay business writes. Chọn scheduler/runtime convention hiện có, không tạo framework mới.
- [x] #4 Focused RED→GREEN API/security/integration scenarios: changed bytes, size boundary, wrong owner/manager/withdrawn role, before/after-commit disconnect, lost HTTP response, concurrent status/confirm/purge, worker restart/DB outage, expiry khi đợi lock; kiểm tra không lưu file/full payload ở proxy/temp/cache/log/disk. Lint/typecheck/OpenSpec strict và SQL source checks theo phase.
- [x] #5 Runtime session riêng sau authorization: apply migration qua home-server SSH/Docker, SQL tests + run_security_tests(), rollout API/recovery runner và verify current image/config/proxy upload/no-buffer-to-disk path. Nếu hạ tầng không đáp ứng no-retention phải báo quyết định cụ thể, không tự nới contract; TASK-7 đo/chốt HTTP/DB/lock/poll/retry/purge budgets sau baseline.
- [x] #6 Exit: status/recovery path testable qua app thực, không duplicate/false failure, physical purge phân biệt expiry; ghi evidence nguồn/runtime riêng. Full crash/concurrency/capacity acceptance vẫn chờ TASK-7, không claim từ mock hoặc prototype watchdog.
<!-- AC:END -->

## Phase 1 source checkpoint — 2026-11-06

Root đã review độc lập và chấp nhận **SOURCE ONLY** cho confirm/status HTTP tại `/api/accession-confirmation/[batchId]`, tái sử dụng adapter atomic hiện có và bounded upload/auth chung với preview. Migration mới `240_add_accession_confirmation_status.sql` cung cấp service-only status với owner/confidentiality checks, `NOWAIT`, receipt durable và DB-clock logical expiry; **chưa apply**. Migrations 233–239 và core confirm/preparation giữ nguyên từng byte.

OpenSpec [`add-accession-confirmation-recovery`](../../openspec/changes/add-accession-confirmation-recovery/tasks.md): **12/27**, checkpoint 0 và Phase 1 hoàn tất; Phase 2/3 và runtime chưa release. RED 55 ca mới, thêm regression deadline RED, GREEN worker 146/146; root chạy độc lập 10 files / **208/208 PASS**, typecheck, touched ESLint, strict OpenSpec và diff checks PASS. Independent Spec/Standards review không có blocker. [Evidence](../../openspec/changes/add-accession-confirmation-recovery/evidence.md) ghi lệnh và giới hạn.

Giữ các AC tổng thể chưa tick tới gate tương ứng. SQL/security runtime, authenticated adapter smoke, proxy/no-retention, recovery/purge và deployment **NOT RUN**; TASK-11 vẫn OPEN 26/28, gates 4.4/4.5 INCOMPLETE. Không có UI TASK-13 hoặc production fixture.

## Phase 2 source checkpoint — 2026-11-06

Worker mới hoàn tất status-first client tại `api-client.ts`: GET status trước mỗi confirm hoặc linked preview, success lấy receipt không cần file, processing/unknown không replay; retry rõ ràng dùng `retryOfBatchId` hiện có. Schema receipt/status được dùng chung giữa server/browser. Migration mới `241_guard_accession_preview_retry.sql` tái sử dụng lock-aware status trong cùng transaction để giữ parent lock tới child INSERT, chỉ nhận ready/failed/rejected/expired, không đổi parent; 233–240 giữ nguyên từng byte. **240/241 chưa apply**.

Root chấp nhận **SOURCE ONLY**, OpenSpec **16/27**. RED 41 ca; focused GREEN 46/46; root kiểm chứng độc lập **16 files / 270 tests PASS**, typecheck, touched ESLint, strict OpenSpec và diff checks PASS. Spec/Standards review không có blocker. SQL rollback/concurrency scenarios được giữ lại nhưng **NOT RUN**; chưa deploy hoặc smoke thật. Phase 3 recovery/purge chưa release, TASK-11 gates 4.4/4.5 vẫn INCOMPLETE. [Evidence Phase 2](../../openspec/changes/add-accession-confirmation-recovery/evidence.md).

## Phase 3 source checkpoint — 2026-11-06

Worker `gpt-6.1-sol/high` triển khai runner native-PG chạy một lần, cấu hình opt-in và password file; scout read-only dùng `gpt-6-luna/max`. Migration242 phục hồi lease hết hạn và purge bindings bằng batch lock/capability trong transaction, giữ receipt/dedup/mapping/business/audit; không replay confirm. Migrations233–241 giữ nguyên từng byte, package chỉ thêm một start script; không thêm scheduler/Compose/dependency.

Root chấp nhận **SOURCE ONLY**, OpenSpec **21/27**. Root kiểm chứng độc lập **18 files / 309 tests PASS**, typecheck, touched ESLint, worker build, strict OpenSpec và diff checks PASS; Spec/Standards review không có blocker. RED harness ban đầu không hợp lệ đã được ghi rõ và chạy lại baseline đúng; không coi đó là RED sạch trước implementation. [Evidence Phase 3](../../openspec/changes/add-accession-confirmation-recovery/evidence.md).

**240–242 chưa apply**. SQL/security/concurrency/native-role/proxy/no-retention/authenticated E2E vẫn **NOT RUN**; chưa chạy worker, deploy hoặc purge thật. Sáu runtime gates4.1–4.6 còn mở; TASK-11 gates4.4/4.5 vẫn INCOMPLETE.

## Phase 4 exit — 2026-11-07

Root nghiệm thu **27/27, ISOLATED/DISPOSABLE ONLY**: worker gpt-6.1-sol/high, scouts read-only gpt-6-luna/max, review độc lập Spec/Standards PASS. Committed SQL240→241→243→244, bỏ qua242 fail/rollback bất biến; security36/36, năm SQL rollback fixtures, native crash/restart/outage, HTTP thật qua GoTrue/proxy và timeout/disconnect/expiry/quyền/size PASS trong phạm vi ghi nhận. Root:19files/320tests, ESLint18files, typecheck/strict OpenSpec PASS.

Root kiểm chứng bốn HTTP success, mỗi batch một receipt/ba mappings/business rows/ba canonical owner audits; tám GET/POST không thêm writes. Purge ba bindings giữ nguyên năm digest. Đã dọn đúng DB/role/container/network/credential/schema dump, kiểm tra zero sessions/dependencies trước normal DROP. 25 container production giữ ID, app healthy; counts/hash/security production không đổi. [Evidence và cleanup](../../openspec/changes/add-accession-confirmation-recovery/evidence.md#root-exit-acceptance-and-cleanup--2026-11-07).

TASK-11 đạt28/28. **Chưa deploy TASK-12 lên production**: cần binding keys/policy có evidence và proxy upload/no-retention trước rollout riêng; không dùng policy disposable cho production. TASK-7/#134 giữ capacity/budgets/scheduler/full fault matrix; TASK-13/#141 giữ UI/browser; TASK-8 deferred gates không đổi.
