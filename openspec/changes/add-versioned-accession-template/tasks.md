## 1. Phase 1 — Snapshot authority, một PR/session source

- [x] 1.1 Recheck current catalog/schema/RPC/grants baseline và next unused migration number; không chỉnh applied SQL, không coi Git status là bằng chứng chưa áp dụng.
- [x] 1.2 Viết và chạy RED focused snapshot/authorization tests: consistent revision, code→UUID/generations, active configured pairs, no orphan/stale/duplicate, missing revision/pair và analyst-only.
- [x] 1.3 Thêm additive forward-only snapshot RPC migration với baseline/result assertions, RLS/grants/revokes/search_path và security impact; giữ legacy catalog API/publish policy.
- [x] 1.4 Chạy GREEN source contract tests và OpenSpec strict; lưu riêng SQL runtime checks chưa chạy. Handoff schema snapshot cho phase2, không claim deployed readiness.

Phase 1 chỉ đạt source gate; [evidence và snapshot interface](phase-1-source-evidence.md). Migration 232 chưa áp dụng; SQL regression, run_security_tests() và runtime/concurrency gate **NOT RUN**. TASK-8 vẫn In Progress.

## 2. Phase 2 — Descriptor và generator, một PR/session source

- [x] 2.1 RED tests cho bounded signed metadata+authorityDigest+catalogDigest, tampered labels/method/codes/pairs/metadata, malformed/unknown key, restart verification, current authority drift và independent display-label changes.
- [x] 2.2 Dùng Node crypto HMAC-SHA256 server-only, canonical digest schemas và timing-safe MAC verification; không embed toàn catalog vào descriptor, không dependency mới/registry/workbook retention.
- [x] 2.3 RED→GREEN workbook round-trip tests đúng tám visible sheets/headers/order/metadata literal Text, input columns @, no seeded business rows; guide ISO1900–2100/typed identity/conditional fields/leading zeros/no business count caps theo #112.
- [x] 2.4 Dùng xlsx hiện có tạo workbook từ một snapshot, authenticated descriptor và server timestamp; fail closed config/version/catalog not ready hoặc output file không <10.000.000 bytes; không truncate catalog hoặc ghi temp file/cache/log.
- [x] 2.5 Chạy focused tests, scoped lint/typecheck và OpenSpec strict; snapshot+verifier handoff cho successor parser, source evidence không thay runtime gate.

Phase 2 chỉ đạt source gate; [evidence, canonical schemas và API handoff](phase-2-source-evidence.md). OpenSpec **9/19** tasks source complete; Phase 3/4 và overall TASK-8 vẫn **INCOMPLETE/In Progress**. Migration 232, SQL/security và deployed runtime gates chưa chạy.

## 3. Phase 3 — Download endpoint và Vietnamese control, một PR/session source

- [x] 3.1 Chốt header placement theo user steering; RED tests server analyst authorization, binary XLSX response/filename/no-store, unavailable catalog/config và safe Vietnamese errors.
- [x] 3.2 Thêm authenticated binary download route, không base64 JSON/file cache hoặc business mutations; giữ client-mutation api-client convention nếu có mutation invocation.
- [x] 3.3 Thêm “Tải template Excel” ở proposed AccessionPageHeader /analyst/accession, giữ walkthrough, mobile wrap; accessible name/focus/pending/error và keyboard interaction tests.
- [x] 3.4 GREEN focused route/UI tests, typecheck/scoped lint/React checks thích hợp, OpenSpec strict; review no secrets/PII/payload logging và no retained generated workbook.

Phase 3 đạt source gate: [route/UI và RED→GREEN evidence](phase-3-source-evidence.md), **111/111** focused/immediate-blast-radius tests. OpenSpec **13/19**; Phase 4 vẫn **NOT RUN**, overall TASK-8 **In Progress**. Source/mocked requests không chứng minh deployed download/proxy/no-retention hoặc SQL/security runtime.

## 4. Phase 4 — Migration, security và rollout, session runtime riêng

- [ ] 4.1 Xác nhận source phases đã review/committed và operations authorization cụ thể; chưa được cấp quyền thì ghi INCOMPLETE, không chạy production từ workspace.
- [ ] 4.2 Trên home-server checkout /opt/lims-lite qua SSH BatchMode, áp dụng committed new migration với sudo Docker psql ON_ERROR_STOP; lưu expected baseline/result state và migration revision.
- [ ] 4.3 Chạy focused SQL regression và SELECT * FROM run_security_tests() sau migration; analyst/manager/anonymous/RLS/grants checks PASS, PII-free evidence timestamp/command/outcome.
- [ ] 4.4 Cấu hình server-only signing secret và rollout app; tải binary qua app/proxy thật, verify workbook/layout/types/consistent binding và no-retention/no-store; ghi image/app/config revisions không ghi secret.
- [ ] 4.5 Kiểm tra fail-closed missing/retired-key behavior và restart verification bằng synthetic catalog; rollback app surface nếu lỗi, SQL fix chỉ bằng migration mới.
- [ ] 4.6 Root review source/SQL/deployed gates riêng, cập nhật TASK-8/#136 và #107; chỉ promote successor TASK-9 sau exit verified. Whole-importer DB/HTTP/end-to-end capacity/atomicity/recovery vẫn ở TASK-7/#134 sau TASK-9–13.
