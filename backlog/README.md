# Theo dõi chức năng import Excel

Backlog này theo dõi bốn đầu việc của [Wayfinder #107](https://github.com/thienchi2109/lims-lite/issues/107). Đây là các quyết định và prototype trước triển khai; hoàn tất bốn task chưa đồng nghĩa tính năng import đã hoàn tất.

## Danh sách task

| Task | Nội dung | Trạng thái | Phụ thuộc còn mở | Issue gốc |
| --- | --- | --- | --- | --- |
| [TASK-1](tasks/task-1%20-%20Chot-hop-dong-template-Excel-va-validation.md) | Chốt template Excel và validation | Done | Không | [#112](https://github.com/thienchi2109/lims-lite/issues/112) |
| [TASK-2](tasks/task-2%20-%20Chot-hop-dong-import-nguyen-tu-va-provenance.md) | Chốt import nguyên tử và provenance | To Do | Không | [#113](https://github.com/thienchi2109/lims-lite/issues/113) |
| [TASK-3](tasks/task-3%20-%20Kiem-chung-nang-luc-va-gioi-han-import.md) | Kiểm chứng năng lực và giới hạn import | To Do | TASK-2 | [#114](https://github.com/thienchi2109/lims-lite/issues/114) |
| [TASK-4](tasks/task-4%20-%20Phan-chia-OpenSpec-va-task-trien-khai-import.md) | Phân chia OpenSpec và task triển khai | To Do | TASK-3 | [#115](https://github.com/thienchi2109/lims-lite/issues/115) |

TASK-1 đã hoàn tất. Có thể bắt đầu TASK-2; TASK-3 còn chờ TASK-2 và TASK-4 còn chờ TASK-3. Dependency trong từng file task giữ toàn bộ quan hệ, còn bảng này chỉ liệt kê các dependency chưa hoàn tất.

Người dùng đã duyệt [hợp đồng template phiên bản 1](../docs/superpowers/specs/2026-11-01-excel-template-contract-design.md) ngày 2026-11-01 sau review và verification độc lập; quyết định #112 hoàn tất, chưa triển khai tính năng.

## Phạm vi đã chốt

- Chỉ tiếp nhận mẫu mới đã lấy và đạt chất lượng, qua template `.xlsx` có phiên bản do LIMS tạo.
- Bắt buộc preview; chỉ analyst được xác nhận; có lỗi thì từ chối toàn bộ lô.
- Một người được xét nghiệm có nhiều mẫu; chỉ định thuộc mẫu. Đối sánh người có sẵn không âm thầm ghi đè danh tính.
- Không lưu workbook nguồn hoặc toàn bộ payload chuẩn hóa; giữ metadata, hash, audit và ánh xạ cần thiết theo hợp đồng sẽ chốt ở TASK-2.
- Không mở rộng sang đăng ký trước lấy mẫu, thêm chỉ định vào mẫu cũ hoặc ánh xạ cột Excel tùy ý.

## Cập nhật thủ công

Các file task dùng YAML frontmatter và acceptance checklist theo Backlog.md 1.54.0. Khi CLI không chạy được, sửa trực tiếp file trong `backlog/tasks/`: cập nhật `status`, `updated_date`, checklist và ghi bằng chứng hoàn tất. Khi CLI hoạt động, dùng `rtk backlog task list --plain` hoặc `rtk backlog task view 1 --plain` từ thư mục repo.

GitHub và OpenSpec vẫn là nguồn quyết định/spec; backlog không tự đồng bộ với GitHub. Khi đóng task, liên kết quyết định hoặc bằng chứng tương ứng và cập nhật thủ công cả hai nơi. Cập nhật bảng này khi đổi trạng thái task. TASK-4 phải tạo các task triển khai cụ thể sau khi chốt cách chia OpenSpec.

Checkpoint 2026-11-01: #112 đã chốt; #113–#115 còn mở; #108, #109, #110, #111 và #117 đã đóng. Code chưa có luồng import Excel. Phần observation/cleanup client canonical tiếp tục được theo dõi riêng trong `openspec/changes/enforce-client-canonical-integrity/` và `openspec/changes/retire-client-canonical-legacy-paths/`.
