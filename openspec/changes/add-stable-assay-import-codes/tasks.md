## 1. Phase 1 - Database Core (PR/Session 1)

- [x] 1.1 Rebase trên `main`, đọc định nghĩa `assay_definitions` và migration mới nhất, rồi đối chiếu read-only với database trên home server qua SSH; xác nhận chưa có `import_code` và không có migration cạnh tranh chưa được xử lý.
- [x] 1.2 Viết regression test trước cho contract schema: sequence toàn cục `NO CYCLE`, định dạng `^CT-[0-9]{6}$`, backfill cả row đang hoạt động và đã xóa mềm, `NOT NULL`, uniqueness và trigger bất biến.
- [x] 1.3 Tạo một migration forward-only mới chỉ sở hữu database core: sequence có `MAXVALUE 999999`, column, backfill xác định theo `created_at` rồi UUID, default, constraints và bảo vệ cập nhật mã.
- [x] 1.4 Thêm security-impact comments và kiểm tra quyền sequence để client không nhận thêm quyền cấp mã trực tiếp; không thay đổi RLS hoặc quyền quản lý chỉ tiêu hiện có.
- [x] 1.5 Chạy focused migration tests và xác minh migration không sửa RPC, UI, mô hình phương pháp hoặc migration lịch sử.
- [x] 1.6 Hoàn tất PR/session 1 chỉ khi diff database core nhỏ, test đạt và migration chưa từng được áp dụng hoặc chỉnh sửa sau khi áp dụng.

## 2. Phase 2 - RPC And Application Contracts (PR/Session 2)

- [x] 2.1 Rebase và đọc định nghĩa mới nhất của `get_assay_definitions`, `get_assay_definition_by_id`, `create_assay_definition` và `update_assay_definition`, đặc biệt sau mọi change liên quan đến phương pháp.
- [x] 2.2 Viết regression test trước cho row shape của RPC: các hợp đồng đọc/tìm kiếm/tạo trả `import_code`, còn hợp đồng tạo/cập nhật không nhận mã từ client.
- [x] 2.3 Tạo migration forward-only riêng để mở rộng RPC, giữ nguyên `SECURITY DEFINER`, `search_path`, grant/revoke, phân trang, bộ lọc và toàn bộ field assay đang tồn tại.
- [x] 2.4 Bổ sung `import_code` vào read schema/type trong `src/types/lab.ts`, nhưng không thêm vào `CreateAssayDefinitionSchema` hoặc payload cập nhật.
- [x] 2.5 Cập nhật assay queries, mutations và API client để giữ mã trong kết quả tạo/đọc mà không cho phép gửi mã lên server.
- [x] 2.6 Chạy focused RPC, schema và server-action tests cùng `npm run typecheck`; xác minh không khôi phục `method_id` hoặc làm mất `method_name`.
- [x] 2.7 Hoàn tất PR/session 2 chỉ khi database contract tương thích ngược với ứng dụng cũ và application contract sẵn sàng cho UI mới.

## 3. Phase 3 - Manager Read-Only UI (PR/Session 3)

- [ ] 3.1 Viết component test trước cho bảng và chế độ xem chi tiết, yêu cầu hiển thị nhãn tiếng Việt `Mã chỉ tiêu` và giá trị do server trả về.
- [ ] 3.2 Hiển thị mã trong bảng quản lý chỉ tiêu với kích thước cột ổn định, nội dung dễ quét và không làm hỏng phân trang hoặc bộ lọc hiện có.
- [ ] 3.3 Hiển thị mã trong chế độ xem/sửa ở trạng thái chỉ đọc; hộp thoại tạo không có control nhập mã và mọi submit payload tiếp tục loại bỏ `import_code`.
- [ ] 3.4 Giữ `import_code` trong local table state sau callback tạo/cập nhật để không cần tải lại trang mới thấy mã.
- [ ] 3.5 Chạy focused component tests, `npm run typecheck` và lint cho vùng thay đổi; kiểm tra nội dung tiếng Việt có dấu và không có regression responsive.
- [ ] 3.6 Hoàn tất PR/session 3 chỉ khi quản lý xem được mã nhưng không có đường UI hoặc payload nào sửa được mã.

## 4. Phase 4 - Deployment And Runtime Verification (Session 4)

- [ ] 4.1 Xác nhận ba PR triển khai đã merge theo thứ tự, `main` sạch, các migration có số thứ tự duy nhất và chưa file nào từng áp dụng bị thay đổi.
- [ ] 4.2 Đồng bộ checkout `/opt/lims-lite` trên home server, áp dụng lần lượt các migration đã commit bằng `sudo -n docker exec ... lims-postgres psql -v ON_ERROR_STOP=1`.
- [ ] 4.3 Chạy SQL regression tests liên quan và `SELECT * FROM run_security_tests();`; lưu bằng chứng rằng mọi security check đều đạt.
- [ ] 4.4 Xác minh runtime: toàn bộ chỉ tiêu cũ, mới và đã xóa mềm có mã hợp lệ; sửa/xóa mềm không đổi mã; cập nhật trực tiếp mã bị từ chối; mã đã nghỉ dùng không được tái sử dụng.
- [ ] 4.5 Triển khai ứng dụng, chạy health check và smoke test trang quản lý chỉ tiêu để xác nhận list/detail/create đều trả hoặc hiển thị đúng mã.
- [ ] 4.6 Chạy quality gates cuối cho blast radius gồm focused tests, `npm run typecheck`, lint phù hợp và OpenSpec strict validation.
- [ ] 4.7 Cập nhật Issue #109 và Wayfinder #107 bằng bằng chứng triển khai, archive change `add-stable-assay-import-codes`, commit/push artifact archive và chỉ chuyển sang OpenSpec tiếp theo khi mọi điều kiện thoát đã đạt.
