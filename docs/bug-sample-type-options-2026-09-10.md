# Khôi phục loại mẫu khi tiếp nhận

Nguyên nhân: trước #110, `sample-type-selector.tsx` có 8 lựa chọn cố định.
Migration 205 chuyển sang danh mục `sample_types` nhưng chỉ nhập loại mẫu
đã có trong `samples` lịch sử; production chỉ có Máu. UI hiện đọc tất cả
loại mẫu đang hoạt động từ DB, không tự bổ sung 7 lựa chọn cũ.

Theo yêu cầu khôi phục tất cả, đã chạy script đã commit
`scripts/restore-accession-sample-types.sql` qua SSH home server và
`sudo -n docker exec -i lims-postgres psql`. Script kiểm tra baseline và
system manager, dùng INSERT dưới role authenticated với RLS/audit hiện có.
Transaction COMMIT thành công, không thay đổi schema hoặc migration cũ.

Read-back ngày 2026-09-10:

| Mã | Loại mẫu |
| --- | --- |
| LM-000001 | Máu |
| LM-000010 | Dịch niệu đạo/âm đạo |
| LM-000011 | Nước tiểu |
| LM-000012 | Phết tế bào âm đạo |
| LM-000013 | Ngoáy trực tràng/hậu môn |
| LM-000014 | Phân |
| LM-000015 | Nước |
| LM-000016 | Thực phẩm |

Mã do DB tự cấp; không giả định sequence liên tục.
`tests/sample-type-options.readonly.sql` chạy với quyền analyst: RED exit 3
thiếu đúng 7 tên trước apply, PASS exit 0 sau apply. Có 7 audit INSERT của
system manager; security tests 36/36 PASS. Revision tương thích 3 giữ nguyên.

Không deploy, restart app hoặc reload schema. Analyst tải lại màn hình để
lấy danh mục mới. Chưa smoke bằng trình duyệt; bằng chứng live là truy vấn
danh mục dưới RLS và read-back. Chỉ khôi phục lựa chọn loại mẫu; các loại mới
chưa có xét nghiệm tương thích đã công bố. Cần xác định và phê duyệt các cặp
phù hợp trước khi cấu hình/công bố, không tự gán mọi xét nghiệm cho mọi loại.
