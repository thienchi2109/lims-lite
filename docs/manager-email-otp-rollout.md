# Manager Email OTP Rollout

## Mục tiêu

Email OTP quản lý là bước xác thực bổ sung cho tài khoản `manager` sau đăng nhập mật khẩu. Tính năng này bảo vệ các phiên quản lý trên máy dùng chung nhưng không thay thế MFA chống phishing.

## Cấu hình bắt buộc

- `MANAGER_EMAIL_OTP_ENABLED`: bật OTP cho manager thường bằng `TRUE`; tắt bằng `FALSE`.
- `MANAGER_HIV_EMAIL_OTP_ENABLED`: bật OTP cho manager có `can_access_confidential = true` bằng `TRUE`; tắt bằng `FALSE`.
- `ANALYST_HIV_EMAIL_OTP_ENABLED`: bật OTP cho analyst có `can_access_confidential = true` bằng `TRUE`; tắt bằng `FALSE`.
  Flag này chỉ do operator cấu hình qua environment, không có UI quản trị.
- `MANAGER_OTP_EMAIL_PROVIDER`: dùng `resend` trong production.
- `RESEND_API_KEY`: API key của Resend.
- `MANAGER_OTP_EMAIL_FROM`: sender đã xác minh domain trong Resend.
- `MANAGER_OTP_EMAIL_REPLY_TO`: tùy chọn, dùng mailbox hỗ trợ nội bộ.
- `MANAGER_OTP_STEP_UP_SECRET`: khóa ký cookie step-up; nếu thiếu, hệ thống fallback sang `JWT_SECRET`.

## Thứ tự rollout production

1. Deploy UI xác thực OTP, route `/api/manager/otp/*`, workflow cấu hình email trong Quản lý người dùng, và cấu hình Resend.
2. Giữ `MANAGER_EMAIL_OTP_ENABLED=FALSE`, `MANAGER_HIV_EMAIL_OTP_ENABLED=FALSE`, và `ANALYST_HIV_EMAIL_OTP_ENABLED=FALSE`.
3. Quản trị viên cấu hình email nhận OTP cho từng tài khoản quản lý trong màn hình Quản lý người dùng.
4. Kiểm tra gửi email OTP bằng tài khoản thử nghiệm hoặc cohort nhỏ.
5. Bật từng flag theo cohort, ưu tiên cohort nhỏ trước.
6. Theo dõi log gửi mail, quota Resend, lỗi provider, lockout, và phản hồi từ người dùng.

## Recovery

Ứng dụng không giữ bootstrap exception cho manager chưa step-up khi cohort OTP đã bật. Nếu quản lý bị khóa do email sai hoặc không nhận được mã:

1. Tắt flag cohort liên quan.
2. Cập nhật email nhận OTP qua workflow quản trị hoặc quy trình database recovery được ghi nhận.
3. Kiểm tra gửi lại OTP.
4. Bật lại flag cohort.

Không gửi mã OTP qua chat nội bộ, không ghi plaintext OTP vào ticket, log, hoặc audit note.

## Giới hạn MVP

- Email OTP không phải phishing-resistant MFA.
- Admin email change audit đang được deferred trong OpenSpec task 2.3.
- Resend sender/domain và quota cần được theo dõi ngoài ứng dụng.
