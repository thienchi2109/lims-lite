# Chỉ tiêu mới không hiện khi analyst chỉ định

## Bằng chứng

- Ngày 2026-09-10, kiểm tra chỉ đọc qua SSH home server; checkout production
  `478ed83`, source kiểm tra `0d62612`.
- `CT-000295` (HBsAb định lượng) và `CT-000296` (HBsAg miễn dịch tự động)
  đã tồn tại, chưa bị xóa, nhưng không có review hoặc cặp tương thích trong
  revision 2 đang công bố. Không có revision nháp.
- Migration 229 chỉ khôi phục 84 chỉ tiêu tại thời điểm 2026-08-23. Thiết kế
  đã lưu không thiết lập quy tắc tự động cho chỉ tiêu tạo sau đó.
- `createAssayDefinition` lưu danh mục gốc, không công bố tương thích.
  `get_published_assay_sample_type_catalog` chỉ trả các cặp đã cấu hình và
  công bố. `TestAssignmentModule` lọc danh mục gốc theo kết quả này.

## Khóa tình huống

`tests/new-assay-availability.readonly.sql` gọi RPC danh mục với danh tính
analyst trong transaction chỉ đọc. Chạy qua đường SSH/Docker đã quy định:

```bash
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec -i lims-postgres psql -X -U postgres -d postgres -v ON_ERROR_STOP=1" \
  < tests/new-assay-availability.readonly.sql
```

Kết quả RED thực tế: exit 3,
`NEW_ASSAY_AVAILABILITY: absent from published revision 2: CT-000295, CT-000296`.
Đây là kiểm tra sự cố dữ liệu cụ thể, không phải test tự tạo fixture hay một
thay đổi quyền. Khi lỗi làm psql thoát, transaction tự rollback.

Test user-event trong `test-assignment-module-compatibility.test.tsx` xác nhận
chỉ tiêu mới vẫn ẩn nếu chỉ thêm vào danh mục gốc; sau khi mock revision mới
có cặp tương thích và mở lại module, analyst chọn và gửi payload revision mới
được. Đây là test mô tả hành vi hiện tại, không phải bằng chứng đã sửa production.
File này đạt 4/4 tests.

Test lân cận `sample-accession-compatibility.test.tsx` chạy riêng đạt 2/3;
test gửi chỉ định lỗi do mock API thiếu `assignManualAccessionTestsClient`.
File và runtime liên quan không thay đổi trong nhánh điều tra này.

## Phạm vi xử lý tiếp

- Khôi phục vận hành: manager tạo revision mới từ revision 2, cấu hình loại
  mẫu phù hợp cho hai chỉ tiêu, review và công bố qua workflow hiện có.
  Phải xác nhận loại mẫu và phê duyệt thao tác trước khi ghi production.
- Ngăn tái diễn: làm rõ bước cấu hình/công bố tương thích sau khi tạo chỉ tiêu;
  chốt UX và viết test RED trước khi sửa runtime.
- Không bỏ bộ lọc tương thích, tự gán mọi loại mẫu, sửa migration 229 hoặc
  tự động công bố chỉ vì thao tác tạo chỉ tiêu thành công.

Lượt điều tra chỉ bổ sung test và tài liệu; chưa sửa runtime, chưa ghi DB.
