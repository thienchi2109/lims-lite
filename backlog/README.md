# Theo dõi chức năng import Excel

Backlog này theo dõi [Wayfinder #107](https://github.com/thienchi2109/lims-lite/issues/107): bốn task quyết định/prototype trước triển khai và hai task song song liên quan client canonical. Hoàn tất các quyết định chưa đồng nghĩa tính năng import đã hoàn tất; TASK-4 phải tạo các task implementation theo phân chia được duyệt.

## Danh sách task

| Task | Nội dung | Trạng thái | Phụ thuộc còn mở | Issue gốc |
| --- | --- | --- | --- | --- |
| [TASK-1](tasks/task-1%20-%20Chot-hop-dong-template-Excel-va-validation.md) | Chốt template Excel và validation | Done | Không | [#112](https://github.com/thienchi2109/lims-lite/issues/112) |
| [TASK-2](tasks/task-2%20-%20Chot-hop-dong-import-nguyen-tu-va-provenance.md) | Chốt import nguyên tử và provenance | Done | Không | [#113](https://github.com/thienchi2109/lims-lite/issues/113) |
| [TASK-3](tasks/task-3%20-%20Kiem-chung-nang-luc-va-gioi-han-import.md) | Kiểm chứng năng lực và giới hạn import | To Do | Không | [#114](https://github.com/thienchi2109/lims-lite/issues/114) |
| [TASK-4](tasks/task-4%20-%20Phan-chia-OpenSpec-va-task-trien-khai-import.md) | Phân chia OpenSpec và task triển khai | To Do | TASK-3 | [#115](https://github.com/thienchi2109/lims-lite/issues/115) |
| [TASK-5](tasks/task-5%20-%20Xac-minh-observation-va-approval-Gate-B.md) | Xác minh observation và approval Gate B | To Do | Evidence/runtime và approval chưa được xác minh | OpenSpec canonical integrity / legacy retirement |
| [TASK-6](tasks/task-6%20-%20Thuc-hien-retirement-client-legacy-Gate-B.md) | Thực hiện retirement client legacy Gate B | To Do | TASK-5 | OpenSpec legacy retirement |

TASK-1/2 đã hoàn tất; TASK-3 đủ điều kiện bắt đầu prototype #114 và TASK-4 còn chờ TASK-3. Dependency trong từng file task giữ toàn bộ quan hệ, còn bảng này chỉ liệt kê các dependency chưa hoàn tất.

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

Phần import template/parser, preview, batch confirmation/provenance và UI chưa có implementation được tìm thấy trong source/tests/migrations của lần scout này. #112/#113 là contract documents đã duyệt; task implementation cụ thể vẫn phải được tạo sau #114/#115.

## Phạm vi đã chốt

- Chỉ tiếp nhận mẫu mới đã lấy và đạt chất lượng, qua template `.xlsx` có phiên bản do LIMS tạo.
- Bắt buộc preview; chỉ analyst được xác nhận; có lỗi thì từ chối toàn bộ lô.
- Một người được xét nghiệm có nhiều mẫu; chỉ định thuộc mẫu. Đối sánh người có sẵn không âm thầm ghi đè danh tính.
- Không lưu workbook nguồn hoặc toàn bộ payload chuẩn hóa; giữ metadata, hash, audit và ánh xạ cần thiết theo hợp đồng sẽ chốt ở TASK-2.
- Không mở rộng sang đăng ký trước lấy mẫu, thêm chỉ định vào mẫu cũ hoặc ánh xạ cột Excel tùy ý.

## Cập nhật thủ công

Các file task dùng YAML frontmatter và acceptance checklist theo Backlog.md 1.54.0. Khi CLI không chạy được, sửa trực tiếp file trong `backlog/tasks/`: cập nhật `status`, `updated_date`, checklist và ghi bằng chứng hoàn tất. Khi CLI hoạt động, dùng `rtk backlog task list --plain` hoặc `rtk backlog task view 1 --plain` từ thư mục repo.

GitHub và OpenSpec vẫn là nguồn quyết định/spec; backlog không tự đồng bộ với GitHub. Khi đóng task, liên kết quyết định hoặc bằng chứng tương ứng và cập nhật thủ công cả hai nơi. Cập nhật bảng này khi đổi trạng thái task. TASK-4 phải tạo các task triển khai cụ thể sau khi chốt cách chia OpenSpec.

Checkpoint 2026-11-01: #112/#113 đã chốt; #114/#115 còn mở; #108, #109, #110, #111 và #117 đã đóng. Code chưa có luồng import Excel. Phần observation/cleanup client canonical tiếp tục được theo dõi riêng trong `openspec/changes/enforce-client-canonical-integrity/` và `openspec/changes/retire-client-canonical-legacy-paths/`.
