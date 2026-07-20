# Mô hình đe dọa PDF Gateway

## Phạm vi

Tài liệu này mô tả ranh giới bảo mật cho đường chuyển đổi PDF:

```text
lims-app --pdf-client--> pdf-gateway --pdf-upstream--> gotenberg
```

- `lims-app` và `pdf-gateway` cùng ở network `pdf-client`.
- `pdf-gateway` và `gotenberg` cùng ở network `pdf-upstream`.
- `lims-app` không cùng network với raw Gotenberg.
- `pdf-gateway` và `gotenberg` không publish host port.
- Không có Cloudflare route, Tailscale listener, Tailscale Funnel hoặc public
  endpoint cho hai service này.

## Tài sản cần bảo vệ

- Nội dung HTML CoA và PDF kết quả.
- Bearer credential của LIMS.
- Client-policy chứa credential digest và giới hạn tài nguyên.
- Metadata audit dùng để truy vết yêu cầu.
- Tính sẵn sàng của LIMS, gateway, Gotenberg và home server.
- Các service Supabase/PostgreSQL cùng Compose stack.

## Ranh giới tin cậy

1. LIMS được phép gửi đúng contract chuyển đổi đã khóa.
2. Gateway là điểm xác thực, giới hạn tài nguyên và lọc contract.
3. Raw Gotenberg không được xem là API an toàn để app khác gọi trực tiếp.
4. Docker network chỉ giảm bề mặt kết nối; credential vẫn bắt buộc.
5. Host root và Docker daemon là trusted computing base.

## Đe dọa và biện pháp

### SSRF

HTML độc hại có thể yêu cầu Chromium truy cập metadata service, localhost hoặc
service nội bộ.

Biện pháp:

- Giữ `CHROMIUM_DENY_PRIVATE_IPS=true`.
- Không forward proxy, host-resolver, allow-list hoặc deny-list override.
- Tắt `downloadFrom` bằng `API_DISABLE_DOWNLOAD_FROM=true`.
- Chỉ nhận file `index.html`; không nhận URL chuyển đổi.
- Chỉ forward đúng các field render cố định.
- Khuyến nghị nhúng hoặc upload logo/QR thay vì tải từ URL bên ngoài.

Rủi ro còn lại:

- `pdf-upstream` chưa đặt `internal: true` vì CoA hiện có thể dùng logo hoặc QR
  bên ngoài. Phải xác nhận asset trước khi chặn toàn bộ egress.

### Cạn kiệt tài nguyên

Chromium và HTML/PDF lớn có thể làm cạn CPU, RAM, PID, socket hoặc hàng đợi.

Biện pháp:

- Giới hạn request bytes và response bytes.
- Giới hạn HTTP header, part count và part-header bytes.
- Giới hạn rate, burst, concurrency và queue theo client.
- Áp dụng deadline chung cho queue, upload, conversion và response.
- Hủy work và trả slot khi client disconnect.
- Đặt CPU, memory, PID và Chromium queue/concurrency trong Compose.
- Gateway chạy read-only, non-root, drop toàn bộ capability và bật
  `no-new-privileges`.

### HTML độc hại

HTML có thể dùng JavaScript nặng, tài nguyên lỗi, redirect hoặc option Chromium
không mong muốn.

Biện pháp:

- Chỉ cho phép đúng `POST /v1/convert/html`.
- Multipart allow-list gồm đúng `index.html` và sáu field/value của contract.
- Từ chối part lạ, thiếu hoặc trùng.
- Bật fail-on-resource-loading và fail trên mọi HTTP status từ `400` đến `599`.
- Không cho client thêm webhook, cookie, extra header hoặc proxy control.

### Rò rỉ thông tin xác thực

Bearer token có thể bị ghi log, đặt trong image, environment, Git hoặc forward
sang Gotenberg.

Biện pháp:

- Token plaintext nằm trong Docker secret file, không nằm trong environment.
- Gateway policy chỉ chứa SHA-256 digest.
- Secret segment giải mã được ít nhất 32 byte và được tạo bằng nguồn ngẫu nhiên
  mật mã.
- Gateway chỉ forward `content-type`, `content-length` và request ID.
- Audit không ghi `Authorization`, token, digest hoặc incoming headers.
- Tài liệu yêu cầu không commit secret vào Git.

### Di chuyển ngang

Một service bị chiếm quyền trên default Compose network có thể dò hoặc gọi
service khác.

Biện pháp:

- Default-network services không tham gia `pdf-client` hoặc `pdf-upstream`.
- LIMS không tham gia `pdf-upstream`, nên không bypass gateway để gọi
  `gotenberg:3000`.
- Gotenberg chỉ tham gia `pdf-upstream`.
- Gateway không có host port.

### Lạm dụng audit log

Attacker có thể chèn query string, header dài hoặc dữ liệu điều khiển terminal
vào log.

Biện pháp:

- Log route canonical, không log raw URL hoặc query string.
- Method và source IP được sanitize và giới hạn độ dài.
- Không log nội dung request/response, tên tệp hoặc multipart field value.
- Mỗi yêu cầu có request ID do gateway tự tạo.

## Audit metadata

Một JSON line chứa:

- `timestamp`
- `requestId`
- `clientId` sau khi xác thực
- `sourceIp`
- `method`
- `route`
- `status`
- `outcome`
- `requestBytes`
- `responseBytes`
- `durationMs`

Không lưu nội dung HTML, nội dung PDF, tên tệp, credential hoặc credential
digest.

## Điều kiện mở Tailscale trong tương lai

Gateway hiện không có listener qua Tailscale. Issue #84 chỉ được thực hiện sau
khi có app thứ hai và đã xác nhận owner, source node, auth, throughput, burst,
payload, asset, timeout và availability. Không dùng Funnel.
