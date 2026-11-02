---
id: TASK-4
title: Phân chia OpenSpec và task triển khai import Excel
status: To Do
assignee: []
created_date: '2026-11-01'
updated_date: '2026-11-02'
labels: [excel-import, decision]
dependencies: [TASK-3]
priority: medium
---

## Description

Chuyển các quyết định và bằng chứng đã chốt thành các OpenSpec nhỏ, triển khai và review độc lập, theo đúng thứ tự phụ thuộc. TASK-3 phụ thuộc TASK-1 và TASK-2 nên task này chỉ bắt đầu sau khi cả ba hoàn tất.

Issue gốc: https://github.com/thienchi2109/lims-lite/issues/115

Roadmap: https://github.com/thienchi2109/lims-lite/issues/107

Không tạo một OpenSpec khổng lồ cho toàn bộ tính năng; không coi việc đóng các decision ticket là hoàn tất implementation.

Quyết định ngày 2026-11-02: file phải nhỏ hơn 10.000.000 bytes, không có count caps nghiệp vụ. TASK-3 chỉ đóng prototype local; [TASK-7](task-7%20-%20Nghiem-thu-capacity-va-atomicity-import-thuc.md) là gate nghiệm thu runtime sau triển khai, không chặn việc phân chia ở TASK-4. Lập lịch **generator/download template có phiên bản trước**, rồi parser/validation, preview và confirmation theo dependency thực tế. Khi tạo các task implementation này, liên kết chúng làm prerequisite của TASK-7; không invent ID tương lai hoặc coi gate đã đạt từ prototype.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phân chia các kết quả đã chốt thành change có phạm vi, dependency, tiêu chí thoát và nguồn truy vết rõ ràng; lập lịch generator/download template trước và chọn change đầu tiên đủ điều kiện promote.
- [ ] #2 Bao phủ phần chức năng còn thiếu: tạo template có phiên bản, parse/validation, preview, xác nhận nguyên tử/idempotency/provenance và giao diện tiếng Việt.
- [ ] #3 Phân bổ kiểm thử cho quyền analyst, RLS/audit, đối sánh danh tính, catalog drift, rollback toàn lô, retry/concurrency và file <10.000.000 bytes; giữ TASK-7 làm gate DB/HTTP/end-to-end sau implementation, không phải dependency chặn TASK-4.
- [ ] #4 Tạo các task triển khai cụ thể trong backlog theo phân chia được duyệt, liên kết OpenSpec tương ứng và chia phase đủ nhỏ cho một PR/session review được; liên kết prerequisite runtime thực tế vào TASK-7 khi chúng có ID.
- [ ] #5 Xác định riêng các gate migration, security tests, rollout và nghiệm thu trên home server; trạng thái triển khai/xác minh chỉ đóng khi có bằng chứng thực tế và đúng phạm vi được phép.
- [ ] #6 Cập nhật #115, #107 và chỉ mục backlog với thứ tự thực hiện, task mới và các câu hỏi còn lại trước khi đóng task.
<!-- AC:END -->
