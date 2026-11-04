---
id: TASK-10
title: Tạo preview bất biến và canonical hash
status: In Progress
assignee: []
created_date: '2026-11-02'
labels: [excel-import, implementation]
dependencies: [TASK-8, TASK-9]
priority: high
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/138 (sub-issue #107).

OpenSpec: [add-accession-preview-commitment](../../openspec/changes/add-accession-preview-commitment/proposal.md). Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #112 §§4–6,8 và #113 §§2–4,6–8.

Preview chỉ giữ durable commitment/safe metadata; full normalized payload và file chỉ được xử lý trong bộ nhớ request/browser. Không lưu workbook vào DB/Storage/temp app file/cache/log; không dùng legacy matching hoặc TASK-5/6 làm dependency.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Phase 1 — một PR/session: adapter gọi shared canonical resolver v2 và canonical normalization; validate create/reuse/conflict, conditional phone/gender, optional fields ngay cả reuse, typed trusted identity, same-batch reuse UUID/identity duplicates và not_found collisions. Name+DOB đơn thuần không chứng minh identity; khác strong identity hợp lệ vẫn distinct; không overwrite existing identity.
- [x] #2 Phase 2 — một PR/session: canonical `accession-intent-v1` và SQL/application parity fixtures, golden SHA256 `090da05ce3b97394845d98b5d3fde180f150b3d452b5f067155466859a4e908e`; giữ graph multiplicity, order/ref/filename independence, stable hash sau create/reuse, changed relation đổi hash.
- [x] #3 Phase 3 — một PR/session: migration forward-only cho durable preparing/preview_ready/terminal metadata, owner binding, exact source SHA256, hash+canonicalization version, immutable commitment, server timestamps và hard logical TTL30phút; không lưu full normalized payload. Server rechecks supported version/revision/generations/current client resolution, rejects stale catalog; preparing lease/heartbeat contract được định nghĩa cho recovery TASK-12.
- [ ] #4 Phase 4 — một PR/session: authenticated analyst preview API tích hợp TASK-9, trả row-specific errors/summary mà không cấp official sample IDs; permission owner-only và RLS fail closed (manager không thay analyst); api-client bridge nơi có mutations từ browser, no-store responses; audit tối thiểu không PII/payload.
- [ ] #5 Source gate từng phase: focused RED→GREEN identity/drift/hash/immutability/expiry/authorization/audit tests, migration contract checks, scoped lint/typecheck/OpenSpec strict. Runtime session riêng sau authorization: apply committed migration qua home-server SSH/Docker, SQL tests + run_security_tests(), rollout rồi preview/restart/owner-isolation smoke. Ghi source/runtime evidence riêng.
- [ ] #6 Exit: preview commitment tồn tại qua restart, không business writes, không retained source/payload; TASK-11 dùng commitment để xác nhận cùng bytes và normalized intent. Purge/recovery workers chưa được coi hoàn tất trước TASK-12; TASK-7 giữ nghiệm thu stress/TTL/crash thật.
<!-- AC:END -->

## Checkpoint 0 — 2026-11-03

User giao worker triển khai theo checkpoint an toàn; root điều phối và review. Proposal/design/spec/tasks đã qua OpenSpec strict và root review; reviewer độc lập xác nhận guard cùng batch phù hợp canonical v2. Root release **Phase 1 source only**: adapter và SQL bridge chỉ đọc, dùng canonical normalization ở PostgreSQL; migration mới chưa áp dụng. Worker dừng sau GREEN để root/spec/standards review trước phase tiếp theo. Chưa có hash, durable preview hoặc preview API; SQL/security/runtime vẫn **INCOMPLETE**, TASK-8 deferred gates và TASK-7 giữ nguyên.

## Checkpoint 1 — Phase 1 source, 2026-11-03

Worker `gpt-6.1-sol/high` hoàn tất adapter + typed RPC wrapper và migration 233 chỉ đọc, dùng normalization/resolver canonical v2 với guard cùng batch theo nhóm. Root review độc lập, SPEC PASS, STANDARDS không finding; root chạy **222 tests PASS**, ESLint/typecheck/OpenSpec strict PASS. [Evidence](../../openspec/changes/add-accession-preview-commitment/evidence.md). Giữ SQL behavioral fixtures để chạy sau authorization riêng; migration/SQL/security chưa thực thi nên AC #1 chưa tick đầy đủ. Dừng ở checkpoint source này; Phase 2 canonical hash là bước tiếp theo, chưa release. Không deploy hoặc mở upload/preview UI.

## Checkpoint 2 — Phase 2 source, 2026-11-03

User release Phase 2; worker `gpt-6.1-sol/high` hoàn tất `accession-intent-v1` và SHA-256 theo golden vector đã duyệt. Hash dùng normalized input, UTF-8 byte sort và graph lồng nhau giữ multiplicity; không phụ thuộc ref/thứ tự/UUID/outcome/display state. Root review độc lập, SPEC PASS, STANDARDS không finding; root chạy **274 tests PASS**, ESLint/typecheck/OpenSpec strict PASS. SQL parity fixtures độc lập đã viết nhưng **NOT RUN / INCOMPLETE**, nên AC #2 vẫn chưa tick đầy đủ. Không sửa migration, không vận hành DB/deploy. Dừng ở checkpoint source này; Phase 3 durable commitment/TTL chưa release. [Evidence](../../openspec/changes/add-accession-preview-commitment/evidence.md).

## Phase 2 SQL parity — 2026-11-04

User authorize chạy parity; root chạy đúng committed fixture `2fd0d5c` trên PostgreSQL 15.1/UTF8 ở home server: **10/10 SQL assertions PASS**, khớp golden/Unicode bytes/hash phía ứng dụng (**24/24 tests PASS**). Fixture `ROLLBACK`, không còn helper tạm, normalizers không đổi; deployed security baseline **36/36 PASS**. [Runtime evidence](../../openspec/changes/add-accession-preview-commitment/phase-2-sql-parity-2026-11-04.md). AC #2 đạt; migration 233/Phase 1 SQL vẫn chưa chạy, không deploy, Phase 3/4 và full TASK-10 vẫn mở.

## Checkpoint 3 — Phase 3 source, 2026-11-04

User dispatch worker `gpt-6.1-sol/high`; root điều phối/review và chấp nhận **SOURCE ONLY**. Migration 234 + server orchestration giữ metadata/typed bindings/HMAC, source SHA/size write-once, owner/current analyst/service-only RPC, DB TTL30phút/lease/finished_at và transactional catalog/client recheck, không business writes hoặc lưu payload. Root tự chạy **18 files / 292 tests PASS**, ESLint/typecheck/OpenSpec strict/diff-check PASS. SPEC PASS; STANDARDS P2 về overload privilege đã sửa và re-review không finding. [Evidence](../../openspec/changes/add-accession-preview-commitment/evidence.md).

AC #3 vẫn chưa tick đầy đủ: migrations 233/234 và SQL/RLS/security/restart/TTL/runtime **NOT RUN / INCOMPLETE**; không deploy. Policy/key production chưa provision, thiếu cấu hình thì fail closed; coarse SHARE locks chờ TASK-7 benchmark. Phase 4 chưa release, TASK-11/12/13 và TASK-8 deferred gates giữ nguyên.

## Authorized DB checkpoint — 2026-11-04

User duyệt gate DB; worker `gpt-6.1-sol/high` áp dụng đúng committed migrations **233 → 234**, mỗi migration COMMIT và security **36/36 PASS** sau từng lần/cả cuối. Hai SQL migration giữ nguyên byte và nay bất biến. Fixture client lần đầu RED vì test gọi private normalizers dưới role authenticated; root review/commit/push bản sửa **chỉ fixture** `d24e8e0`, không nới grants hoặc sửa migration. Retry fixture client đạt **22 assertions + 5 denied-role + 6 malformed-input cases**; fixture commitment đạt **35 assertions**. Cả hai rollback sạch; synthetic data/helpers/preview/audit còn lại **0**. Root tự xác minh security/RLS/quyền và cleanup trên DB. [Runtime evidence](../../openspec/changes/add-accession-preview-commitment/phase-3-db-gate-2026-11-04.md).

AC **#1/#3 đạt cho implementation và gate SQL tương ứng**; AC #4/#5/#6 vẫn mở. Gate này thay các trạng thái unapplied/NOT RUN lịch sử cho hai migration và các fixture đã chạy; không chứng nhận exact-clock equality, concurrent races, restart, authenticated preview HTTP, retention/full TTL hoặc capacity. Home checkout/container không đổi, không deploy app hay provision key/policy. TASK-10 vẫn **In Progress**, Phase 4 chưa release, TASK-7/11/12/13 và TASK-8 deferred gates giữ nguyên.
