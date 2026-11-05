---
id: TASK-11
title: Commit import nguyên tử và provenance
status: In Progress
assignee: []
created_date: '2026-11-02'
labels: [excel-import, implementation, database]
dependencies: [TASK-10]
priority: high
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/139 (sub-issue #107).

OpenSpec: [`add-atomic-accession-confirmation`](../../openspec/changes/add-atomic-accession-confirmation/tasks.md). Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #113 §§3–9 và #112 §§4,6,8.

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

## Source release — 2026-11-05

User yêu cầu đi đúng thứ tự Backlog, hoãn UI/deploy tới bước tương ứng và dispatch worker `gpt-6.1-sol/high` làm TASK-11; root điều phối/review độc lập. Baseline source `be7eb5c7b8943fd4fb904e9c9aae7df41b29683a`. Bắt đầu bằng checkpoint artifact/schema/transaction/lock trước implementation, rồi các source phase review được theo AC #1–#3. Hợp đồng #112/#113 giữ nguyên; không ghép TASK-12/13.

TASK-10 source và scoped SQL gate đã có evidence; deployed HTTP/restart/retention/concurrency/full TTL/capacity chưa được chứng nhận. Migrations 233/234 đã áp dụng và bất biến. Phiên TASK-11 hiện chỉ source/fixture/review; apply migration, SQL runtime và deployment cần gate riêng, không suy quyền từ source release này. Phần chuẩn bị UI/deploy trước đó đã dọn, chưa có UI code hoặc production mutation.

## Phase 1 source checkpoint — 2026-11-05

Root chấp nhận **SOURCE ONLY** sau review độc lập SPEC/STANDARDS và sửa/re-review security checker để so toàn bộ policy với biểu thức đóng băng khi tạo migration. Migration 235 có receipt kiêm global unique intent claim, typed immutable mappings, private final validator/deferred receipt check và RLS/grants theo quyền hiện tại; chưa có confirmation entrypoint/business writes. Migrations 233/234 giữ nguyên byte.

Root tự chạy **4 files / 25 source tests PASS**, ESLint, typecheck, OpenSpec strict và whitespace PASS. OpenSpec đạt **8/28 tasks** gồm checkpoint và Phase 1; Phase 2 chưa release. [Evidence và hashes](../../openspec/changes/add-atomic-accession-confirmation/evidence.md). SQL fixture rollback-only đã viết nhưng **NOT RUN**; apply 235, SQL/RLS/security runtime, atomicity/concurrency/drift/TTL và runtime/exit AC vẫn **INCOMPLETE**, TASK-11/#139 giữ mở.

## Phase 2 source checkpoint — 2026-11-05

Root chấp nhận **SOURCE ONLY** sau worker `gpt-6.1-sol/high`, scout đọc mã `gpt-6-luna/max` và review độc lập SPEC/STANDARDS. Server preparation tái sử dụng parser/resolver/intent/HMAC/config, trả authorized succeeded receipt trước file/attestation/keys/expiry; migration 236 thêm service-only protected reader và private locked validator, không ghi business rows/receipt time/official IDs. Migrations 233–235 giữ nguyên byte.

Root tự chạy **6 files / 112 tests PASS**, touched ESLint, typecheck, OpenSpec strict và whitespace PASS. OpenSpec đạt **14/28 tasks**. Retained actual drift SQL fixture và concrete concurrency runbook đều **NOT RUN**; runtime/exit AC ở trên vẫn chưa tick. [Evidence](../../openspec/changes/add-atomic-accession-confirmation/evidence.md).

**Phase 3 BLOCKER:** validator trong migration 235 dòng 140–141 tham chiếu `assay.method_id` đã bị bỏ khỏi `assay_definitions`; `method_name` là text authority, còn nullable `results.method_id` là FK riêng. Không sửa migration 235. Trước release Phase 3 phải sửa validator bằng migration forward-only mới sau 236 và chốt method semantics; SQL validation cần authorization home-server riêng. TASK-11/#139 tiếp tục In Progress; chưa release Phase 3, TASK-12/13, UI hoặc DB/deploy.
