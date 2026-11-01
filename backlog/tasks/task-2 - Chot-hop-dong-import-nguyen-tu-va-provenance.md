---
id: TASK-2
title: Chốt hợp đồng import nguyên tử và provenance
status: Done
assignee: []
created_date: '2026-11-01'
updated_date: '2026-11-01'
labels: [excel-import, decision]
dependencies: []
priority: high
---

## Description

Chốt vòng đời batch từ preview đến xác nhận, tính nguyên tử, chống tạo trùng khi retry và bằng chứng nguồn gốc dữ liệu. Task này giải quyết quyết định #113; chưa triển khai bảng batch, RPC hay API.

Issue gốc: https://github.com/thienchi2109/lims-lite/issues/113

Roadmap: https://github.com/thienchi2109/lims-lite/issues/107

Prerequisite #108 đã đóng. TASK-1/#112 đã được người dùng duyệt ngày 2026-11-01; draft này kế thừa hợp đồng template đó, không mở lại client matching/catalog decisions.

Bản hợp đồng đã duyệt: [Hợp đồng import nguyên tử và provenance](../../docs/superpowers/specs/2026-11-01-atomic-import-provenance-contract-design.md).
Đã soạn state machine, commitment-only preview 30 phút, confirm gửi lại cùng file, atomic transaction, server receipt, authorization/RLS/audit, canonical hashes, retry/recovery và retention/mappings.
Người dùng đã xác nhận “duyệt” ngày 2026-11-01 đối với bản đã review tại commit `38dff1c`; các acceptance criteria đã chốt ở phạm vi quyết định #113. Chưa triển khai runtime; caps/timeout thuộc #114, partition OpenSpec thuộc #115.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Chốt trạng thái và dữ liệu batch cần lưu, vòng đời preview/xác nhận, thời hạn hiệu lực và cách kiểm tra lại quyền, danh mục, đối sánh khi xác nhận.
- [x] #2 Chốt ranh giới transaction để chỉ tạo mẫu mới và chỉ định của chúng; một lỗi bất kỳ không để lại người, mẫu hoặc chỉ định được tạo dở từ lô.
- [x] #3 Chốt analyst-only confirmation, enforcement phía server/database, RLS và audit; received_at dùng thời điểm xác nhận phía server chung cho lô.
- [x] #4 Chốt idempotency, xác nhận đồng thời, retry sau timeout, tra cứu kết quả và cleanup để không tạo trùng hoặc mất khả năng truy vết.
- [x] #5 Chốt metadata, SHA-256 file nguồn, hash payload chuẩn hóa và ánh xạ dòng–entity cần giữ; không lưu workbook nguồn hoặc toàn bộ payload chuẩn hóa, không âm thầm ghi đè danh tính.
- [x] #6 Ghi hợp đồng, các tình huống thất bại/phục hồi và bằng chứng quyết định vào #113; không coi xác nhận là chữ ký điện tử.
<!-- AC:END -->

## Review and Verification

- Root yêu cầu và xác minh hai bản sửa: durable errors không giữ temporary refs kể cả hợp lệ; hard logical expiry 30 phút tách khỏi physical purge khi lock-safe và không hủy transaction đã được chấp nhận.
- Root chạy độc lập SHA-256 vector trong tài liệu, kiểm tra 10 local links của contract, privacy/expiry boundaries và giới hạn 350 dòng: PASS. Đây là kiểm tra contract, chưa phải test atomic import runtime.
- Đối chiếu OpenSpec liên quan đã ghi trong backlog README; source migration contract tests chạy lại 25/25 PASS nhưng không chứng minh current production hoặc completion của #113.
