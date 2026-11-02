# Hợp đồng template Excel tiếp nhận mẫu — phiên bản 1

Trạng thái: **Đã được người dùng duyệt ngày 2026-11-01** qua xác nhận “duyệt contract”, sau review độc lập và verification của root đối với bản tại commit `3c820dc`.
Ngày khảo sát nguồn: 2026-11-01. Phạm vi: định dạng workbook và validation; chưa triển khai parser, workbook hay UI.
Các quy tắc ở phần 2–9 là hợp đồng đã được duyệt của #112; phần 1 ghi các invariant được tái sử dụng từ quyết định trước.
Issue: [#112](https://github.com/thienchi2109/lims-lite/issues/112); roadmap: [#107](https://github.com/thienchi2109/lims-lite/issues/107).

## 1. Nền tảng đã chốt và nguồn kiểm chứng

| Nguồn | Invariant được tái sử dụng |
| --- | --- |
| [#108 — Resolution](https://github.com/thienchi2109/lims-lite/issues/108#issuecomment-5349844886) | Template `.xlsx` nội bộ, ba sheet nghiệp vụ và hướng dẫn/danh mục/metadata; chỉ mẫu đã lấy, chất lượng đạt; chỉ tạo mẫu và chỉ định mới. |
| [#108](https://github.com/thienchi2109/lims-lite/issues/108) | Analyst preview rồi xác nhận toàn batch nguyên tử; bất kỳ lỗi nào cũng chặn batch; không giữ workbook/full normalized payload. Preview do server sở hữu, bất biến, gắn analyst và hết hạn sau 30 phút. |
| [#108](https://github.com/thienchi2109/lims-lite/issues/108) | `received_at` chung là giờ server tại confirmation, lưu UTC/hiển thị theo múi giờ phòng xét nghiệm; không nhập giờ nhận riêng từng dòng. Trùng mẫu–chỉ tiêu, formula, macro, external link, sheet bắt buộc đổi tên và cột lạ đều bị từ chối. |
| [#109](https://github.com/thienchi2109/lims-lite/issues/109), [assay spec](../../../openspec/specs/assay-management/spec.md) | `CT-NNNNNN` là mã chỉ tiêu ổn định, không tái sử dụng; mã nhận diện assay definition cùng phương pháp đã cấu hình. Tên và UUID không phải định danh import. |
| [#110](https://github.com/thienchi2109/lims-lite/issues/110), [compatibility spec](../../../openspec/specs/assay-sample-type-compatibility/spec.md) | `LM-NNNNNN` ánh xạ UUID canonical; chỉ dùng published revision, active entities, review `configured`, pair hợp lệ và generation chưa stale. Expected revision khác hiện hành phải fail closed. |
| [#111 — Resolution](https://github.com/thienchi2109/lims-lite/issues/111#issuecomment-5376972439), [canonical matching spec](../../../openspec/changes/archive/2026-08-29-add-deterministic-client-matching/specs/client-management/spec.md) | Shared server resolver; CCCD/CMND có type; tên giữ dấu + DOB; phone là conflict guard; không auto-update/merge/restore. Chỉ `not_found` được tạo mới khi confirm. |
| [Canonical integrity spec](../../../openspec/changes/enforce-client-canonical-integrity/specs/client-management/spec.md), [resolver strong-key guards](../../../supabase/migrations/221_add_deterministic_client_resolver_v2.sql) | Name+DOB không unique/không chứng minh cùng người. Resolver giữ conflict guard với candidate khác, nhưng tôn trọng adjudication `confirmed_distinct`; workbook không được thêm identity uniqueness. |
| [Client schemas](../../../src/types/client-resolution.ts), [Gender](../../../src/types/core.ts), [messages](../../../src/lib/client-resolution/messages.ts) | Name ≤200, DOB bắt buộc; identity type/value đi cặp; tạo mới yêu cầu gender và phone hợp lệ; địa chỉ ≤500, BHYT ≤80. Dùng outcome/reason và thông báo tiếng Việt hiện có. |
| [Catalog schemas](../../../src/types/assay-sample-type-compatibility.ts), [catalog action](../../../src/app/actions/assay-sample-type-compatibility.ts), [sample schemas](../../../src/types/sample.ts) | Catalog trả `revisionNumber` có thể null, sample-type UUID/mã và assay/method; accession dùng canonical `sampleTypeId`, `sampleTypeCode`, `expectedRevisionNumber`. Null revision không đủ điều kiện import. |

Các số lượng catalog trong comment cũ là snapshot lịch sử, không phải danh mục hoặc giới hạn hiện tại. Không đọc/vận hành production trong khảo sát này.
Thuật ngữ giữ nguyên [CONTEXT.md](../../../CONTEXT.md): khách hàng xét nghiệm → mẫu xét nghiệm → chỉ định xét nghiệm; mã tạm chỉ có hiệu lực trong workbook.

## 2. Lựa chọn định dạng và phiên bản

Chọn hợp đồng hẹp: một layout cố định, mọi ô nhập là Text, ngày là chuỗi ISO `YYYY-MM-DD`, mã nghiệp vụ thay cho tên/UUID.
So với hỗ trợ cả native Excel date/serial, lựa chọn này tránh diễn giải phụ thuộc locale và hệ ngày 1900/1904; đổi lại người dùng phải giữ cột ngày ở Text.
Không chọn spreadsheet tự do/mapping cột: trái ranh giới template nội bộ đã chốt ở #108.

- `template_id = lims-bulk-accession`, `template_version` có giá trị Text `1` (ngữ nghĩa số nguyên dương, biểu diễn chính xác ở metadata; không đoán phiên bản từ tên file).
- Phiên bản 1 chỉ hỗ trợ đúng cấu trúc dưới đây. Thiếu/không hỗ trợ version: chặn trước đọc dữ liệu nghiệp vụ và hướng dẫn tải template hiện hành.
- Bất kỳ thay đổi header, requiredness, kiểu dữ liệu, null semantics hoặc quy tắc parse đều cần version mới; không đổi âm thầm ý nghĩa của version 1.
- Sửa chính tả hướng dẫn/định dạng hiển thị mà không đổi hợp đồng không tăng version. Compatibility revision và template version là hai trục riêng.
- Khi có version mới, server phải công bố tập version còn hỗ trợ; không mặc định chấp nhận version cũ hoặc tự nâng cấp workbook. Version bị ngừng hỗ trợ giữa preview–confirm làm preview mất hiệu lực.
- Tên file có thể đổi và không quyết định contract. Không dùng thời gian tạo template làm TTL: template hết hiệu lực khi version/catalog không còn hợp lệ, còn TTL preview vẫn là 30 phút theo #108.

## 3. Các sheet và hàng/cột cố định

Workbook có đúng tám sheet sau; tên có dấu, khoảng trắng và chữ hoa đúng như bảng. Thứ tự sheet không ảnh hưởng tham chiếu.
Sheet nghiệp vụ có header ở dòng 1, dữ liệu từ dòng 2; cột đúng thứ tự quy định, không thêm cột ghi chú/STT. Không có dòng tiêu đề phụ.
Các sheet đều hiển thị; metadata/catalog không chứa PII. Cột optional vẫn phải có header; chỉ giá trị từng ô được để trống.

| Sheet | Nội dung/cột theo đúng thứ tự | Người dùng sửa |
| --- | --- | --- |
| `Hướng dẫn` | Văn bản hướng dẫn tiếng Việt do LIMS tạo, ví dụ mẫu; không phải dữ liệu import | Không |
| `Thông tin template` | A=`Thuộc tính`, B=`Giá trị`; các key ở phần dưới | Không |
| `Khách hàng` | A–J theo bảng 3.1 | Giá trị từ dòng 2 |
| `Mẫu` | A–C theo bảng 3.2 | Giá trị từ dòng 2 |
| `Chỉ định` | A–B theo bảng 3.3 | Giá trị từ dòng 2 |
| `Danh mục loại mẫu` | A=`Mã loại mẫu`, B=`Tên loại mẫu` | Không |
| `Danh mục chỉ tiêu` | A=`Mã chỉ tiêu`, B=`Tên chỉ tiêu`, C=`Phương pháp` | Không |
| `Danh mục tương thích` | A=`Mã loại mẫu`, B=`Mã chỉ tiêu` | Không |

`Thông tin template` có các key đúng một lần: `template_id`, `template_version`, `generated_at`, `compatibility_revision`, `catalog_binding`.
Mọi ô B metadata là literal Text: `template_version` là `1`; `compatibility_revision` khớp `^[1-9][0-9]*$` (số nguyên dương ASCII, không số 0 đầu/dấu/số mũ); `generated_at` là timestamp UTC hợp lệ dạng `YYYY-MM-DDTHH:mm:ss.sssZ` do server phát hành. Không nhận ô numeric/date ở metadata, không có key lạ.
`catalog_binding` là descriptor opaque do server phát hành và xác minh tính toàn vẹn, ràng buộc template id/version, thời điểm tạo, revision và snapshot catalog (code→UUID canonical và generation).
Descriptor cũng bảo vệ nội dung ba bảng catalog; không dùng checksum người dùng tự tính làm bằng chứng xác thực. Cơ chế mã hóa/ký cụ thể thuộc triển khai sau, không cần lưu workbook để xác minh.
Đây là contract mới #112: published catalog RPC/schema hiện chưa trả generation hoặc descriptor. Generator tương lai phải lấy generation/code→UUID từ authority canonical phía server trong cùng snapshot nhất quán, không suy generation từ response hiện có hay từ workbook.
Sheet protection chỉ giúp tránh sửa nhầm, không phải trust boundary. Không tin bất kỳ UUID/revision/generation do workbook tự khai mà chưa được server xác minh.

Catalog được tạo từ một published snapshot nhất quán; không sinh template nếu không có revision hoặc không có pair đang dùng được.
Danh mục tương thích chỉ gồm pair active, configured, generation hợp lệ của revision đó; danh mục chỉ tiêu gồm hợp các assay trong các pair này.
Danh mục loại mẫu chỉ gồm loại mẫu có ít nhất một pair dùng được. Tên/phương pháp là nhãn để đọc, không cho phép dùng thay mã hoặc nhập phương pháp riêng.
Catalog không chứa draft, retired/soft-deleted/not-assignable/stale entries. Mã unique trong hai bảng entity; cặp unique trong bảng tương thích; không có dòng catalog mồ côi.
Trong các sheet chỉ đọc, hàng/header/catalog binding phải nguyên vẹn; format hiển thị có thể thay đổi. `Hướng dẫn` không được đọc thành dữ liệu.

### 3.1. Sheet `Khách hàng`

Mỗi dòng là một khách hàng, có thể được nhiều mẫu tham chiếu. Chuỗi dưới đây tính giới hạn sau trim/NFC; server vẫn áp dụng schema canonical hiện hành.

| Cột | Header | Kiểu/giới hạn | Bắt buộc và ánh xạ |
| --- | --- | --- | --- |
| A | `Mã khách hàng tạm` | Text, quy tắc mã tạm ở phần 4 | Luôn bắt buộc; chỉ liên kết workbook |
| B | `Họ và tên` | Text, 1–200 ký tự, giữ dấu | Luôn bắt buộc → `name` |
| C | `Ngày sinh` | Text ngày ISO ở phần 5 | Luôn bắt buộc → `dateOfBirth` |
| D | `Loại giấy tờ` | Text enum `CCCD` hoặc `CMND` | Đi cặp với E; trống cả hai được phép → `cccd`/`cmnd` |
| E | `Số giấy tờ` | Text, CCCD đúng 12 số/CMND đúng 9 số ASCII | Đi cặp với D → `governmentIdentityValue`; giữ số 0 đầu |
| F | `Giới tính` | Text enum chính xác `Nam`, `Nữ`, `Khác` | Bắt buộc nếu tạo mới → `gender`; optional nếu đã khớp |
| G | `Số điện thoại` | Text, ≤30 ký tự; dùng validation/normalization phone Việt Nam canonical | Bắt buộc và hợp lệ nếu tạo mới → `phone`; optional nếu đã khớp |
| H | `Địa chỉ` | Text ≤500 | Optional → `address` |
| I | `Số BHYT` | Text ≤80; giữ số 0 đầu | Optional → `healthInsuranceNum` |
| J | `Ngày hết hạn BHYT` | Text ngày ISO | Optional → `expiryDate` |

Nếu F–J được cung cấp thì phải hợp lệ kể cả khi cuối cùng reuse client. Phone `0000000000` là missing/untrusted theo #111, không đáp ứng yêu cầu phone khi tạo mới.
Không yêu cầu nhập UUID client hoặc mã khách hàng chính thức. Không suy loại giấy tờ từ độ dài khi D bỏ trống.
Không đưa placeholders/`BACKFILL-*` thành strong identity; nếu người dùng đã nhập D/E nhưng sai định dạng thì báo lỗi, không âm thầm chuyển thành missing.

### 3.2. Sheet `Mẫu`

| Cột | Header | Kiểu/giới hạn | Bắt buộc và ánh xạ |
| --- | --- | --- | --- |
| A | `Mã mẫu tạm` | Text, quy tắc mã tạm ở phần 4 | Luôn bắt buộc; chỉ liên kết workbook |
| B | `Mã khách hàng tạm` | Text, tham chiếu đúng A của `Khách hàng` | Luôn bắt buộc; đúng một khách hàng cho một mẫu |
| C | `Mã loại mẫu` | Text, regex `^LM-[0-9]{6}$` | Luôn bắt buộc; resolve server-side ra `sampleTypeId`/`sampleTypeCode` |

Không có cột giờ lấy/nhận mẫu, người nhận, chất lượng, trạng thái hoặc mã mẫu chính thức. Analyst xác nhận tất cả mẫu đã lấy và chất lượng đạt trong preview.
Server đặt chất lượng đạt, actor và `received_at` theo #108; mã mẫu chính thức được cấp khi commit. Không dùng mã tạm làm barcode chính thức.

### 3.3. Sheet `Chỉ định`

| Cột | Header | Kiểu/giới hạn | Bắt buộc và ánh xạ |
| --- | --- | --- | --- |
| A | `Mã mẫu tạm` | Text, tham chiếu đúng A của `Mẫu` | Luôn bắt buộc |
| B | `Mã chỉ tiêu` | Text, regex `^CT-[0-9]{6}$` | Luôn bắt buộc; resolve assay definition/phương pháp từ server |

Mỗi dòng là một chỉ định. Không có cột kết quả, đơn vị, phương pháp lựa chọn, client hoặc UUID.
Không chọn chỉ tiêu theo tên, không chọn method mặc định phía client; mã `CT-*` và catalog server quyết định đúng assay/method đã cấu hình.

## 4. Tham chiếu và tính đầy đủ của batch

- Mã tạm dùng Text 1–40 ký tự sau trim, regex `^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$`; phân biệt hoa thường; `KH-01` khác `kh-01`. Dùng `KH-001`/`M-001` trong ví dụ, không bắt buộc prefix.
- Hai namespace client/sample tách biệt; cùng chuỗi ở hai namespace không tạo quan hệ. Không tham chiếu workbook trước, số dòng, UUID hoặc mã chính thức.
- Mỗi mã tạm unique trong sheet định nghĩa. Mã trùng làm lỗi tất cả dòng liên quan, không chọn first/last. Tham chiếu thiếu/sai case/trống làm lỗi ngay ô tham chiếu.
- Thứ tự dòng không ảnh hưởng: cho phép forward reference, sort, chèn dòng trống. Dòng hoàn toàn trống sau trim bỏ qua nhưng giữ tọa độ Excel thật; dòng có ít nhất một giá trị phải validate đầy đủ.
- Batch cần ít nhất một khách hàng, một mẫu và một chỉ định. Mỗi client phải có ≥1 mẫu, mỗi mẫu có ≥1 chỉ định; dòng mồ côi bị lỗi, không tạo client dư hoặc mẫu chưa chỉ định.
- Cặp (`Mã mẫu tạm`, `Mã chỉ tiêu`) trùng bị lỗi ở mọi dòng trùng dù các ô còn lại giống nhau; không tự deduplicate. Cùng assay trên hai mẫu khác nhau được phép.
- Hai mã client tạm resolve cùng active UUID và không có identity disagreement thì báo `CLIENT_DUPLICATE`, yêu cầu gom các mẫu về một dòng client; không merge hai hồ sơ. Cùng normalized trusted typed identity phải qua canonical guards: kết quả cùng người hợp lệ là duplicate, bất đồng tín hiệu là conflict, không tự gộp.
- Canonical name+DOB giống nhau chỉ là candidate/conflict signal theo shared resolver, không chứng minh cùng người và không tự gây `CLIENT_DUPLICATE`. Hai strong identities khác nhau được resolver cho phép là hai client distinct vẫn hợp lệ dù name+DOB giống nhau; không đặt unique key name+DOB cho workbook.
- So sánh client dự kiến tạo trong batch bằng normalization/guard canonical trước cho phép tạo, tránh hai dòng `not_found` cùng tạo một trusted identity. Collision name+DOB/phone phải được canonical resolution xử lý, không chọn first/last hoặc ép merge; nếu chưa resolve an toàn thì chặn bằng conflict của #111.
- Mã mẫu tạm khác nhau là hai mẫu mới khác nhau, kể cả cùng client/loại mẫu/assay; không suy trùng mẫu vật lý từ nội dung giống nhau. Chống import lại batch thuộc #108/#113.

## 5. Kiểu ô, ngày, mã và giá trị trống

- Generator đặt toàn bộ cột nghiệp vụ là Text (`@`), có hướng dẫn nhập/paste values và ví dụ ISO. Không đặt sẵn dữ liệu ví dụ thành dòng có thể import.
- Chỉ nhận ô string literal (shared/inline string) hoặc ô thiếu/trống. Rich text có thể đọc thành plain text; không đọc formatting, cached formula hay formatted display text thay giá trị gốc.
- Từ chối ô number, boolean, error và native date kể cả khi hiển thị như chuỗi đúng. Numeric `123456789` không được tự pad thành CMND; số điện thoại mất 0 phải người dùng sửa nguồn.
- Ngày sinh/ngày BHYT chỉ nhận `YYYY-MM-DD` với năm 1900–2100 và ngày lịch có thật, theo [validator canonical hiện tại](../../../src/lib/iso-date.ts); `2000-02-29` hợp lệ, `2025-02-29` không hợp lệ. Map date-only sang canonical ISO, không dịch timezone; không nới giới hạn của resolver.
- Không nhận `DD/MM/YYYY`, serial Excel, hệ ngày 1900/1904, scientific notation, timestamp hay chuỗi bị engine tự đoán ngày. Không dùng `Date.parse` để quyết định format nhập.
- Trim whitespace ngoài và chuẩn hóa Unicode NFC cho Text; giữ dấu tiếng Việt. Tên được so sánh bằng normalization server canonical (collapse whitespace/case-fold, giữ dấu), không tự viết bộ match khác.
- Ô vắng, chuỗi rỗng và chỉ whitespace cùng nghĩa missing. Required → lỗi; optional → `null` ở input normalized. Schema không nhận null thì adapter phải dùng optional đúng hợp đồng, không gửi chuỗi placeholder.
- `NULL`, `N/A`, `-`, `0` là literal, không tự thành null. Chúng vẫn phải qua validator của cột; `0000000000` chỉ là ngoại lệ phone untrusted được #111 định nghĩa.
- Apostrophe Excel để ép Text không phải một phần dữ liệu nếu chỉ là quote prefix; apostrophe thực sự trong giá trị không được tự cắt. Không chuyển hoa/thường hoặc bỏ số 0 ở mã giấy tờ/BHYT.

## 6. Đối sánh và tạo khách hàng

Preview gọi shared resolver #111 với name, DOB, typed identity/phone nếu có và caller context của dòng client; không gọi legacy upsert hay tạo client để thử.

| Outcome canonical | Hành vi workbook/preview |
| --- | --- |
| `matched` | Reuse đúng active UUID server trả. Name/DOB và mọi tín hiệu identity đã được resolver kiểm tra; phone thiếu được phép. F–J không cập nhật hồ sơ hiện có, preview nói rõ dùng dữ liệu đã lưu. |
| `not_found` | Hiển thị “Sẽ tạo khách hàng mới khi xác nhận”; validate đủ F/G và các trường tạo mới theo `ResolveOrCreateClientInputSchema`. Không tạo ở preview. |
| `ambiguous` | Chặn toàn batch; “Không thể xác định duy nhất”, yêu cầu quản lý xử lý trước; không chọn candidate đầu. |
| `conflict` | Chặn toàn batch; dùng reason tiếng Việt canonical: inactive, phone, cross-key, accent-only, identity disagreement… Không cho analyst override/restore/merge. |

CCCD 12 số/CMND 9 số là strong keys khác nhau. Có strong key thì không fallback name+DOB khi key không tìm thấy/xung đột; thiếu strong key mới dùng name+DOB giữ dấu.
Phone normalize `+84`/`0` bởi shared resolver, chỉ là conflict guard. Không dùng phone làm primary key hoặc tự overwrite khi phone khác.
Không tự fill-null/overwrite address/BHYT/gender của client đã khớp. Preview cần phân biệt thông tin file với thông tin lưu được reuse, tránh hứa rằng optional fields sẽ được cập nhật.
Đối sánh lại tại confirmation theo invariant #108/#111; nếu dữ liệu client thay đổi khiến kết quả preview không còn đúng thì từ chối và yêu cầu preview lại, không tự chuyển reuse↔create.

## 7. Workbook được phép và bị cấm

| Được phép | Bị từ chối |
| --- | --- |
| `.xlsx` OOXML thường, workbook mở được không mật khẩu | `.xls`, `.xlsm`, `.xlsb`, CSV, giả extension, hỏng ZIP/XML, encrypted/password-protected |
| Font/màu/độ rộng, freeze header, wrap text, sort/filter | Thiếu/thừa/đổi tên sheet, header thiếu/lặp/lạ/sai thứ tự; thêm cột kể cả ngoài vùng nhìn thấy |
| Data validation/dropdown LIMS sinh từ static ranges trong catalog của chính workbook | Formula trong bất kỳ ô nào, kể cả trả chuỗi rỗng/cached value; VBA/XLM macro, DDE, external links/hyperlinks, external data/query connections |
| Defined names chỉ cho static ranges của dropdown do template định nghĩa | Defined names tùy ý/tính toán, embedded/OLE objects, scripts; merge cell trong metadata/catalog/vùng dữ liệu |
| Lọc/sắp xếp dữ liệu, dòng trống; parser vẫn đọc cả dòng bị filter/ẩn | Sheet ẩn/veryHidden, dữ liệu ngoài các cột nghiệp vụ, metadata/catalog bị chỉnh sửa hoặc descriptor không hợp lệ |

Data-validation rule là metadata tạo dropdown, không phải formula cell. Rule chỉ được trỏ tới range nội bộ đã định nghĩa; không tính toán hay truy cập tài nguyên ngoài.
Dropdown chỉ hỗ trợ nhập; paste có thể bỏ qua dropdown nên server vẫn validate mọi ô và mọi pair. Không thực thi macro, formula, external links hoặc đánh giá formula engine.
Quyết định người dùng 2026-11-02 bổ sung #112: file phải **<10.000.000 bytes** (10 MB decimal), không có count caps khách hàng/mẫu/chỉ định; các số lượng thử nghiệm cũ chỉ là fixture lịch sử. Size pass không thay workbook validation hoặc bảo đảm mọi file dưới ngưỡng xử lý được.
Giữ phòng vệ tài nguyên giải nén/ZIP entries/ô/thời gian/bộ nhớ; file vượt guard phải fail closed, không cắt bớt dòng hoặc trả preview một phần. #114/TASK-3 chỉ chứng minh prototype local; safe actual inflate và runtime/DB/HTTP được nghiệm thu sau triển khai ở [TASK-7](../../../backlog/tasks/task-7%20-%20Nghiem-thu-capacity-va-atomicity-import-thuc.md), theo [bằng chứng hiện hành](2026-11-02-import-file-limit-evidence.md).

## 8. Catalog drift: tạo template → preview → confirm

Ba sheet catalog chỉ là snapshot hỗ trợ người nhập; authority là published catalog/resolver phía server, không phải dropdown hay metadata gửi lên.

| Điểm kiểm tra | Điều kiện bắt buộc/hành vi khi không đạt |
| --- | --- |
| Tạo template | Version hỗ trợ + revision published khác null + snapshot nhất quán; bind mã→UUID/generation phía server và phát hành descriptor. Nếu catalog chưa sẵn sàng, không sinh template nhập được. |
| Upload/preview | Xác minh descriptor, version và catalog sheets nguyên vẹn. Revision embedded phải bằng published revision hiện hành. Sai → `CATALOG_STALE`/`TEMPLATE_METADATA_INVALID`, yêu cầu tải template mới; không tự đổi revision. |
| Resolve từng dòng | Mã phải đúng định dạng, có trong snapshot đã xác minh và resolve cùng canonical UUID hiện tại. Entity active, pair configured/published và cả generation còn khớp. Mã đã nghỉ/ngưng dùng, not-assignable hoặc pair/generation stale → lỗi theo dòng. |
| Tạo preview | Lưu server-owned binding version/revision/generation và kết quả normalized/resolved, bất biến, gắn analyst, hết hạn 30 phút theo #108. Không tin lại file/catalog client tại confirmation. |
| Confirm | Trong atomic boundary kiểm tra lại version, revision, referenced entities/generations/pairs và client resolutions trước mọi business write. Mọi drift → từ chối toàn batch, preview không còn dùng được; tạo preview mới sau sửa/tải template mới. |

Nếu revision mới được publish, chặn dù pair đang dùng vẫn còn giống nhau; người dùng không tự chấp nhận catalog mới qua một checkbox override.
Nếu method/type bị thay đổi làm generation stale nhưng revision chưa đổi, vẫn chặn; revision bằng nhau không đủ chứng minh compatibility.
Tên nhãn đơn thuần không phải import key; preview luôn hiển thị tên hiện tại từ server. Thay đổi nào làm generation/pair stale vẫn phải qua cơ chế #110; không đoán tương thích từ tên giống nhau.
Không truyền UUID do người dùng nhập; server dùng mã đã resolve và `expectedRevisionNumber` bắt buộc. Không gọi RPC legacy để né lỗi v2.
Chi tiết transaction, idempotency, hashing/provenance và lưu attempt thuộc #113; quy tắc invalidation ở đây là yêu cầu consumer, không thiết kế lại #113.

## 9. Lỗi tiếng Việt và ví dụ

Mỗi lỗi có `code` ổn định, `message` tiếng Việt, `sheet`, `row` (1-based Excel), `column` (chữ cột), `header`, `temporaryReference` nếu có.
Lỗi toàn workbook có `sheet/row/column/header = null`, không bịa dòng 0; lỗi thiếu sheet có tên sheet kỳ vọng, các tọa độ còn lại null. Header sai dùng dòng 1.
Lỗi duplicate có `relatedLocations` cho tất cả dòng liên quan. Kết quả lỗi sắp theo thứ tự sheet hợp đồng, dòng, cột và code để người dùng sửa lặp lại được.
UI error response được có `callerContext` gồm sheet/row/column và `temporaryReference` của dòng để người upload tìm đúng ô; không kèm raw identity/profile cell values, full rows, raw DB exception hoặc danh sách hồ sơ candidate.
Log/audit lỗi chỉ lưu code/tọa độ và context vận hành cần thiết; redact raw cell values/PII/full rows và `temporaryReference` do người dùng nhập. Không ghi nguyên UI error response vào log. Provenance/row-to-entity mappings đã chốt ở #108 là dữ liệu riêng theo #113, không phải payload log lỗi.
Mọi lỗi đều chặn confirmation; không import một phần, không bỏ lỗi thành warning. Thông báo reuse optional fields là thông tin, không phải lỗi.

| Mã lỗi | Vị trí ví dụ | Thông báo mẫu |
| --- | --- | --- |
| `TEMPLATE_VERSION_UNSUPPORTED` | `Thông tin template`, ô chứa version | “Phiên bản template không được hỗ trợ. Vui lòng tải template hiện hành.” |
| `TEMPLATE_METADATA_INVALID` | `Thông tin template`, ô descriptor | “Thông tin template hoặc danh mục đã bị thay đổi. Vui lòng tải lại template.” |
| `WORKBOOK_FEATURE_UNSUPPORTED` | `Khách hàng`, C2 khi formula | “Không được dùng công thức. Hãy nhập ngày dạng văn bản YYYY-MM-DD.” |
| `CELL_TYPE_INVALID` | `Khách hàng`, E2 | “Số giấy tờ phải là văn bản để giữ số 0 đầu. Hãy sửa dữ liệu gốc rồi nhập lại.” |
| `DATE_INVALID` | `Khách hàng`, C2 | “Ngày sinh phải là ngày có thật, dạng YYYY-MM-DD; ví dụ 2000-02-29.” |
| `REQUIRED_VALUE_MISSING` | `Khách hàng`, G2 | “Cần số điện thoại hợp lệ để tạo khách hàng mới.” |
| `TEMP_REFERENCE_DUPLICATE` | `Mẫu`, A2 + A5 | “Mã mẫu tạm bị trùng ở các dòng 2, 5. Hãy dùng mã riêng cho từng mẫu.” |
| `TEMP_REFERENCE_NOT_FOUND` | `Chỉ định`, A3 | “Không tìm thấy mã mẫu tạm trong trang tính Mẫu. Hãy kiểm tra lại mã tham chiếu.” |
| `ASSIGNMENT_DUPLICATE` | `Chỉ định`, B2 + B4 | “Một mẫu chỉ được chỉ định cùng mã chỉ tiêu một lần. Hãy xóa dòng trùng.” |
| `CLIENT_DUPLICATE` / `ORPHAN_ROW` | Dòng client/mẫu tương ứng | “Khách hàng được khai báo nhiều lần; hãy gom mẫu về một mã khách hàng tạm.” / “Dòng này chưa có mẫu hoặc chỉ định liên kết.” |
| `CLIENT_AMBIGUOUS` / `CLIENT_CONFLICT` | `Khách hàng`, D/E hoặc B/C/G theo reason | Tái sử dụng label/reason tiếng Việt của #111 và vị trí/mã tạm, yêu cầu quản lý xử lý. |
| `CATALOG_CODE_INVALID` / `COMPATIBILITY_INVALID` | `Mẫu`, C2 / `Chỉ định`, B2 | “Mã không có trong danh mục hợp lệ.” / “Chỉ tiêu không còn được phép cho loại mẫu này. Vui lòng kiểm tra danh mục.” |
| `CATALOG_STALE` / `PREVIEW_STALE` | Metadata revision / toàn workbook | “Danh mục đã thay đổi. Hãy tải template mới và xem trước lại.” / “Bản xem trước không còn hợp lệ. Vui lòng xem trước lại trước khi xác nhận.” |

Lỗi phụ thuộc không được bịa: nếu loại mẫu/mã tham chiếu chưa resolve thì báo lỗi gốc, chưa kết luận pair là không tương thích.

### Ví dụ tổng hợp (dữ liệu giả, chỉ có giá trị nếu mã nằm trong catalog phát hành)

Giả sử `LM-000001` và `CT-000001` tạo pair hợp lệ của revision hiện hành, descriptor đúng và resolver không tìm thấy/xung đột identity dưới đây.
Mọi giá trị là Text; ký hiệu `∅` dưới đây mô tả ô trống, không phải nội dung được nhập vào file.

| Khách hàng: A | B | C | D | E | F | G | H | I | J |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KH-001 | Khách kiểm thử A | 2000-02-29 | ∅ | ∅ | Nam | 0900000001 | ∅ | ∅ | ∅ |

| Mẫu: A | B | C |
| --- | --- | --- |
| M-001 | KH-001 | LM-000001 |
| M-002 | KH-001 | LM-000001 |

| Chỉ định: A | B |
| --- | --- |
| M-001 | CT-000001 |
| M-002 | CT-000001 |

Hợp lệ: một client mới, hai mẫu mới, hai chỉ định; client chỉ tạo khi confirm. Nếu đã matched đúng một active client, F/G có thể trống và hồ sơ được reuse.

| Thay đổi từ ví dụ | Kết quả bắt buộc |
| --- | --- |
| Đổi C2 khách hàng thành native Excel date hoặc `29/02/2000` | Lỗi kiểu/ngày ở C2; không đoán lại |
| Nhập `CCCD` ở D2 và để E2 trống; hoặc E2 là numeric | Lỗi identity đi cặp/kiểu ô; không fallback bỏ giấy tờ |
| Chỉ định dùng `m-001` thay cho `M-001` | Lỗi tham chiếu thiếu ở A của Chỉ định |
| Thêm dòng `M-001`, `CT-000001` lần nữa | Lỗi duplicate cho cả hai vị trí chỉ định |
| Client `not_found` nhưng thiếu G2 | Lỗi phone tạo mới; không tạo bằng placeholder |
| Resolver trả inactive/phone conflict, hoặc hai client tạm resolve cùng UUID | Chặn batch theo #111 / `CLIENT_DUPLICATE`; không revive/merge |
| Hai client tạm cùng normalized name+DOB nhưng có trusted CCCD/CMND khác nhau, shared resolver trả hai active UUID distinct hợp lệ (có adjudication `confirmed_distinct` khi canonical guard yêu cầu) | Cả hai client và mẫu tương ứng hợp lệ; không `CLIENT_DUPLICATE`, không gom/merge chỉ vì trùng name+DOB. Nếu guard còn trả conflict thì giữ conflict đó, không override. |
| Thêm cột `Giờ nhận mẫu`, đổi sheet `Mẫu` thành `Mau`, sửa catalog | Lỗi cấu trúc/metadata trước business validation |
| Publish revision mới sau tải template hoặc sau preview; đổi method làm generation stale | Preview/confirm bị từ chối tương ứng; không ghi business rows |

## 10. Quyết định #112

Đã phân định: layout/cột/version, refs, ISO/Text/null, duplicates/missing refs, workbook restrictions, lỗi định vị tiếng Việt, matching reuse/create và catalog drift.
Người dùng đã duyệt toàn bộ hợp đồng phiên bản 1 ở phần 2–9 ngày 2026-11-01, gồm ISO/Text-only, requiredness tạo mới, duplicate policy, descriptor và catalog drift. Xác nhận nguyên văn: “duyệt contract”.
TASK-1 hoàn tất ở phạm vi quyết định; #112 lưu liên kết hợp đồng và kết quả review/verification. Quyết định này chưa phải bằng chứng implementation hoặc runtime.
Việc promote OpenSpec và triển khai parser được theo dõi riêng; #113 nguyên tử/provenance, #114 prototype local theo quyết định 2026-11-02, #115 phân chia OpenSpec và TASK-7 nghiệm thu runtime là các task riêng.
