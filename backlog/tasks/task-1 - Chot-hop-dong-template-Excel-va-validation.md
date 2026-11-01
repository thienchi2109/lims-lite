---
id: TASK-1
title: Chốt hợp đồng template Excel và validation
status: In Progress
assignee: []
created_date: '2026-11-01'
updated_date: '2026-11-01'
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

## Implementation Notes

Bản hợp đồng cụ thể để review: [Template Excel phiên bản 1](../../docs/superpowers/specs/2026-11-01-excel-template-contract-design.md).

- AC #1: phần 2–4; AC #2: phần 4–6; AC #3: phần 7 và 9; AC #4: phần 3 và 8; AC #5: phần 9–10.
- Đã đối chiếu live #107/#108/#111/#112, schema client/catalog và compatibility spec. Phần 1 phân biệt invariant đã chốt với đề xuất mới phần 2–9.
- Giữ `In Progress` và các AC chưa check: chờ review/xác nhận contract, rồi mới ghi quyết định và liên kết vào #112. Chưa triển khai parser/UI, chưa promote OpenSpec hoặc chốt cap #114.
- Root đã review độc lập ngày 2026-11-01 và yêu cầu sửa ba điểm: không coi name+DOB là unique identity, tách UI error context khỏi log/audit, và quy định rõ kiểu Text của metadata. Đã xác minh bản sửa với schema/spec và canonical resolver migrations 221–222.
- Root verification PASS: 19 liên kết local, tám tên sheet hợp lệ, ba tài liệu dưới 350 dòng, YAML/status, TASK-2–4 không đổi và `git diff --check`. Đây là kiểm tra tài liệu, không phải runtime/production smoke.
