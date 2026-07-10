# Thay Thế Tài Khoản Khi Đổi Vai Trò

Vai trò của tài khoản là bất biến sau khi tạo. Không sửa `role` trên UI, API,
database dashboard, hoặc bằng SQL. Khi một người cần vai trò khác, sử dụng quy
trình thay thế tài khoản dưới đây.

## Quy Trình

1. Tạo tài khoản mới với định danh đăng nhập riêng và vai trò đúng.
2. Nếu tài khoản mới là `manager`, nhập email hợp lệ và xác nhận địa chỉ này
   đã được lưu làm đích nhận OTP.
3. Chuyển các công việc đang mở sang tài khoản mới theo quy trình nghiệp vụ
   phù hợp. Chỉ chuyển phần việc chưa hoàn thành.
4. Xác minh tài khoản mới đăng nhập được và có đúng quyền trước khi nghỉ hưu
   tài khoản cũ.
5. Dùng chức năng xóa người dùng để nghỉ hưu tài khoản cũ. Hệ thống sẽ đặt
   `deleted_at` và ban tài khoản Auth; không xóa cứng bản ghi.
6. Kiểm tra audit log để xác nhận việc tạo mới, tái phân công, và nghỉ hưu đã
   được ghi nhận.

## Điều Cấm

- Không chuyển quyền sở hữu lịch sử của mẫu, kết quả, phê duyệt, hoặc audit log.
- Không sao chép hay chuyển chữ ký điện tử của tài khoản cũ.
- Không xóa cứng tài khoản cũ, ngay cả khi người dùng không còn làm việc.
- Không dùng database dashboard để sửa `users.role`; trigger database sẽ từ chối
  thay đổi này.
