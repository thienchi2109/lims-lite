# Theo dõi chức năng import Excel

Backlog này theo dõi [Wayfinder #107](https://github.com/thienchi2109/lims-lite/issues/107): bốn task quyết định/prototype/phân chia, hai task song song client canonical, sáu task implementation và TASK-7 nghiệm thu importer thực sau triển khai. [Phân chia TASK-4](../docs/superpowers/specs/2026-11-02-import-implementation-partition.md) Done sau root review/verification và GitHub sync đã merge vào `main` từ commit `c2372c7`; chưa có implementation của importer.

## Danh sách task

| Task | Nội dung | Trạng thái | Phụ thuộc còn mở | Issue gốc |
| --- | --- | --- | --- | --- |
| [TASK-1](tasks/task-1%20-%20Chot-hop-dong-template-Excel-va-validation.md) | Chốt template Excel và validation | Done | Không | [#112](https://github.com/thienchi2109/lims-lite/issues/112) |
| [TASK-2](tasks/task-2%20-%20Chot-hop-dong-import-nguyen-tu-va-provenance.md) | Chốt import nguyên tử và provenance | Done | Không | [#113](https://github.com/thienchi2109/lims-lite/issues/113) |
| [TASK-3](tasks/task-3%20-%20Kiem-chung-nang-luc-va-gioi-han-import.md) | Prototype local và file <10 MB decimal | Done | Không | [#114](https://github.com/thienchi2109/lims-lite/issues/114) |
| [TASK-4](tasks/task-4%20-%20Phan-chia-OpenSpec-va-task-trien-khai-import.md) | Phân chia OpenSpec và task triển khai | Done | Không | [#115](https://github.com/thienchi2109/lims-lite/issues/115) |
| [TASK-5](tasks/task-5%20-%20Xac-minh-observation-va-approval-Gate-B.md) | Xác minh observation và approval Gate B | To Do | Evidence/runtime và approval chưa được xác minh | OpenSpec canonical integrity / legacy retirement |
| [TASK-6](tasks/task-6%20-%20Thuc-hien-retirement-client-legacy-Gate-B.md) | Thực hiện retirement client legacy Gate B | To Do | TASK-5 | OpenSpec legacy retirement |
| [TASK-8](tasks/task-8%20-%20Tao-va-tai-template-tiep-nhan-co-phien-ban.md) | Published snapshot, descriptor, generator/download có phiên bản | In Progress — 4.4/4.6 DEFERRED; người dùng tự kiểm tra sau | Không | [#136](https://github.com/thienchi2109/lims-lite/issues/136) |
| [TASK-9](tasks/task-9%20-%20Parse-va-validate-workbook-template.md) | Safe parser và validation workbook | To Do | TASK-8 | [#137](https://github.com/thienchi2109/lims-lite/issues/137) |
| [TASK-10](tasks/task-10%20-%20Tao-preview-bat-bien-va-canonical-hash.md) | Canonical resolver/hash, durable preview commitment | To Do | TASK-8,9 | [#138](https://github.com/thienchi2109/lims-lite/issues/138) |
| [TASK-11](tasks/task-11%20-%20Commit-import-nguyen-tu-va-provenance.md) | Atomic SQL confirm, global dedup và provenance | To Do | TASK-10 | [#139](https://github.com/thienchi2109/lims-lite/issues/139) |
| [TASK-12](tasks/task-12%20-%20Xac-nhan-HTTP-tra-cuu-va-recovery-import.md) | HTTP confirm/status, recovery và purge | To Do | TASK-9,10,11 | [#140](https://github.com/thienchi2109/lims-lite/issues/140) |
| [TASK-13](tasks/task-13%20-%20Giao-dien-import-tieng-Viet.md) | Vietnamese upload/preview/confirm/receipt UI | To Do | TASK-8–12 | [#141](https://github.com/thienchi2109/lims-lite/issues/141) |
| [TASK-7](tasks/task-7%20-%20Nghiem-thu-capacity-va-atomicity-import-thuc.md) | Nghiệm thu capacity/atomicity DB/HTTP/end-to-end | To Do | TASK-8–13 (runtime thực) | [#134](https://github.com/thienchi2109/lims-lite/issues/134) |

TASK-1/2/3/4 đã hoàn tất trong phạm vi tương ứng; TASK-8 đang triển khai trên main chứa artifacts đã review. Dependency trong từng file task giữ toàn bộ quan hệ, còn bảng này chỉ liệt kê các dependency chưa hoàn tất. Generator/download đi trước; [add-versioned-accession-template](../openspec/changes/add-versioned-accession-template/proposal.md) đạt **17/19**: Phase 1–3 source PASS, migration 232 đã áp dụng, SQL/security và rollout app PASS theo [Phase 4 evidence](../openspec/changes/add-versioned-accession-template/phase-4-runtime-evidence.md). Ngày **2026-11-03**, người dùng defer **4.4/4.6** để tự kiểm tra sau; authenticated download/no-retention và exit review giữ **DEFERRED / chưa nghiệm thu**. Các successor OpenSpec trong mapping là planned paths chưa tồn tại; TASK-9 chưa bắt đầu. TASK-5/6 tiếp tục song song và không chặn canonical-v2 importer.

Quyết định người dùng 2026-11-02: chỉ giới hạn nghiệp vụ file **<10.000.000 bytes**, bỏ count caps khách hàng/mẫu/chỉ định và giữ phòng vệ tài nguyên kỹ thuật. [Bằng chứng mới](../docs/superpowers/specs/2026-11-02-import-file-limit-evidence.md): root chạy lại 10/10 self-check và 54 trials local, scoped ESLint PASS, hai reviewer chấp nhận; [bằng chứng cũ](../docs/superpowers/specs/2026-11-02-import-capacity-evidence.md) cùng JSON cũ giữ làm lịch sử. TASK-3 đã review/sync; các AC DB/HTTP/end-to-end cũ chưa được tick thành đạt mà chuyển TASK-7/#134. TASK-4 không chờ TASK-7; phân chia trước, chọn generator/download template làm change implementation đầu tiên, rồi liên kết task runtime thực làm prerequisite TASK-7.

Người dùng đã duyệt [hợp đồng template phiên bản 1](../docs/superpowers/specs/2026-11-01-excel-template-contract-design.md) ngày 2026-11-01 sau review và verification độc lập; quyết định #112 hoàn tất, chưa triển khai tính năng.

Người dùng đã duyệt [hợp đồng import nguyên tử/provenance](../docs/superpowers/specs/2026-11-01-atomic-import-provenance-contract-design.md) ngày 2026-11-01 sau root review và verification. TASK-5/6 theo dõi OpenSpec liên quan, không chặn importer mới dùng canonical resolver v2 đúng hợp đồng.

## Đối chiếu tiến độ OpenSpec bằng bằng chứng

Checkpoint 2026-11-01: checkbox chỉ dùng định vị task, không dùng làm bằng chứng hoàn thành hoặc chưa triển khai. Không cộng task Phase 7 của archive vào các change mới để tránh đếm hai lần.

| Phần việc | Bằng chứng đã kiểm tra | Kết luận và giới hạn |
| --- | --- | --- |
| Stable assay import codes | [Migration 201](../supabase/migrations/201_add_stable_assay_import_codes.sql), [contract tests](../tests/stable-assay-import-code-migration.test.ts), commits `bffe48c`/`2870eca`/`a0ebdf7` | Có implementation và test source; không suy current production từ archive 26/26. |
| Assay–sample compatibility | [Enforcement tests](../tests/assay-sample-type-enforcement-migration.test.ts), [Phase 9 historical evidence](../openspec/changes/archive/2026-08-21-add-assay-sample-type-compatibility/tasks.md) và migrations 204–213 | Có v2/published-catalog foundation; deployment evidence trong task file là lịch sử, không phải smoke mới. |
| Client/sample linkage và matching | [Migration 228](../supabase/migrations/228_add_transactional_client_sample_cutover.sql), [Phase 6 production record](../openspec/changes/archive/2026-08-29-add-deterministic-client-matching/phase-6-production-evidence.md), [Phase 7 reconciliation](../openspec/changes/archive/2026-08-29-add-deterministic-client-matching/tasks.md) | Có transaction cho một accession, không phải atomic bulk import. Phase 7 chuyển sang hai change bên dưới ở commit `eca575c`; đã tick 7.1–7.4 theo Gate A evidence và 7.9 sau khi đồng bộ truy vết. Giữ 7.5–7.8 vì thiếu một phần hoặc toàn bộ bằng chứng. Không đếm lại với successor changes. |
| Canonical integrity Gate A | [Migration 231](../supabase/migrations/231_enforce_client_canonical_integrity.sql), [preflight/post-apply record](../openspec/changes/enforce-client-canonical-integrity/gate-a-preflight-evidence.md), commit `b9e0247` | Có source và hồ sơ apply 2026-08-29 09:03:33 UTC. Tasks 4.1–4.3 là observation/handoff, không phải thiếu implementation Gate A. |
| Legacy retirement Gate B | [Proposal/design/tasks](../openspec/changes/retire-client-canonical-legacy-paths/tasks.md), [legacy lookup còn trong source](../src/app/actions/clients.ts), [API wrapper](../src/lib/api-client.ts) | Chưa xác minh approval, observation hoàn tất hoặc retirement closeout. Có entrypoint cũ; không quy toàn bộ 18 ô chưa tick thành 18 phần chưa triển khai. Theo dõi ở TASK-5/6. |
| Recovery danh mục/loại mẫu | [Sample-type record 2026-09-10](../docs/bug-sample-type-options-2026-09-10.md), [assay record cùng ngày](../docs/bug-new-assay-availability-2026-09-10.md) | Có evidence data restore/publication/read-back/security tests; hồ sơ ghi không deploy/restart app. Không đủ xác nhận current app revision hoặc window Gate B đã bắt đầu. |

Root chạy lại 2026-11-01: `rtk npm run test:run -- tests/stable-assay-import-code-migration.test.ts tests/assay-sample-type-enforcement-migration.test.ts tests/client-canonical-integrity-gate-migration.test.ts` → **25/25 PASS, 3 file**. Đây là migration contract tests đọc source; không chạy SQL, DB security tests hoặc browser/runtime smoke.

TASK-8 Phase 1 có [snapshot migration/source evidence](../openspec/changes/add-versioned-accession-template/phase-1-source-evidence.md); Phase 2 có [descriptor/verifier và generator XLSX](../openspec/changes/add-versioned-accession-template/phase-2-source-evidence.md); Phase 3 có [binary download endpoint/header control](../openspec/changes/add-versioned-accession-template/phase-3-source-evidence.md), 111/111 focused tests PASS. Chưa có parser, preview, batch confirmation/provenance hoặc import UI. #112/#113 là contract documents đã duyệt; TASK-8/#136 In Progress, TASK-9–13/#137–#141 To Do. TASK-4 chỉ thêm docs/backlog/OpenSpec. Source PASS không thay SQL/runtime acceptance.

Phase 4 được user authorize ngày 2026-11-02: migration 232 COMMIT, rollback-only SQL fixture PASS, `run_security_tests()` **36/36 PASS**; app source `9d9f193` deployed healthy trên home server. Root chạy lại SQL/security, anonymous denial `401/private, no-store` và synthetic key/restart/workbook checks trong runtime mới. Gate tải XLSX thành công bằng analyst qua app/proxy và deployed no-retention còn **INCOMPLETE**; giữ TASK-8 In Progress, chưa promote TASK-9. [Evidence và gate còn mở](../openspec/changes/add-versioned-accession-template/phase-4-runtime-evidence.md).

## Phạm vi đã chốt

- Chỉ tiếp nhận mẫu mới đã lấy và đạt chất lượng, qua template `.xlsx` có phiên bản do LIMS tạo.
- Bắt buộc preview; chỉ analyst được xác nhận; có lỗi thì từ chối toàn bộ lô.
- Một người được xét nghiệm có nhiều mẫu; chỉ định thuộc mẫu. Đối sánh người có sẵn không âm thầm ghi đè danh tính.
- Không lưu workbook nguồn hoặc toàn bộ payload chuẩn hóa; giữ metadata, hash, audit và ánh xạ cần thiết theo hợp đồng đã duyệt ở TASK-2.
- Không mở rộng sang đăng ký trước lấy mẫu, thêm chỉ định vào mẫu cũ hoặc ánh xạ cột Excel tùy ý.
- File <10.000.000 bytes, không có count caps nghiệp vụ; workbook vẫn phải hợp lệ và vượt resource guards thì từ chối toàn bộ.

## Cập nhật thủ công

Các file task dùng YAML frontmatter và acceptance checklist theo Backlog.md 1.54.0. Khi CLI không chạy được, sửa trực tiếp file trong `backlog/tasks/`: cập nhật `status`, `updated_date`, checklist và ghi bằng chứng hoàn tất. Khi CLI hoạt động, dùng `rtk backlog task list --plain` hoặc `rtk backlog task view 1 --plain` từ thư mục repo.

GitHub và OpenSpec vẫn là nguồn quyết định/spec; backlog không tự đồng bộ với GitHub. Khi đóng task, liên kết quyết định hoặc bằng chứng tương ứng và cập nhật thủ công cả hai nơi. Cập nhật bảng này khi đổi trạng thái task. Root đã sync/đọc lại #115/#107/#134, tạo #136–#141 dưới #107 và kiểm tra dependency graph theo TASK-8–13. Không mở PR/merge trong session phân chia; nhánh docs đã được merge vào main theo yêu cầu tiếp theo của người dùng.

Checkpoint 2026-11-02: #112/#113/#114 đã chốt; #115 Done, phân chia đã review và merge main; #136 OPEN/In Progress (17/19, SQL/deploy PASS, authenticated download/no-retention INCOMPLETE), #137–#141 OPEN/To Do; #134 runtime gate chờ cả sáu task. #108, #109, #110, #111 và #117 đã đóng. Code chưa có luồng import Excel. Phần observation/cleanup client canonical tiếp tục theo dõi riêng trong `openspec/changes/enforce-client-canonical-integrity/` và `openspec/changes/retire-client-canonical-legacy-paths/`. Nút download đã triển khai tại /analyst/accession header theo Phase 3 dispatch, giữ walkthrough/mobile accessibility; import placement vẫn là proposal. Resource/HTTP/DB/recovery/purge budgets còn chốt tại promotion/runtime gates, không là blocker phân chia.
