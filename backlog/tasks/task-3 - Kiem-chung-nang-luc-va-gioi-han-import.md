---
id: TASK-3
title: Kiểm chứng prototype local và giới hạn dung lượng file import
status: Done
assignee: []
created_date: '2026-11-01'
updated_date: '2026-11-02'
labels: [excel-import, prototype]
dependencies: [TASK-1, TASK-2]
priority: high
---

## Description

Quyết định người dùng ngày 2026-11-02: chỉ giới hạn nghiệp vụ theo dung lượng file **nhỏ hơn 10 MB decimal = 10.000.000 bytes**, không áp trần số khách hàng/mẫu/chỉ định. File đúng 10.000.000 bytes cũng bị từ chối. Điều kiện dung lượng không thay validation workbook hoặc bảo đảm mọi file dưới ngưỡng đều xử lý được.

TASK-3 kiểm chứng prototype Node CLI local với dữ liệu tổng hợp: parse, tập validation hiện có và preview trong bộ nhớ. Giữ phòng vệ tài nguyên thử nghiệm: 32 MiB declared inflated bytes, 256 ZIP entries, 160.000 declared cells, watchdog và memory/time budgets; chưa coi đây là parser an toàn hoàn chỉnh hoặc SLO sản phẩm.

Issue gốc: https://github.com/thienchi2109/lims-lite/issues/114

Roadmap: https://github.com/thienchi2109/lims-lite/issues/107

Các số lượng 500/1.000/20.000 chỉ còn là kịch bản fixture lịch sử, không phải giới hạn hỗ trợ.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Khai báo môi trường, budget thời gian/bộ nhớ và phạm vi prototype local trước phép đo; không suy bằng chứng DB/production từ CLI.
- [x] #2 Bỏ COUNT_LIMIT nghiệp vụ; mỗi fixture 501 khách hàng, 1.001 mẫu và 20.001 chỉ định độc lập tạo preview đầy đủ; batch rỗng và các guard cấu trúc/canonical/tham chiếu/trùng vẫn từ chối.
- [x] #3 Workbook XLSX tổng hợp hợp lệ 9.999.999 bytes parse/validate/preview thành công; đúng 10.000.000 và 10.000.001 bytes từ chối FILE_LIMIT trước decode. Giữ preflight và watchdog, không cắt dòng hoặc tạo preview một phần.
- [x] #4 Chạy RED → GREEN self-check, scoped lint và benchmark tuần tự process riêng; lưu metrics mới, giữ nguyên JSON lịch sử, ghi rõ giới hạn và mọi nghĩa vụ đã chuyển TASK-7.
- [x] #5 Root review/verification độc lập và đồng bộ quyết định, bằng chứng, trạng thái #114/#107/#115 cùng backlog trước đóng TASK-3.
<!-- AC:END -->

## Historical progress — trước quyết định đổi scope 2026-11-02

- Worker `gpt-6.1-sol/high` đã thực hiện [prototype và bằng chứng local](../../docs/superpowers/specs/2026-11-02-import-capacity-evidence.md), kèm [số đo từng lượt](../../docs/superpowers/specs/2026-11-02-import-capacity-results.json).
- Root chạy độc lập: self-check 6/6 PASS; benchmark 15 trường hợp × 3 process riêng = 45/45 kết quả đúng kỳ vọng và trong budget local. Ngưỡng kết hợp 500/1.000/20.000 có parse ≤323,03 ms, validate ≤99,48 ms, preview ≤12,36 ms và peak RSS ≤163,29 MiB trong lần chạy root.
- Các số đo chỉ bao phủ CLI với validation/preview giới hạn. Khi đó TASK-3 giữ `In Progress`, TASK-4 tiếp tục chờ do AC cũ thiếu runtime/DB proof.
- Hai reviewer độc lập chấp nhận phần prototype local; root xác minh scoped ESLint PASS và cập nhật/readback #114 (giữ mở). Kết luận AC cũ là lịch sử.

## Scope change — 2026-11-02

AC cũ yêu cầu commit DB, rollback/retry, tài nguyên DB và chốt count caps nên từng được giữ chưa hoàn tất. Chúng **không được tick thành đã chứng minh**: quyết định file-only bỏ nghĩa vụ chốt count caps; phần runtime/DB/HTTP/end-to-end chuyển đầy đủ sang [TASK-7](task-7%20-%20Nghiem-thu-capacity-va-atomicity-import-thuc.md). TASK-4 được bắt đầu sau khi root đóng TASK-3; không chờ TASK-7.

Root đã kiểm tra độc lập 10/10 tests, scoped ESLint và 54/54 lượt benchmark; hai reviewer Spec/Standards chấp nhận. Đã đồng bộ và readback #107/#114/#115; [#134](https://github.com/thienchi2109/lims-lite/issues/134) theo dõi TASK-7, là sub-issue #107 và chỉ bị chặn bởi #115 ở giai đoạn phân chia. Đóng TASK-3 theo AC local đã sửa; các nghĩa vụ runtime vẫn chưa đạt và không bị xóa.

Bằng chứng hiện hành: [file-limit addendum](../../docs/superpowers/specs/2026-11-02-import-file-limit-evidence.md), [metrics mới](../../docs/superpowers/specs/2026-11-02-import-file-limit-results.json). JSON lịch sử được giữ nguyên; count caps/10 MiB trong báo cáo cũ đã bị quyết định mới thay thế. Không vận hành Docker/DB/SSH/Storage/deploy trong task này.
