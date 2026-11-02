---
id: TASK-11
title: Commit import nguyên tử và provenance
status: To Do
assignee: []
created_date: '2026-11-02'
labels: [excel-import, implementation, database]
dependencies: [TASK-10]
priority: high
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/139 (sub-issue #107).

OpenSpec dự kiến `add-atomic-accession-confirmation` (chưa tạo). Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #113 §§3–9 và #112 §§4,6,8.

SQL atomic boundary sở hữu business writes, success state, durable global successful-intent claim, row mappings và audit trong một transaction. API/browser không được lần lượt gọi single-accession mutation để giả atomic batch.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 1 — một PR/session: migration mới cho global unique successful normalized-intent claim và immutable minimal provenance/row mappings/receipt; RLS owner/role/grants/search_path, retention tách commitment TTL khỏi durable receipt/dedup/audit; không giữ workbook/full normalized payload hoặc thêm business count caps.
- [ ] #2 Phase 2 — một PR/session: confirmation function lấy batch lock, xác thực actor/role/quality attestation/commitment/source hash/normalized hash/expiry tại thời điểm accept; serialize catalog publish/generation/pair và client-resolution drift trước writes. Không silently reuse↔create hoặc overwrite identity; common DB received_at/official IDs chỉ cấp trong commit.
- [ ] #3 Phase 3 — một PR/session: tạo clients/samples/assignments cùng success+dedup+mapping+audit atomic; rollback/savepoint giữ safe failed state/audit khi kết nối còn tốt; same batch trả receipt cũ, hai batch cùng hash chỉ một success, không lộ receipt actor khác. Terminal attempt không replay; new linked attempt sau failure/expiry.
- [ ] #4 Focused RED→GREEN SQL scenarios: fail sau client/sample/assignment cuối/mapping/audit, counts before/after, same-batch và cross-batch concurrent confirm, catalog/client drift, withdrawn role, lock-time TTL, no premature IDs, hash parity; source contract tests/lint/typecheck/OpenSpec strict chỉ chứng minh phạm vi tương ứng.
- [ ] #5 Runtime session riêng sau authorization: baseline assertions/migration apply home-server SSH/Docker, SQL regression và run_security_tests() PASS, rollout-compatible RPC smoke và evidence PII-free. Không sửa applied migration. Actual crash/network/HTTP budgets và full dataset stress còn ở TASK-7 sau TASK-12/13.
- [ ] #6 Exit: function invariants có SQL evidence đúng môi trường, minimal durable receipt/mappings/dedup/audit cùng business commit; handoff terminal/unknown-outcome semantics và locks cho TASK-12. Nếu chưa runtime-authorized ghi INCOMPLETE, không tick SQL runtime gate nhờ source tests.
<!-- AC:END -->
