---
id: TASK-1
title: Chốt hợp đồng template Excel và validation
status: To Do
assignee: []
created_date: '2026-11-01'
labels: [excel-import, decision]
dependencies: []
priority: high
---

## Description

Chốt hợp đồng workbook `.xlsx` có phiên bản cho tiếp nhận mẫu hàng loạt. Task này giải quyết quyết định #112, chưa triển khai parser, giao diện hay migration.

Issue gốc: https://github.com/thienchi2109/lims-lite/issues/112

Roadmap: https://github.com/thienchi2109/lims-lite/issues/107

Các prerequisite #109 (mã chỉ tiêu ổn định), #110 (tương thích chỉ tiêu–loại mẫu) và #111 (đối sánh người được xét nghiệm) đã đóng. Tái sử dụng các hợp đồng hiện có; không thiết kế lại chúng trong task này.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Chốt cấu trúc sheet Khách hàng, Mẫu, Chỉ định và các sheet danh mục; định nghĩa cột, kiểu dữ liệu, trường bắt buộc, phiên bản và tham chiếu tạm giữa các dòng/sheet.
- [ ] #2 Chốt cách đọc ngày, mã định danh và giá trị trống; xử lý trùng, tham chiếu thiếu và lỗi đối sánh theo hợp đồng client hiện có.
- [ ] #3 Chốt các đặc tính workbook được phép/bị cấm và lỗi theo sheet, dòng, cột bằng tiếng Việt, đủ rõ để người dùng sửa file.
- [ ] #4 Chốt kiểm tra mã chỉ tiêu, loại mẫu, compatibility revision và cách từ chối dữ liệu khi danh mục hoặc phiên bản thay đổi giữa tạo template, preview và xác nhận.
- [ ] #5 Ghi quyết định cùng ví dụ hợp lệ/không hợp lệ, câu hỏi đã giải quyết và liên kết tài liệu vào #112; không còn điểm mở trước khi đóng task.
<!-- AC:END -->
