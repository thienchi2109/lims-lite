---
id: TASK-2
title: Chốt hợp đồng import nguyên tử và provenance
status: To Do
assignee: []
created_date: '2026-11-01'
labels: [excel-import, decision]
dependencies: []
priority: high
---

## Description

Chốt vòng đời batch từ preview đến xác nhận, tính nguyên tử, chống tạo trùng khi retry và bằng chứng nguồn gốc dữ liệu. Task này giải quyết quyết định #113; chưa triển khai bảng batch, RPC hay API.

Issue gốc: https://github.com/thienchi2109/lims-lite/issues/113

Roadmap: https://github.com/thienchi2109/lims-lite/issues/107

Prerequisite #108 đã đóng. Có thể giải quyết song song TASK-1; các điều kiện validation và danh mục phải nhất quán trước khi bắt đầu TASK-3.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Chốt trạng thái và dữ liệu batch cần lưu, vòng đời preview/xác nhận, thời hạn hiệu lực và cách kiểm tra lại quyền, danh mục, đối sánh khi xác nhận.
- [ ] #2 Chốt ranh giới transaction để chỉ tạo mẫu mới và chỉ định của chúng; một lỗi bất kỳ không để lại người, mẫu hoặc chỉ định được tạo dở từ lô.
- [ ] #3 Chốt analyst-only confirmation, enforcement phía server/database, RLS và audit; received_at dùng thời điểm xác nhận phía server chung cho lô.
- [ ] #4 Chốt idempotency, xác nhận đồng thời, retry sau timeout, tra cứu kết quả và cleanup để không tạo trùng hoặc mất khả năng truy vết.
- [ ] #5 Chốt metadata, SHA-256 file nguồn, hash payload chuẩn hóa và ánh xạ dòng–entity cần giữ; không lưu workbook nguồn hoặc toàn bộ payload chuẩn hóa, không âm thầm ghi đè danh tính.
- [ ] #6 Ghi hợp đồng, các tình huống thất bại/phục hồi và bằng chứng quyết định vào #113; không coi xác nhận là chữ ký điện tử.
<!-- AC:END -->
