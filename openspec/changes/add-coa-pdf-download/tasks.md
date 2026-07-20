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

- [x] 3.1 Viết failing unit tests cho hash verification, filename-safe sample ID và ngày `generated_at` dạng `YYYYMMDD` theo `Asia/Ho_Chi_Minh`.
- [x] 3.2 Viết failing unit tests cho rate limit `5` lượt trong `10` phút theo identity kết hợp IP, gồm reset window, HTTP `429`, hard cap `10.000` keys, cleanup expired và từ chối key mới khi toàn bộ slots còn active.
- [x] 3.3 Tạo các module nhỏ dưới `src/lib/coa/pdf/` cho integrity, filename và rate limit; không phụ thuộc UI hoặc route auth.
- [x] 3.4 Chạy focused tests và xác nhận không có file mới vượt giới hạn 350 dòng.
- [x] 3.5 Ghi commit boundary cho các primitive thuần, chưa gọi PDF gateway hoặc raw Gotenberg.

## Phase 4. Xây authenticated PDF gateway client

> Giữ Phase 4 trong cùng OpenSpec change và một branch/PR. Thực hiện tuần tự ba
> TDD slice 4A, 4B và 4C; mỗi slice phải về green và có commit boundary riêng.
> Chưa thêm route/UI caller trước Phase 5.

### Slice 4A. Khóa multipart contract và success path

- [x] 4.1 Viết failing tests cho `POST /v1/convert/html`, file `index.html`, `emulatedMediaType=print`, `printBackground=true`, `preferCssPageSize=true`, `skipNetworkIdleEvent=false`, `failOnResourceLoadingFailed=true` và `failOnResourceHttpStatusCodes=[400,599]`; để native `FormData` tự tạo multipart `Content-Type` boundary.
- [x] 4.2 Viết failing tests khóa API server-only chỉ nhận authorized released HTML, không nhận caller-supplied URL, `Request`, `Headers`, cookie hoặc credential; success chỉ được trả sau khi response có `Content-Type: application/pdf`, bắt đầu bằng PDF signature và gateway `x-request-id` được thu thập khi hiện diện.
- [x] 4.3 Implement success path tối thiểu dưới `src/lib/coa/pdf/` bằng native `fetch`/`FormData`, lấy base URL từ compatibility setting `GOTENBERG_URL`, ghép cố định `/v1/convert/html`, trả PDF bytes cùng sanitized gateway request ID, chạy focused tests về green và ghi commit boundary cho Slice 4A.

### Slice 4B. Khóa credential và failure model

- [x] 4.4 Viết failing tests cho bearer đọc từ `PDF_GATEWAY_TOKEN_FILE`: env path thiếu, file không đọc được, token rỗng, credential bị gateway từ chối, timeout, service unavailable, gateway error và non-PDF response.
- [x] 4.5 Viết failing tests xác nhận client không forward cookie, incoming `Authorization`, CoA token, Supabase session hoặc service-role credential; không log HTML/token/response body; thu thập sanitized gateway `x-request-id` trên success và failure khi hiện diện.
- [x] 4.6 Implement typed non-sensitive failure model, timeout cleanup và dedicated bearer header; không automatic retry, không tự ghi log và không fallback raw Gotenberg. Chạy focused tests về green và ghi commit boundary cho Slice 4B.

### Slice 4C. Khóa application boundary

- [x] 4.7 Viết static regression tests xác nhận application source không chứa raw Gotenberg host/path, không resolve hoặc kết nối `gotenberg:3000` hay `/forms/chromium/convert/html`, và route/UI không thể cung cấp conversion URL hoặc auth headers cho client.
- [x] 4.8 Viết failure-path regression test xác nhận mỗi conversion attempt chỉ tạo tối đa một gateway request; gateway timeout, unavailable, non-PDF hoặc rejected credential không gây retry hay fallback sang endpoint thứ hai.
- [x] 4.9 Chạy toàn bộ focused gateway-client tests cùng `tests/pdf-gateway-auth-and-contract.test.ts`, `tests/pdf-gateway-compose-config.test.ts`, `tests/gotenberg-compose-config.test.ts` và `rtk npm run typecheck`; xác nhận mọi file mới dưới 350 dòng.
- [x] 4.10 Ghi commit boundary cho Slice 4C và xác nhận Phase 4 chưa thêm staff/client route, UI, database, migration hoặc deployment operation.

## Phase 5. Thêm luồng PDF cho staff

> Giữ Phase 5 trong cùng OpenSpec change và một branch/PR. Thực hiện tuần tự ba
> TDD slice 5A, 5B và 5C; mỗi slice phải về green và có commit boundary riêng.
> Không thêm client route hoặc UI trước Phase 6 và Phase 7.

### Slice 5A. Tách shared staff CoA access contract

- [x] 5.1 Viết failing tests cho shared staff CoA access loader: authenticated user, allowlist analyst/manager/doctor, confidential concealment, completed sample và latest ready report; kết quả authorized phải mang đủ `user.id`, `samples.sample_id`, `coa_reports.file_path`, `file_hash` và `generated_at` cho route PDF.
- [x] 5.2 Implement helper nhỏ dưới `src/lib/coa/`, tái sử dụng `getUserConfidentialAccess` và `isConfidentialAssociatedSample` mà không sửa hai helper có blast radius rộng; refactor route HTML staff dùng helper mới.
- [x] 5.3 Chạy unit tests của helper cùng `src/app/api/coa/view/route.test.ts`; xác nhận status, error body, storage behavior và HTML headers không đổi, rồi ghi commit boundary cho Slice 5A.

### Slice 5B. Khóa staff PDF success contract

- [x] 5.4 Viết failing route tests cho `GET /api/coa/view/pdf`: analyst, manager, doctor và confidential-authorized success; rate-limit key theo staff identity + IP; latest ready report; integrity pass; chỉ sau authorization mới gọi authenticated PDF gateway.
- [x] 5.5 Viết failing tests cho response `application/pdf`, `Content-Disposition` attachment, `Cache-Control: private, no-store` và filename `PhieuKetQuaXN-{samples.sample_id}-{YYYYMMDD}.pdf` từ filename-safe `samples.sample_id` cùng `coa_reports.generated_at` theo `Asia/Ho_Chi_Minh`.
- [x] 5.6 Implement success path tối thiểu tại `src/app/api/coa/view/pdf/route.ts` bằng shared access loader, bounded rate limiter, storage HTML, hash verification, `convertHtmlToPdf()` và existing filename helper; route không nhận conversion URL, headers hoặc credential từ caller.
- [x] 5.7 Chạy focused helper/HTML/PDF route tests về green và ghi commit boundary cho Slice 5B.

### Slice 5C. Khóa failure model và application boundary

- [x] 5.8 Viết failing route tests cho unauthenticated, role bị cấm, confidential concealment, sample chưa completed, ready report thiếu, storage failure, hash mismatch, rate limit, gateway auth failure, timeout, service unavailable, gateway error và non-PDF response.
- [x] 5.9 Implement typed Vietnamese failure mapping không lộ dữ liệu nhạy cảm; mọi request bị từ chối trước conversion không được gọi PDF gateway, mỗi conversion attempt chỉ gọi gateway một lần và không retry/fallback raw Gotenberg.
- [x] 5.10 Chạy focused staff helper/HTML/PDF route tests, toàn bộ gateway-client tests, application-boundary tests và `rtk npm run typecheck`; xác nhận file mới dưới 350 dòng và ghi commit boundary cho Slice 5C.

## Phase 6. Thêm luồng PDF cho client

> Giữ Phase 6 trong cùng OpenSpec change và một branch/PR. Thực hiện tuần tự ba
> TDD slice 6A, 6B và 6C; mỗi slice phải về green và có commit boundary riêng.
> Không thêm UI trước Phase 7.

### Slice 6A. Tách shared client CoA access contract

- [x] 6.1 Viết failing helper tests cho token cookie/Bearer, token hết hạn, ownership, sample completed, CoA ready, confidential concealment và query scope đúng sample/report; xác nhận service-role client chỉ được tạo sau khi token đã xác lập client identity.
- [x] 6.2 Implement shared client CoA access helper không nhận token qua query string, không tạo reusable service-role repository hoặc generic RLS bypass; refactor route HTML dùng helper nhưng giữ nguyên HTTP/audit contract hiện tại.
- [x] 6.3 Chạy helper tests, characterization tests của route HTML và `tests/coa-token-leak.test.mjs`; ghi commit boundary cho Slice 6A.

### Slice 6B. Khóa client PDF success và audit delivery gate

- [ ] 6.4 Viết failing route tests cho success path qua token cookie/Bearer, released report/hash/storage contract, deterministic attachment, một lần gọi authenticated `pdf-gateway`, success audit commit trước PDF delivery và audit insert lỗi phải fail closed.
- [ ] 6.5 Implement `GET /api/coa/download/pdf` bằng shared access helper và shared PDF primitives; chỉ conversion sau access/integrity checks, chỉ trả PDF sau success audit commit, không lưu PDF vào Storage/DB.
- [ ] 6.6 Viết failing tests rồi implement failure audit sau client identity bằng reason-code allowlist; audit persistence lỗi trả lỗi dịch vụ tiếng Việt và operational trace chỉ chứa metadata không nhạy cảm.
- [ ] 6.7 Chạy focused success/audit tests và ghi commit boundary cho Slice 6B.

### Slice 6C. Khóa failure model và application boundary

- [ ] 6.8 Viết failing route tests cho missing/invalid/expired token, ownership, sample chưa completed, CoA chưa ready, confidential concealment, storage failure, hash mismatch, rate limit và mọi typed conversion failure.
- [ ] 6.9 Implement typed Vietnamese failure mapping; mọi request bị từ chối trước conversion không được gọi PDF gateway, mỗi conversion attempt chỉ gọi gateway một lần và không retry/fallback raw Gotenberg.
- [ ] 6.10 Chạy toàn bộ focused client helper/HTML/PDF route tests, gateway/application-boundary tests, `tests/coa-token-leak.test.mjs` và `rtk npm run typecheck`; xác nhận file mới dưới 350 dòng và ghi commit boundary cho Slice 6C.

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
