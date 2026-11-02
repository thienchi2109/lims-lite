## Why

LIMS chưa tạo được workbook tiếp nhận theo hợp đồng #112 đã duyệt. Parser và preview cần một template có phiên bản, published snapshot và descriptor được server xác thực trước khi triển khai upload.

## What Changes

- Thêm snapshot server-authoritative cho revision published, mã→UUID/generation và active configured pairs; dùng một snapshot nhất quán, fail closed khi catalog chưa sẵn sàng.
- Sinh/tải template XLSX phiên bản1 đúng tám sheet và literal Text, hướng dẫn tiếng Việt, catalog binding có tính toàn vẹn; không có PII hoặc dữ liệu nghiệp vụ ví dụ trong các sheet nhập.
- Thêm authenticated analyst download endpoint và nút tải/pending/lỗi tiếng Việt; không giữ workbook trên app storage/cache.
- Chỉ generator/download; parser, preview, commit, recovery và UI import là các successor tasks riêng. Không thay published compatibility policy hoặc legacy client lane.

## Capabilities

### New Capabilities

- `accession-template`: Download template phiên bản1 do server tạo với consistent published catalog và authenticated descriptor.

### Modified Capabilities

Không có requirement hiện hành bị đổi; RPC snapshot mới bổ sung capability riêng.

## Impact

- [TASK-8/#136](https://github.com/thienchi2109/lims-lite/issues/136), [phân chia TASK-4/#115](../../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), [hợp đồng #112](../../../docs/superpowers/specs/2026-11-01-excel-template-contract-design.md), Wayfinder [#107](https://github.com/thienchi2109/lims-lite/issues/107).
- Future source: catalog RPC migration, server-only snapshot/descriptor/generator, binary download route, analyst accession download control. Dùng `xlsx` hiện có và Node crypto; không thêm dependency.
- Compliance: analyst role check, RLS/grants/search_path và safe security/audit handling; không mutate clients/samples/assignments, không PII trong metadata/catalog/logs. Migrations forward-only, SQL regression + security tests và home-server rollout có gate riêng.
- TASK-4 chỉ tạo proposal/spec/tasks; mọi implementation checkbox giữ chưa hoàn thành. Source/local evidence không chứng minh deployed download hoặc importer capacity.
