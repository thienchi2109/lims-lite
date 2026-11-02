---
id: TASK-3
title: Kiểm chứng năng lực và giới hạn import Excel
status: In Progress
assignee: []
created_date: '2026-11-01'
updated_date: '2026-11-02'
labels: [excel-import, prototype]
dependencies: [TASK-1, TASK-2]
priority: high
---

## Description

Sau khi chốt template và hợp đồng transaction, dùng prototype để kiểm chứng chi phí parse, validate, preview và commit nguyên tử; thay các giới hạn tạm bằng giới hạn có bằng chứng. Chưa bắt đầu khi TASK-1 hoặc TASK-2 còn mở.

Issue gốc: https://github.com/thienchi2109/lims-lite/issues/114

Roadmap: https://github.com/thienchi2109/lims-lite/issues/107

Các con số 10 MB, 500 người được xét nghiệm, 1.000 mẫu và 20.000 chỉ định chỉ là giả thuyết cần kiểm chứng, chưa phải cam kết hỗ trợ.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Xác định tiêu chí thời gian phản hồi, bộ nhớ, tài nguyên database và môi trường benchmark trước khi đánh giá đạt/không đạt.
- [ ] #2 Đo riêng parse, validation, preview và commit với dữ liệu tổng hợp ở ngưỡng thông thường, ngưỡng dự kiến và vượt ngưỡng; ghi cấu hình và cách tái lập.
- [ ] #3 Kiểm chứng hành vi lỗi, timeout, retry và rollback ở kích thước biên; không để lại dữ liệu tạo dở hoặc batch trùng.
- [ ] #4 Đề xuất giới hạn cuối cùng cho file, số người, mẫu và chỉ định từ số đo; ghi rõ giới hạn nào chưa có bằng chứng.
- [x] #5 Ghi bằng chứng và kết luận vào #114, phân biệt local/prototype với môi trường home server; benchmark database/deployment chỉ thực hiện trong môi trường và phạm vi đã được cho phép, không vận hành production từ workspace này.
<!-- AC:END -->

## Progress — 2026-11-02

- Worker `gpt-6.1-sol/high` đã thực hiện [prototype và bằng chứng local](../../docs/superpowers/specs/2026-11-02-import-capacity-evidence.md), kèm [số đo từng lượt](../../docs/superpowers/specs/2026-11-02-import-capacity-results.json).
- Root chạy độc lập: self-check 6/6 PASS; benchmark 15 trường hợp × 3 process riêng = 45/45 kết quả đúng kỳ vọng và trong budget local. Ngưỡng kết hợp 500/1.000/20.000 có parse ≤323,03 ms, validate ≤99,48 ms, preview ≤12,36 ms và peak RSS ≤163,29 MiB trong lần chạy root.
- Các số đo chỉ bao phủ CLI với validation/preview giới hạn. Chưa đo resolver/descriptor, durable preview/hash, commit DB, rollback/retry/idempotency, HTTP, concurrency hoặc home server. Chưa chốt cap sản phẩm; TASK-3 giữ `In Progress`, TASK-4 tiếp tục chờ.
- Hai reviewer độc lập chấp nhận phần prototype local; root xác minh scoped ESLint PASS và cập nhật/readback #114 (giữ mở). AC1–4 chưa đầy đủ; không tick các AC này theo số đo local.
