# Hướng dẫn tích hợp PDF Gateway cho ứng dụng khác

## Trạng thái hiện tại

Gateway hiện chỉ phục vụ LIMS trên Docker network riêng. Gateway chưa publish
host port và chưa có listener Tailscale. App khác chưa thể kết nối.

Việc mở truy cập qua Tailscale, thêm tags/grants và kiểm chứng cross-host được
theo dõi tại Issue #84. Không dùng Tailscale Funnel và không gọi trực tiếp
`gotenberg:3000`.

## Thông tin app phải cung cấp

Trước khi thực hiện Issue #84, owner của app gửi:

- Tên app và owner vận hành.
- Tailscale node hoặc tag nguồn.
- Số request trung bình mỗi phút và burst.
- Số conversion đồng thời.
- Kích thước HTML/assets tối đa.
- Kích thước PDF dự kiến.
- Timeout và availability mục tiêu.
- Cách dùng logo, QR và asset: embedded, upload hay URL bên ngoài.
- Secret manager và quy trình xoay vòng credential của app.

Không tạo credential production trước khi các thông tin trên được duyệt.

## Contract kết nối tương lai

Endpoint sau Issue #84:

```text
http://<tailscale-gateway-ip>:<port>/v1/convert/html
```

Method:

```text
POST
```

Authentication:

```text
Authorization: Bearer <client-id>.<base64url-secret>
```

Mỗi app có credential và limit riêng. Lưu token trong secret manager hoặc secret
file read-only; không commit vào Git, `.env.example`, image hoặc log.

## Multipart contract

Request phải là `multipart/form-data` với đúng bảy part:

| Part | Giá trị |
| --- | --- |
| `files` | Một file duy nhất, filename `index.html`, content type `text/html` |
| `emulatedMediaType` | `print` |
| `printBackground` | `true` |
| `preferCssPageSize` | `true` |
| `skipNetworkIdleEvent` | `false` |
| `failOnResourceLoadingFailed` | `true` |
| `failOnResourceHttpStatusCodes` | `[400,599]` |

Part lạ, thiếu, trùng hoặc khác giá trị bị trả `400`. Không gửi cookie, webhook,
proxy, host-resolver, extra HTTP header, download instruction hoặc credential
của hệ thống nguồn.

## Ví dụ curl

```bash
export PDF_GATEWAY_URL='http://<tailscale-gateway-ip>:<port>'
export PDF_GATEWAY_TOKEN_FILE='/run/secrets/pdf_gateway_token'

{
  printf 'header = "Authorization: Bearer '
  tr -d '\r\n' < "${PDF_GATEWAY_TOKEN_FILE}"
  printf '"\n'
} | curl --config - \
  --fail-with-body --silent --show-error \
  --max-time 35 \
  --form 'files=@./index.html;filename=index.html;type=text/html' \
  --form 'emulatedMediaType=print' \
  --form 'printBackground=true' \
  --form 'preferCssPageSize=true' \
  --form 'skipNetworkIdleEvent=false' \
  --form 'failOnResourceLoadingFailed=true' \
  --form 'failOnResourceHttpStatusCodes=[400,599]' \
  --dump-header ./pdf-gateway-response.headers \
  --output ./result.pdf \
  "${PDF_GATEWAY_URL}/v1/convert/html"
```

Không bật shell tracing khi chạy lệnh có credential.

## Ví dụ Node.js

```js
import { readFile } from 'node:fs/promises'

const gatewayUrl = process.env.PDF_GATEWAY_URL
const token = (
  await readFile(process.env.PDF_GATEWAY_TOKEN_FILE, 'utf8')
).trim()
const html = await readFile('./index.html')

const form = new FormData()
form.append('files', new Blob([html], { type: 'text/html' }), 'index.html')
form.append('emulatedMediaType', 'print')
form.append('printBackground', 'true')
form.append('preferCssPageSize', 'true')
form.append('skipNetworkIdleEvent', 'false')
form.append('failOnResourceLoadingFailed', 'true')
form.append('failOnResourceHttpStatusCodes', '[400,599]')

const response = await fetch(`${gatewayUrl}/v1/convert/html`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
  signal: AbortSignal.timeout(35_000),
})

const requestId = response.headers.get('x-request-id')
if (!response.ok) {
  const error = await response.json().catch(() => ({ error: 'unknown' }))
  throw new Error(
    `PDF gateway ${response.status} ${error.error}; request=${requestId}`
  )
}

const pdf = Buffer.from(await response.arrayBuffer())
```

Không log `token`, `html`, `pdf` hoặc toàn bộ request headers.

## Mã lỗi

| Status | Ý nghĩa | Xử lý |
| --- | --- | --- |
| `400` | Sai route query, multipart contract hoặc field/value | Sửa request; không retry tự động |
| `401` | Thiếu, sai hoặc token quá yếu | Kiểm tra secret mount; yêu cầu rotation nếu cần |
| `404` | Sai path | Chỉ dùng `/v1/convert/html` |
| `405` | Sai method | Chỉ dùng `POST` |
| `413` | Request vượt giới hạn app | Giảm HTML/assets hoặc đề xuất limit mới |
| `429` | Vượt rate, concurrency hoặc queue | Backoff có jitter; không retry dồn dập |
| `502` | Gotenberg lỗi, response sai hoặc quá lớn | Retry giới hạn; gửi `x-request-id` cho operator |
| `504` | Hết deadline | Retry giới hạn; kiểm tra asset và độ phức tạp HTML |

Luôn ghi lại `x-request-id`, status, thời gian và tên operation trong log của app.
Không ghi credential hoặc nội dung tài liệu.

## Retry

- Chỉ retry `429`, `502`, `504`.
- Dùng exponential backoff có jitter.
- Tối đa 2 lần retry trừ khi owner gateway phê duyệt khác.
- Không retry `400`, `401`, `404`, `405`, `413`.
- Tôn trọng deadline tổng của workflow gọi.

## Xoay vòng credential

1. Owner gateway tạo token mới và cập nhật digest.
2. Owner app đưa token mới vào secret manager.
3. Deploy/restart client theo quy trình của app.
4. Chạy một conversion và lưu `x-request-id`.
5. Owner gateway vô hiệu token cũ.
6. Xác nhận token cũ trả `401`.

Không gửi token qua issue, chat công khai, email hoặc commit Git.

## Checklist trước khi go-live

- Issue #84 đã được thực hiện và review.
- Tailscale grants chỉ cho phép node/tag đã duyệt tới đúng gateway port.
- Node không được phép gọi raw `gotenberg:3000`.
- Credential riêng của app đã nằm trong secret manager.
- Limit đúng với profile tải đã cung cấp.
- Test thành công, credential sai, payload lớn, rate limit, timeout và audit đã
  chạy từ node thật.
- Có owner liên hệ và quy trình rollback.
