# TASK-4 — Phân chia triển khai import Excel

Trạng thái: **In Progress, chờ root review độc lập và GitHub sync**. Tài liệu này phân chia implementation; chưa có importer production. Không mở PR hoặc merge trong session TASK-4.

## Quyết định giữ nguyên và evidence

- [#112 / template v1](2026-11-01-excel-template-contract-design.md) và [#113 / atomic-provenance](2026-11-01-atomic-import-provenance-contract-design.md) đã được duyệt; không mở lại quyết định sản phẩm.
- [#114 / file-only evidence](2026-11-02-import-file-limit-evidence.md): original XLSX **<10.000.000 decimal bytes**, không có business count caps khách hàng/mẫu/chỉ định. Prototype local chỉ chứng minh phạm vi ghi trong evidence; giữ nguyên [JSON benchmark lịch sử](2026-11-02-import-capacity-results.json).
- Source baseline `76e01c7922909b3f42ee2a46da6afd09ea7e9629`; TASK-1/2/3 Done, PR135 merged. Published compatibility generations tồn tại trong DB foundation, nhưng chưa có importer snapshot/descriptor API. GitNexus index `0d62612` cũ hơn baseline nên dùng graph định vị rồi đối chiếu source migrations/actions hiện tại; không reindex.
- Hợp đồng tám sheet, literal Text, ngày ISO năm1900–2100, typed CCCD/CMND, conditional phone/gender, no name+DOB identity proof, no silent overwrite được giữ nguyên.
- Preview server-owned commitment durable TTL30phút; confirm gửi lại **đúng byte workbook gốc**. Không giữ workbook/full normalized payload ở DB/Storage/temp app file/cache/log. Business writes+success+global dedup claim+mapping+audit chung transaction. Timeout phải lookup; hard logical expiry khác lock-safe physical purge.

## Thứ tự và tiêu chí promote

Chỉ **một change import được promote tại một thời điểm**. Change duy nhất đủ bộ proposal/design/spec/tasks ở TASK-4 là [add-versioned-accession-template](../../../openspec/changes/add-versioned-accession-template/proposal.md). Các tên successor dưới đây là **planned paths, chưa tồn tại**, không phải implementation-ready specs. Chỉ tạo/promote successor sau khi root xác minh exit change trước; không tick task implementation trong session phân chia.

| Thứ tự / task | OpenSpec mapping | Scope và dependency | Exit / handoff | Traceability |
| --- | --- | --- | --- | --- |
| 1 / [TASK-8](../../../backlog/tasks/task-8%20-%20Tao-va-tai-template-tiep-nhan-co-phien-ban.md) | `openspec/changes/add-versioned-accession-template/` — promoted proposal | Published snapshot authority + descriptor + generator/download; sau TASK-4 | Template v1, verifier và snapshot shape sẵn sàng, source/SQL/deployed download gates tách biệt | #112 §§2–5,7–9 |
| 2 / [TASK-9](../../../backlog/tasks/task-9%20-%20Parse-va-validate-workbook-template.md) | `openspec/changes/add-accession-workbook-validation/` — planned | Safe parser/structural validation; sau8; chưa match identity | In-memory typed rows/errors thật, fail closed resource/workbook guards, không writes | #112 §§3–5,7–9; #114 |
| 3 / [TASK-10](../../../backlog/tasks/task-10%20-%20Tao-preview-bat-bien-va-canonical-hash.md) | `openspec/changes/add-accession-preview-commitment/` — planned | Canonical resolver v2 + same-batch guards + normalized hash + durable commitment/preview API; sau8,9 | Owner-bound immutable commitment30phút qua restart; no business writes; contract preparing/lease | #112 §§4–6,8; #113 §§2–4,6–8 |
| 4 / [TASK-11](../../../backlog/tasks/task-11%20-%20Commit-import-nguyen-tu-va-provenance.md) | `openspec/changes/add-atomic-accession-confirmation/` — planned | SQL atomic confirmation/global dedup/provenance; sau10 | One-transaction receipt/rows/mappings/audit; rollback/concurrency SQL proof | #113 §§3–9; #112 §§4,6,8 |
| 5 / [TASK-12](../../../backlog/tasks/task-12%20-%20Xac-nhan-HTTP-tra-cuu-va-recovery-import.md) | `openspec/changes/add-accession-confirmation-recovery/` — planned | Confirm/status HTTP + preparing recovery + lock-safe purge; sau9,10,11 | Reupload identical bytes, status before retry, no false failure; recovery/purge testable | #113 §§3–8; #114 runtime handoff |
| 6 / [TASK-13](../../../backlog/tasks/task-13%20-%20Giao-dien-import-tieng-Viet.md) | `openspec/changes/add-vietnamese-accession-import-workflow/` — planned | Vietnamese entry/upload/preview/confirm/receipt/retry UI; sau8–12 | Accessible integrated flow, no blind replay; app/browser smoke evidence đúng scope | #112 §9; #113 §§4–6,8 |
| 7 / [TASK-7](../../../backlog/tasks/task-7%20-%20Nghiem-thu-capacity-va-atomicity-import-thuc.md) / #134 | Evidence gate, không umbrella OpenSpec | Direct prerequisites TASK-8–13; sau implementation | DB/HTTP/end-to-end capacity/atomicity/security/recovery proof + root review | Các runtime AC chuyển từ #114; toàn bộ #112/#113 |

TASK-4 không chờ TASK-7. TASK-5/6 là lane observation/legacy retirement riêng, không chặn canonical-v2 importer; không ghép cleanup vào các change trên. Các phase trong từng task tương ứng một PR/session review được; runtime session không tự được authorize từ việc tạo backlog/spec.

GitHub implementation mapping đã được root tạo thực và gắn sub-issue của #107: TASK-8 [#136](https://github.com/thienchi2109/lims-lite/issues/136), TASK-9 [#137](https://github.com/thienchi2109/lims-lite/issues/137), TASK-10 [#138](https://github.com/thienchi2109/lims-lite/issues/138), TASK-11 [#139](https://github.com/thienchi2109/lims-lite/issues/139), TASK-12 [#140](https://github.com/thienchi2109/lims-lite/issues/140), TASK-13 [#141](https://github.com/thienchi2109/lims-lite/issues/141). Dependencies/issue bodies do root sync theo cùng DAG; issue tồn tại không chứng minh implementation.

## Phân bổ kiểm thử và trách nhiệm

| Invariant / risk | Owner implementation + focused proof | Runtime acceptance |
| --- | --- | --- |
| Analyst-only, withdrawn role, owner isolation, manager không confirm thay | 8 snapshot/download;10 preview/RLS;11 commit/RLS;12 APIs;13 entry | TASK-7 AC1,8 qua DB/API thật |
| RLS/grants/search_path, safe audit không payload/PII | 8/10/11/12: migration+SQL regression/security gate theo phase | TASK-7 AC5,8; run_security_tests() sau từng migration |
| Snapshot authority + descriptor/tampering/version/revision/generation/pair drift | 8 generator/verifier;9 integrity;10 resolve;11 lock-safe recheck | TASK-7 AC1,6,7; catalog publish đồng thời confirm |
| Canonical identity/conditional fields/same-batch collisions | 9 syntax;10 shared resolver guards;11 recheck/serialize, không silent reuse↔create | TASK-7 AC1,5,7: reused/new/conflict/distinct/actor isolation |
| Canonical normalized intent/golden hash, order/ref independence, multiplicity | 10 canonical vectors;11 SQL parity/global unique successful claim | TASK-7 AC1,6; hash stable sau create/reuse |
| Last-row error + rollback clients/samples/assignments/mappings/audit | 9 all-or-nothing parse;11 SQL injected failures | TASK-7 AC3–6 counts/receipt/common received_at |
| Retry/concurrency/deadlock/unknown outcome/crash | 11 DB locks+unique claim;12 status/recovery;13 UI lookup | TASK-7 AC2,5–7 before/after-commit faults |
| Durable commitment TTL30phút, preparing lease, lock-safe purge | 10 schema/deadline;11 admission under lock;12 runner/recovery/purge | TASK-7 AC7; accepted transaction không bị expiry hủy |
| File <10.000.000, no business count caps, ZIP/XML/actual inflate/time/memory | 9 parser defenses;12 upload+confirm boundaries;13 size UX | TASK-7 AC2–4 app/proxy thật,9.999.999 valid vs10.000.000/10.000.001 bytes |
| No workbook/full normalized payload retention kể cả temp/cache/proxy/log | 8 generated download;9/10/11 request/schema;12 HTTP/runtime path;13 browser memory | TASK-7 AC4,5,7,8: disk/cache/log/DB/backups inspection trong môi trường được phép |
| Vietnamese errors/accessibility/quality attestation/official IDs sau commit | 8 download;9 errors;10 summary;12 safe state;13 workflow | TASK-7 AC3,5,6,8 browser/end-to-end |

Golden normalized-intent SHA256: `090da05ce3b97394845d98b5d3fde180f150b3d452b5f067155466859a4e908e`. Reuse canonical date/phone/name/client resolver; không viết identity heuristic riêng trong parser.

## Gate source, migration, security, rollout và acceptance

1. **Source** — owner từng phase: RED→GREEN focused tests (không chỉ mirror implementation), lint/typecheck khi chạm app, OpenSpec strict, diff review; migration source checks chỉ chứng minh text contract. TASK-4 chỉ chạy docs/ref/DAG/OpenSpec checks.
2. **Migration** — owner8/10/11/12: số mới forward-only, baseline assertions, resulting-state checks; không sửa migration đã áp dụng kể cả untracked. SQL regression chạy qua Docker psql trên home server sau authorization riêng; không local production DB, không Supabase MCP/CLI.
3. **Security** — sau **mỗi migration** chạy `SELECT * FROM run_security_tests();`, role/owner/RLS/grants/audit cases. RLS policy dùng DROP POLICY IF EXISTS trước CREATE và explicit role checks. PASS của source regex không thay SQL execution.
4. **Rollout** — owner change có runtime surface: chỉ home server `khoa-xn-cdc@100.93.19.42`, checkout `/opt/lims-lite`, SSH BatchMode và `sudo -n docker exec ... lims-postgres psql`; committed source/image/config revisions, authorized migration/app operations, public/app smoke. Workspace chỉ source/test/commit/push; không vận hành Docker/Tunnel/DB.
5. **Runtime acceptance** — TASK-7 sau8–13: chốt môi trường/DB baseline/budgets trước measurements; parser actual inflate/CRC/ZIP/XML safety, HTTP/proxy limits cả preview và confirm, DB transaction/locks/recovery/end-to-end; không suy từ prototype watchdog hoặc source checks. Ghi PASS/INCOMPLETE/DISPOSABLE ONLY đúng subject, timestamp/commands/actor/revision và known limits; root review rồi mới đóng.

Prototype technical guards32MiB declared inflated/256 ZIP entries/160k declared cells và watchdog là experimental. Không coi chúng là production capacity hoặc approved business caps; mọi thay đổi làm không đáp ứng contract phải đưa trade-off cụ thể lại quyết định, không âm thầm thêm caps/retention.

## Entry UI và open questions còn lại

- Placement đề xuất cho implementation: `/analyst/accession`, `AccessionPageHeader` cạnh “Tiếp nhận mẫu mới”, giữ WalkthroughTrigger; TASK-8 thêm “Tải template Excel”, TASK-13 thêm “Nhập từ Excel” mở chọn file→preview→confirm. Mobile xuống hàng, keyboard/focus đầy đủ, server analyst authorization. Không thêm duplicate entry ở `/samples` trong partition này. Đây là placement proposal theo trao đổi hiện tại, user có thể steer trước UI implementation.
- TASK-8 phase1 xác minh authority RPC generation/snapshot shape mới nhất; cơ chế HMAC và tests được chốt trong design. Key config/rotation phải không lộ secret; key nghỉ dùng làm descriptor fail closed, không tự cấp template TTL khác #112.
- TASK-9 promotion chốt actual inflate/ZIP/XML resource model dựa parser hiện có; giá trị guard production chưa được local benchmark phê chuẩn.
- TASK-12/TASK-7 chốt scheduler/recovery/purge/HTTP/DB/lock/poll budgets bằng runtime baseline; không hardcode đề xuất timeout thành guarantee. TASK-7 có authority đo trong môi trường riêng được cấp quyền, không phải permission chạy production từ TASK-4.
- Không còn decision blocker cho phân chia/generator proposal; runtime authorization và bằng chứng thuộc các gate sau. TASK-4 vẫn In Progress tới khi root độc lập review và cập nhật #115/#107/backlog; GitHub mapping #136–#141 đã được root cấp từ issues thực, không invent IDs.
