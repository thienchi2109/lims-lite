## Context

TASK-8 / [#136](https://github.com/thienchi2109/lims-lite/issues/136) triển khai phần đầu của [phân chia TASK-4](../../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), theo [contract #112](../../../docs/superpowers/specs/2026-11-01-excel-template-contract-design.md). Source có stable assay codes, compatibility lifecycle generations và published v2 catalog, chưa có import-specific authenticated descriptor/generator. Existing published catalog response không đủ để suy generation; snapshot authority phải được bổ sung.

Stack đã có SheetJS `xlsx`0.20.3, Node crypto, Next route handlers và accession header analyst. TASK-4 chỉ tạo artifacts, không triển khai SQL/API/UI.

## Goals / Non-Goals

**Goals:** generator/download phiên bản1 đúng tám sheet; consistent authority snapshot; verifier tái dùng được bởi successor parser; analyst-only download, Vietnamese UX, no retention.

**Non-Goals:** upload/parser/preview/identity matching/atomic batch confirmation/recovery, migration cleanup legacy, production capacity proof hoặc đổi #112/#113.

## Decisions

### Consistent server-owned snapshot

Thêm RPC read-only chuyên biệt, authenticated analyst-only, trả toàn bộ revision published và entities/pairs active/configured của revision từ một statement snapshot. Include canonical UUID + lifecycle generations từ DB authority; lọc stale generation, retired/soft-deleted/not-assignable, orphan/duplicate entities/pairs. Revision non-null và ít nhất một pair hợp lệ là điều kiện phát hành.

Đọc ba catalog qua nhiều requests có thể ghép hai revisions; vì vậy không tái dựng authority từ client-facing responses. Không đổi RPC legacy hoặc publish policy. Migration mới validate baseline, explicit grants/revokes/search_path/RLS và security impact; quyền app không tự bypass RLS bằng service role.

### Stateless authenticated descriptor

Dùng Node `crypto` HMAC-SHA256 với secret server-only và key id. Descriptor opaque chứa **bounded signed claims**: template id/version/generated_at/revision, `authorityDigest` và `catalogDigest`; không nhúng toàn bộ catalog vào một ô (Excel literal Text tối đa32767 ký tự). `authorityDigest` là SHA256 canonical sorted codes→canonical UUID/generation và configured pairs từ authority snapshot; `catalogDigest` là SHA256 nội dung ba catalog gốc gồm headers/codes/pairs/labels/method text. Canonical JSON array schemas xác định thứ tự, không phụ thuộc object enumeration/ZIP order; catalog order được canonical hóa nhất quán nên row reorder không làm đổi digest nội dung.

Verifier kiểm tra bounds/schema/key id và MAC timing-safe trước tin claims, so metadata claims, tính catalogDigest từ literal catalog workbook và so digest đã ký. Khi preview/confirm successor kiểm tra current authority, lấy consistent server snapshot và tính authorityDigest với cùng schema trên đúng codes/pairs; revision/UUID/generation/eligibility mismatch bị reject. Không cần UUID/generation columns hoặc lưu registry để tái dựng binding. Rename label mà revision/generation không đổi không khiến verifier thay nhãn gốc bằng nhãn hiện tại: original labels vẫn được catalogDigest xác thực, authorityDigest không chứa display labels. Nếu rename có làm revision/generation đổi thì current-authority gate từ chối như mọi drift khác. Mọi sửa label/method trong workbook vẫn fail catalogDigest.

Self-contained signed descriptor cho phép verify sau restart mà không lưu workbook hay template registry. Unsigned checksum không xác thực được client tampering. Không cần encryption vì descriptor/catalog không có PII hoặc input nghiệp vụ; không thêm thư viện token/signing. Không coi sheet protection là bảo mật.

Không có template TTL dựa generated_at; authority supported-version/current revision tại preview/confirm thuộc successor. Missing key/config hoặc unknown/retired key fail closed với hướng dẫn tải lại. Key retention/rotation giữ verification policy rõ ràng cho các template còn hỗ trợ; secrets ở runtime config, không commit. Rotation smoke thuộc rollout gate, không tạo subsystem quản lý keys mới trong scope này.

### Fixed workbook và binary download

Dùng `xlsx` hiện có, không thêm Excel library. Generator tạo đúng layout/headers/metadata #112 §§2–5. Tất cả sheets visible, business columns `@`, header optional vẫn tồn tại, business sheets trống; hướng dẫn/ví dụ synthetic nằm riêng Hướng dẫn. Toàn bộ metadata values literal string: id `lims-bulk-accession`, version `1`, revision positive ASCII no leading zero và server UTC timestamp milliseconds.

Sheet Hướng dẫn nêu literal Text/paste values, ISO năm1900–2100, giữ leading zeros, conditional phone/gender khi create, dữ liệu mới đã lấy/đạt, file <10.000.000 bytes và không count caps. Catalog chỉ gồm eligible sample types/assays và pairs; phương pháp là nhãn published hiện tại.

Authenticated binary route trả MIME XLSX, attachment filename do server chọn, `Cache-Control: private, no-store`; không lưu file vào disk/Storage/CDN/cache. Server authorization trước snapshot, server-only signing/generation. GET không mutate business data; kiểm thử security/audit convention sẵn có, không audit workbook/payload/secret hoặc tạo fake accession event. Không gửi buffer base64 qua JSON mutation bridge.

Nút “Tải template Excel” đề xuất ở `AccessionPageHeader` trên `/analyst/accession`, cạnh title và giữ WalkthroughTrigger; mobile wrap. Có label/focus/pending/error tiếng Việt, không thêm importer giả hoặc duplicate nút trên `/samples`. Nếu phát sinh client mutation invocation, dùng api-client theo convention; download response binary dùng route trực tiếp.

## Risks / Trade-offs

- [Catalog publish khi download] → snapshot tự nhất quán; workbook có thể stale ngay sau phát hành. Preview/confirm successor recheck revision/generation, không âm thầm nâng revision.
- [Writer thay type hoặc catalog quá lớn] → descriptor kích thước bounded độc lập cardinality, round-trip tests exact metadata/catalog/types; kiểm tra workbook phát hành nằm trong strict file limit, fail closed thay vì cắt catalog. Đây là file-byte guard, không count cap.
- [Secret leak / cached workbook] → server-only modules/config, bounded safe errors, no-store, no disk/temp/log retention; runtime inspection riêng.
- [Migrations/role checks chỉ được test bằng source] → SQL regression + run_security_tests() và deployed download smoke là gate riêng chưa đạt. Không suy runtime từ OpenSpec checkbox.

## Migration Plan

1. Phase1 source: inspect authority baseline, thêm forward-only snapshot RPC migration và focused SQL contract/regression fixtures; không chạm applied SQL.
2. Phase2 source: generator/descriptor/verifier + round-trip/tampering tests với dependencies hiện hữu.
3. Phase3 source: binary route/header button + auth/pending/error/accessibility tests, lint/typecheck/OpenSpec strict.
4. Phase4 runtime riêng sau authorization: home-server SSH `/opt/lims-lite`, apply committed migration via `sudo -n docker exec ... lims-postgres psql`; SQL regression + run_security_tests() sau migration; configure server secret, deploy app, download qua app thật và verify workbook/revision/types/no-retention. Lưu PII-free timestamp/revision/command/outcome.
5. Rollback app về revision tương thích giữ additive RPC; không rollback bằng sửa/xóa applied migration. Nếu SQL cần fix, migration mới forward-only. Disable broken download surface/fail closed khi config không hợp lệ; không phát template không xác thực.

## Open Questions

Không có unresolved product blocker cho TASK-8. Tên RPC, next migration number và key environment name lấy từ current source tại phase1 (không reserve migration version trong proposal). UI placement là proposal có thể nhận steering trước implementation. Actual deployed capacity và importer runtime acceptance thuộc TASK-7 sau successor tasks; không cần chạy gate đó để hoàn tất TASK-4.
