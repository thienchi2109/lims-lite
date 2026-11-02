---
id: TASK-10
title: Tạo preview bất biến và canonical hash
status: To Do
assignee: []
created_date: '2026-11-02'
labels: [excel-import, implementation]
dependencies: [TASK-8, TASK-9]
priority: high
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/138 (sub-issue #107).

OpenSpec dự kiến `add-accession-preview-commitment` (chưa tạo). Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #112 §§4–6,8 và #113 §§2–4,6–8.

Preview chỉ giữ durable commitment/safe metadata; full normalized payload và file chỉ được xử lý trong bộ nhớ request/browser. Không lưu workbook vào DB/Storage/temp app file/cache/log; không dùng legacy matching hoặc TASK-5/6 làm dependency.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 1 — một PR/session: adapter gọi shared canonical resolver v2 và canonical normalization; validate create/reuse/conflict, conditional phone/gender, optional fields ngay cả reuse, typed trusted identity, same-batch reuse UUID/identity duplicates và not_found collisions. Name+DOB đơn thuần không chứng minh identity; khác strong identity hợp lệ vẫn distinct; không overwrite existing identity.
- [ ] #2 Phase 2 — một PR/session: canonical `accession-intent-v1` và SQL/application parity fixtures, golden SHA256 `090da05ce3b97394845d98b5d3fde180f150b3d452b5f067155466859a4e908e`; giữ graph multiplicity, order/ref/filename independence, stable hash sau create/reuse, changed relation đổi hash.
- [ ] #3 Phase 3 — một PR/session: migration forward-only cho durable preparing/preview_ready/terminal metadata, owner binding, exact source SHA256, hash+canonicalization version, immutable commitment, server timestamps và hard logical TTL30phút; không lưu full normalized payload. Server rechecks supported version/revision/generations/current client resolution, rejects stale catalog; preparing lease/heartbeat contract được định nghĩa cho recovery TASK-12.
- [ ] #4 Phase 4 — một PR/session: authenticated analyst preview API tích hợp TASK-9, trả row-specific errors/summary mà không cấp official sample IDs; permission owner-only và RLS fail closed (manager không thay analyst); api-client bridge nơi có mutations từ browser, no-store responses; audit tối thiểu không PII/payload.
- [ ] #5 Source gate từng phase: focused RED→GREEN identity/drift/hash/immutability/expiry/authorization/audit tests, migration contract checks, scoped lint/typecheck/OpenSpec strict. Runtime session riêng sau authorization: apply committed migration qua home-server SSH/Docker, SQL tests + run_security_tests(), rollout rồi preview/restart/owner-isolation smoke. Ghi source/runtime evidence riêng.
- [ ] #6 Exit: preview commitment tồn tại qua restart, không business writes, không retained source/payload; TASK-11 dùng commitment để xác nhận cùng bytes và normalized intent. Purge/recovery workers chưa được coi hoàn tất trước TASK-12; TASK-7 giữ nghiệm thu stress/TTL/crash thật.
<!-- AC:END -->
