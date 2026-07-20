# Hướng dẫn vận hành PDF Gateway

## Ranh giới môi trường

- `/root/lims-lite` chỉ dùng để sửa, test, commit và push source.
- Không chạy hoặc deploy container trong `/root/lims-lite`.
- Home server là `khoa-xn-cdc@100.93.19.42`.
- Production checkout là `/opt/lims-lite`.
- Docker command trên home server phải dùng `sudo -n`.
- Không thay đổi database hoặc chạy migration cho gateway này.

Kết nối:

```bash
ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42
cd /opt/lims-lite
```

Các bước dưới đây chỉ thực hiện trong một phiên deploy được phê duyệt sau này,
không thực hiện trong source workspace hiện tại.

## 1. Tạo credential và client policy

Tạo thư mục secret ngoài repository:

```bash
sudo -n install -d -m 700 -o root -g root /opt/lims-lite-secrets
umask 077
```

Compose file-backed secrets giữ nguyên owner, group và quyền của file nguồn trên
host. Hai container chạy non-root, nên file phải do `root` sở hữu, chỉ cấp
group-read cho đúng GID của consumer:

- LIMS app chạy GID `1001`.
- PDF gateway chạy GID `10001`.

Thư mục cha vẫn là `root:root 0700`; không cấp quyền đọc cho user/group khác
trên host.

Tạo secret segment từ 32 byte ngẫu nhiên mật mã, chuyển sang base64url và ghép
client ID:

```bash
client_id=lims
secret="$(openssl rand -base64 32 | tr -d '\n=' | tr '+/' '-_')"
token="${client_id}.${secret}"
digest="$(printf '%s' "${token}" | sha256sum | cut -d ' ' -f 1)"
```

Ghi token cho LIMS, không in token ra terminal:

```bash
printf '%s' "${token}" \
  | sudo -n tee /opt/lims-lite-secrets/pdf-gateway-lims-token >/dev/null
sudo -n chown root:1001 /opt/lims-lite-secrets/pdf-gateway-lims-token
sudo -n chmod 640 /opt/lims-lite-secrets/pdf-gateway-lims-token
```

Ghi policy chỉ chứa digest:

```bash
sudo -n tee /opt/lims-lite-secrets/pdf-gateway-client-policy.json >/dev/null <<EOF
{
  "version": 1,
  "clients": [
    {
      "id": "lims",
      "credentialSha256": "${digest}",
      "maxRequestBytes": 8388608,
      "maxResponseBytes": 16777216,
      "timeoutMs": 30000,
      "requestsPerMinute": 30,
      "burst": 5,
      "maxConcurrent": 2,
      "maxQueue": 4
    }
  ]
}
EOF
sudo -n chown root:10001 /opt/lims-lite-secrets/pdf-gateway-client-policy.json
sudo -n chmod 640 /opt/lims-lite-secrets/pdf-gateway-client-policy.json
unset token secret digest
```

Không dùng `0644`, `0666` hoặc quyền world-readable. Không commit hai file
secret này vào Git.

## 2. Cấu hình environment

Production `.env` phải có:

```dotenv
GOTENBERG_URL=http://pdf-gateway:8080
PDF_GATEWAY_CLIENT_POLICY_FILE=/opt/lims-lite-secrets/pdf-gateway-client-policy.json
PDF_GATEWAY_LIMS_TOKEN_FILE=/opt/lims-lite-secrets/pdf-gateway-lims-token
```

Không thêm token plaintext vào `.env`.

## 3. Render và kiểm tra Compose

Đây là bước `docker compose config` có nạp `.env`; không start container:

```bash
sudo -n docker compose --env-file .env config --quiet
sudo -n docker compose --env-file .env config --format json \
  | jq '{
      gateway: .services["pdf-gateway"] | {
        ports, networks, read_only, cap_drop, security_opt, secrets
      },
      gotenberg: .services.gotenberg | {
        ports, networks, environment
      }
    }'
```

Kỳ vọng:

- `pdf-gateway.ports` và `gotenberg.ports` là `null`.
- Gateway ở `pdf-client` và `pdf-upstream`.
- Gotenberg chỉ ở `pdf-upstream`.
- `read_only=true`, `cap_drop=["ALL"]`,
  `security_opt=["no-new-privileges:true"]`.
- Không có Tailscale, Funnel hoặc Cloudflare route tới gateway.

Sau khi container đã healthy, xác nhận owner/group/mode, khả năng đọc và việc
mỗi container chỉ được mount secret của chính nó:

```bash
sudo -n docker exec lims-app sh -eu -c '
  id
  stat -c "%n %u:%g %a" /run/secrets/pdf_gateway_lims_token
  test -r /run/secrets/pdf_gateway_lims_token
  test "$(stat -c "%u:%g:%a" /run/secrets/pdf_gateway_lims_token)" = "0:1001:640"
  test ! -e /run/secrets/pdf_gateway_client_policy
'

sudo -n docker exec lims-pdf-gateway sh -eu -c '
  id
  stat -c "%n %u:%g %a" /run/secrets/pdf_gateway_client_policy
  test -r /run/secrets/pdf_gateway_client_policy
  test "$(stat -c "%u:%g:%a" /run/secrets/pdf_gateway_client_policy)" = "0:10001:640"
  test ! -e /run/secrets/pdf_gateway_lims_token
'
```

## 4. Deploy trong phiên được phê duyệt

Sau khi source commit đã có trong `/opt/lims-lite`:

```bash
sudo -n docker compose --env-file .env up -d --no-deps --build \
  gotenberg pdf-gateway app
```

Lệnh này khởi động container, vì vậy chỉ chạy trên home server trong cửa sổ
deploy; không chạy trong `/root/lims-lite`.

## 5. Kiểm tra network và port

```bash
sudo -n docker inspect lims-app lims-pdf-gateway lims-gotenberg \
  --format '{{.Name}} {{json .NetworkSettings.Networks}}'

sudo -n docker port lims-pdf-gateway
sudo -n docker port lims-gotenberg
```

Kỳ vọng hai lệnh `docker port` không trả về port nào.

Kiểm tra app không resolve raw Gotenberg nhưng resolve gateway:

```bash
sudo -n docker exec lims-app node -e \
  "require('node:dns').lookup('gotenberg',e=>console.log(e?'blocked':'unexpected'))"

sudo -n docker exec lims-app node -e \
  "require('node:dns').lookup('pdf-gateway',e=>{if(e)process.exit(1);console.log('ok')})"
```

## 6. Kiểm tra auth và conversion

Kiểm tra credential sai bị từ chối:

```bash
sudo -n docker exec -i lims-app node --input-type=module - <<'NODE'
const resourceHttpErrorStatusCodes = JSON.stringify(
  Array.from({ length: 200 }, (_, index) => index + 400)
)
const form = new FormData()
form.append('files', new Blob(['<html></html>'], { type: 'text/html' }), 'index.html')
form.append('emulatedMediaType', 'print')
form.append('printBackground', 'true')
form.append('preferCssPageSize', 'true')
form.append('skipNetworkIdleEvent', 'false')
form.append('failOnResourceLoadingFailed', 'true')
form.append('failOnResourceHttpStatusCodes', resourceHttpErrorStatusCodes)
const response = await fetch('http://pdf-gateway:8080/v1/convert/html', {
  method: 'POST',
  headers: { authorization: 'Bearer lims.invalid' },
  body: form,
})
console.log(response.status, response.headers.get('x-request-id'))
if (response.status !== 401) process.exit(1)
NODE
```

Sau khi Phase 3 conversion client tồn tại, chạy cùng contract bằng token đọc từ
`/run/secrets/pdf_gateway_lims_token`; chỉ in status, content type, byte count và
`x-request-id`, không in nội dung PDF hoặc token.

## 7. Kiểm tra audit

```bash
sudo -n docker logs --since 10m lims-pdf-gateway
```

Xác nhận log có request ID, client ID, status, outcome, byte count và duration;
không có `Authorization`, token, digest, `index.html`, HTML hoặc PDF.

## 8. Xoay vòng credential

1. Tạo token mới và digest mới như bước 1.
2. Ghi đè đồng thời hai secret file.
3. Recreate `pdf-gateway` và `app`.
4. Chạy auth/conversion verification.
5. Xác nhận token cũ trả `401`.

Không giữ token cũ trong repository, shell script hoặc ticket.

## 9. Hoàn tác

1. Deploy commit đã biết tốt trước thay đổi gateway.
2. Khôi phục `GOTENBERG_URL=http://gotenberg:3000`.
3. Render lại Compose.
4. Recreate `app` và `gotenberg`; remove `pdf-gateway` nếu còn.
5. Xác nhận HTML workflow và health check LIMS.

Rollback không cần database migration hoặc khôi phục cơ sở dữ liệu vì change này
không thay đổi schema hay dữ liệu.
