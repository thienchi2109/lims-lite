## Phase 1. Khóa hợp đồng hiện tại

- [x] 1.1 Bổ sung characterization tests cho quyền staff tại `src/app/api/coa/view/route.test.ts`, gồm role, sample completed, CoA ready và confidential concealment.
- [x] 1.2 Bổ sung characterization tests cho quyền client tại `src/app/api/coa/download/route.test.ts`, gồm token identity, query scope đúng sample/report, ownership, sample completed, CoA ready, confidential concealment và access log.
- [x] 1.3 Chạy `rtk npm test -- src/app/api/coa/view/route.test.ts src/app/api/coa/download/route.test.ts tests/coa-token-leak.test.mjs` và xác nhận baseline pass.
- [x] 1.4 Ghi commit boundary chỉ chứa test bảo vệ hành vi HTML hiện tại.

## Phase 2. Định nghĩa Gotenberg nội bộ

- [x] 2.1 Viết test cấu hình thất bại để yêu cầu custom Gotenberg image, không publish host port, có health check, resource limits, `GOTENBERG_URL`, `CHROMIUM_DENY_PRIVATE_IPS=true`, không đặt proxy/host-resolver tùy biến và không có allow-list bypass IP checks.
- [x] 2.2 Tạo `ops/gotenberg/Dockerfile` từ Gotenberg 8 pin digest, cài Microsoft Core Fonts bằng EULA non-interactive và trả về user `gotenberg`.
- [x] 2.3 Cập nhật `docker-compose.yml` và `.env.example`; giữ Gotenberg trên private Compose network và không thêm dependency bắt buộc vào app health/startup.
- [x] 2.4 Chạy test cấu hình và `rtk run "docker compose config --quiet"` trong source workspace; không start container tại workspace này.
- [x] 2.5 Ghi commit boundary cho hạ tầng Gotenberg chưa được app sử dụng.

> Baseline Phase 2 đã được change `harden-lims-gotenberg-access` siết lại: app chỉ thấy authenticated `pdf-gateway` trên `pdf-client`; raw Gotenberg chỉ nằm trên `pdf-upstream`. Mọi phase sau phải gọi `POST /v1/convert/html` với bearer từ `PDF_GATEWAY_TOKEN_FILE`, không được truy cập raw Gotenberg.

## Phase 3. Xây thư viện PDF thuần

- [ ] 3.1 Viết failing unit tests cho hash verification, filename-safe sample ID và ngày `generated_at` dạng `YYYYMMDD` theo `Asia/Ho_Chi_Minh`.
- [ ] 3.2 Viết failing unit tests cho rate limit `5` lượt trong `10` phút theo identity kết hợp IP, gồm reset window, HTTP `429`, hard cap `10.000` keys, cleanup expired và từ chối key mới khi toàn bộ slots còn active.
- [ ] 3.3 Tạo các module nhỏ dưới `src/lib/coa/pdf/` cho integrity, filename và rate limit; không phụ thuộc UI hoặc route auth.
- [ ] 3.4 Chạy focused tests và xác nhận không có file mới vượt giới hạn 350 dòng.
- [ ] 3.5 Ghi commit boundary cho các primitive thuần, chưa gọi PDF gateway hoặc raw Gotenberg.

## Phase 4. Xây authenticated PDF gateway client

- [ ] 4.1 Viết failing tests cho server-only authenticated gateway client: `POST /v1/convert/html`, `index.html`, `emulatedMediaType=print`, `printBackground=true`, `preferCssPageSize=true`, `skipNetworkIdleEvent=false`, `failOnResourceLoadingFailed=true` và `failOnResourceHttpStatusCodes=[400,599]`.
- [ ] 4.2 Viết failing tests cho bearer đọc từ `PDF_GATEWAY_TOKEN_FILE`, missing/rejected credential, timeout, non-PDF response, unavailable service, request-ID propagation, không log HTML/token và không forward cookie, incoming auth header, CoA token, Supabase session hoặc service-role credential.
- [ ] 4.3 Implement client dùng native `fetch`/`FormData`, lấy gateway base URL từ compatibility setting `GOTENBERG_URL`, chỉ gọi `POST /v1/convert/html`, và không cho phép route/UI hoặc client truy cập raw Gotenberg.
- [ ] 4.4 Thêm static regression test xác nhận app không resolve/kết nối raw Gotenberg và không fallback sang raw Gotenberg khi gateway lỗi hoặc từ chối credential.
- [ ] 4.5 Chạy focused tests và ghi commit boundary cho conversion client.

## Phase 5. Thêm luồng PDF cho staff

- [ ] 5.1 Viết failing route tests cho `GET /api/coa/view/pdf`: analyst, manager, doctor, role bị cấm, confidential access, hash mismatch, gateway auth failure và conversion failure.
- [ ] 5.2 Tách hoặc tái sử dụng staff CoA access helper từ route HTML mà không đổi response hiện tại; chạy characterization tests sau refactor.
- [ ] 5.3 Implement `src/app/api/coa/view/pdf/route.ts` với rate limit, latest ready report, integrity check và private no-store attachment response.
- [ ] 5.4 Kiểm tra filename `PhieuKetQuaXN-{samples.sample_id}-{YYYYMMDD}.pdf` từ `samples.sample_id` và `coa_reports.generated_at`; xác nhận request bị từ chối không gọi PDF gateway hoặc raw Gotenberg.
- [ ] 5.5 Chạy focused staff route tests và ghi commit boundary cho staff PDF.

## Phase 6. Thêm luồng PDF cho client

- [ ] 6.1 Viết failing route tests cho `GET /api/coa/download/pdf`: token cookie/Bearer, ownership, sample completed, CoA ready, expired token, confidential concealment, rate limit và conversion failure.
- [ ] 6.2 Tách hoặc tái sử dụng client CoA access helper từ route HTML mà không nhận token qua query string; chỉ vào service-role path sau token identity, scope query đúng sample/report, chỉ conversion sau access checks, rồi chạy characterization cùng token-leak tests.
- [ ] 6.3 Implement client PDF route với cùng report/hash/conversion contract của staff route.
- [ ] 6.4 Viết test và implement audit sau client identity: chỉ trả PDF sau khi success insert commit; failure dùng reason-code allowlist; audit insert lỗi thì fail closed, trả lỗi dịch vụ tiếng Việt và operational trace không chứa dữ liệu nhạy cảm.
- [ ] 6.5 Chạy focused client route tests và ghi commit boundary cho client PDF.

## Phase 7. Thêm nút tải PDF trong preview

- [ ] 7.1 Viết failing component tests cho nút `Tải PDF` ở client preview và staff preview trên desktop/mobile.
- [ ] 7.2 Viết failing tests cho pending state, chống double click, tải attachment thành công, lỗi tiếng Việt không mở print dialog, và expired client token quay về login/re-auth mà không auto-retry.
- [ ] 7.3 Cập nhật `src/components/coa-preview-dialog.tsx` và các caller để truyền đúng staff/client PDF endpoint, giữ nguyên HTML preview cùng các action hiện có.
- [ ] 7.4 Đối chiếu nội dung mới với `docs/vietnamese_dictionary.md` và giữ UI text hoàn toàn bằng tiếng Việt.
- [ ] 7.5 Chạy focused component tests và ghi commit boundary cho UI.

## Phase 8. Quality gates trong source workspace

- [ ] 8.1 Chạy toàn bộ focused CoA PDF, preview, auth parity và token-leak tests.
- [ ] 8.2 Chạy `rtk npm run lint`, `rtk npm run typecheck` và `rtk npm run build`.
- [ ] 8.3 Chạy `rtk run "docker compose config --quiet"` và static tests xác nhận app chỉ nối `pdf-client`, chỉ gọi authenticated `pdf-gateway`, không truy cập raw Gotenberg, hai PDF service không có host/Nginx/Tunnel/Tailscale exposure, Gotenberg có deny policy cho non-public IP, và conversion client chỉ gửi dedicated gateway bearer thay vì forward auth material.
- [ ] 8.4 Xác nhận không có migration/RLS/storage schema thay đổi; không chạy Supabase MCP, Supabase CLI hoặc database migration.
- [ ] 8.5 Chạy React Doctor cho diff nếu phase UI thay đổi React và xử lý các finding có giá trị.

## Phase 9. Rollout và kiểm chứng trên home server

- [ ] 9.1 Commit và push code trước khi vận hành; trên `khoa-xn-cdc`, cập nhật checkout `/opt/lims-lite` theo quy trình deploy hiện có.
- [ ] 9.2 Build và start gateway/Gotenberg trên home server; xác nhận gateway health/auth contract, raw Gotenberg không reachable từ app, `fc-match "Times New Roman"`, resource limits và không có host port.
- [ ] 9.3 Chạy smoke conversion từ một CoA fixture, xác nhận A4, màu, logo, QR, chữ ký, con dấu, watermark, footer và filename.
- [ ] 9.4 Deploy app, kiểm tra tải PDF bằng staff session và client CoA token trên desktop cùng mobile browser.
- [ ] 9.5 Lần lượt dừng gateway và Gotenberg trong cửa sổ kiểm chứng ngắn, xác nhận PDF báo lỗi tiếng Việt, không fallback sang raw Gotenberg, nhưng CoA creation và HTML preview vẫn hoạt động; sau đó khởi động lại và kiểm tra health.
- [ ] 9.6 Kiểm tra rate limit `5/10 phút`, bounded limiter, gateway bearer rejection, client success/failure access log, SSRF deny policy, trace không chứa dữ liệu nhạy cảm và không có PDF được lưu vào Storage/DB.
- [ ] 9.7 Hoàn tất `git pull --rebase`, `git push`, `git status` và xác nhận branch up to date với remote.
