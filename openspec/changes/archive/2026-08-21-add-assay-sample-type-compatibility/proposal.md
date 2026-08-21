## Why

LIMS hiện cho phép gán bất kỳ chỉ tiêu đang hoạt động cho bất kỳ giá trị `samples.type` nào, nên luồng tiếp nhận thủ công và bulk Excel không có nguồn sự thật để xác định tổ hợp loại mẫu - chỉ tiêu hợp lệ. Issue #110 phải được chốt trước hợp đồng workbook #112 để template có thể công bố một catalog đã duyệt và mọi luồng gán đều từ chối khi dữ liệu compatibility thiếu hoặc lỗi thời.

## What Changes

- Tạo catalog loại mẫu chuẩn với mã import ổn định, tên hiển thị tiếng Việt, trạng thái hoạt động và vòng đời xóa mềm; mẫu mới tham chiếu loại mẫu bằng định danh chuẩn thay vì chỉ dựa vào text tự do.
- Tạo catalog compatibility có revision toàn cục: mỗi revision là snapshot bất biến của các cặp chỉ tiêu - loại mẫu được phép, trạng thái review của từng chỉ tiêu, người lập, người publish, thời điểm và lý do duyệt.
- Trưởng khoa/phụ trách chuyên môn phòng xét nghiệm là chủ sở hữu nghiệp vụ; trong hệ thống, trách nhiệm này được thực thi bởi role `manager`. Manager được sửa draft và publish revision sau bước review xác nhận có lý do; MVP cho phép cùng một manager lập và publish nhưng ghi audit đầy đủ.
- Yêu cầu mỗi chỉ tiêu đang hoạt động được review rõ ràng trước khi publish: có ít nhất một loại mẫu tương thích hoặc được đánh dấu không thể chỉ định kèm lý do.
- **BREAKING**: Mọi đường tạo chỉ định mới, gồm tiếp nhận kèm chỉ định, gán bổ sung và bulk import tương lai, phải kiểm tra cùng một validator ở database và từ chối nguyên tử nếu loại mẫu/chỉ tiêu không tồn tại, không hoạt động, không có cặp allowlist đã publish hoặc cặp đã stale.
- Công bố revision/hash và expected-revision resolver để Issue #112 bắt buộc workbook bulk khóa cùng revision tại preview và confirm; parser/workbook behavior không được triển khai trong change này.
- Giữ nguyên các chỉ định lịch sử; không xóa, sửa lại hoặc đánh dấu sai hồi tố. Sau khi mẫu đã có chỉ định, loại mẫu không được đổi trực tiếp.
- Bổ sung giao diện Quản lý bằng tiếng Việt để xem coverage, xử lý candidate, chỉnh draft, review và publish; Analyst chỉ thấy các chỉ tiêu tương thích trong picker nhưng database vẫn là cổng thực thi cuối.

## Capabilities

### New Capabilities

- `assay-sample-type-compatibility`: Quản lý catalog loại mẫu, revision compatibility, review/publish, provenance, stale detection và resolver fail-closed dùng chung.

### Modified Capabilities

- `assay-management`: Bổ sung trạng thái coverage/review compatibility cho mỗi chỉ tiêu và giao diện quản lý catalog theo quyền Quản lý.
- `sample-management`: Chuẩn hóa loại mẫu, lọc chỉ tiêu theo compatibility và bắt buộc mọi thao tác tạo chỉ định mới qua validator fail-closed.

## Impact

- **Database**: Thêm các bảng catalog loại mẫu, revision, review và allowlist; thêm liên kết loại mẫu chuẩn cho `samples`; bổ sung RPC assignment v2 additive trước khi retire contract cũ và thêm trigger/validator bảo vệ `results` INSERT ở phase enforcement cuối.
- **Application/API**: Mở rộng Zod/TypeScript contracts, API client actions, query hooks và trang `/manager/assays`; accession desktop/mobile phải dùng loại mẫu chuẩn và chỉ hiển thị chỉ tiêu tương thích.
- **Bulk Excel roadmap**: Cung cấp mã loại mẫu, mã chỉ tiêu và revision compatibility cho Issue #112; không triển khai parser, client matching, batch provenance hay transaction bulk trong change này.
- **Compliance/audit**: Mọi thay đổi draft và publish phải ghi audit actor, before/after, revision và lý do; revision đã publish là bất biến, không hard delete và không diễn giải lại chỉ định lịch sử.
- **Security/RLS**: Chỉ `manager` được mutation/publish; `analyst` chỉ đọc catalog đang publish qua RPC tối thiểu cần thiết. Migration phải giữ `SECURITY DEFINER`, `search_path`, revoke/grant và chạy `run_security_tests()`.
- **Localization**: Toàn bộ nhãn, lỗi validation và trạng thái UI mới dùng tiếng Việt theo dictionary dự án.

## Wayfinder Traceability

- Source decision ticket được proposal này giải quyết: GitHub Issue #110.
- Parent roadmap: GitHub Issue #107 và `/root/docs/lims-lite-bulk-excel-import-roadmap.md`.
- Dependency đã hoàn tất: #108; mã chỉ tiêu ổn định từ #109.
- Change này mở đường cho #112 nhưng không mở rộng sang #111, #113, #114 hoặc #115.
