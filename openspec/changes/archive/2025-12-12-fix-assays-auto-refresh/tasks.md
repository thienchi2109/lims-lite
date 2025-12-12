## 1. Implementation

- [x] 1.1 Thêm `router.refresh()` sau create/update thành công trong `AssayDefinitionDialog`
- [x] 1.2 Thêm `router.refresh()` sau delete thành công trong `DeleteAssayDialog`
- [x] 1.3 Đảm bảo refresh giữ nguyên `searchParams` (page, pageSize, search, specialtyId)
- [x] 1.4 (Tuỳ chọn) Optimistic local update cho dòng vừa sửa nếu UX cần tức thì

## 2. Verification

- [x] 2.1 Manager sửa tên/nhóm/đơn vị của một assay → bảng tự cập nhật, không cần F5
- [x] 2.2 Manager tạo assay mới → assay xuất hiện đúng theo filter/pagination hiện tại
- [x] 2.3 Manager xóa assay → assay biến mất khỏi bảng ngay sau thao tác
- [x] 2.4 Không phát sinh lỗi RLS hoặc regressions ở các dialog khác
