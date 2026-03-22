## Context

Approval Queue hiện là route manager server-rendered: [page.tsx](/root/lims-lite/src/app/(dashboard)/manager/approvals/page.tsx) lấy `tab` từ search params rồi gọi `getSamplesWithTab(tab)` cho mỗi lần đổi tab. Trên client, [approval-tabs-client.tsx](/root/lims-lite/src/components/approval-tabs-client.tsx) đang dùng `router.replace(...)` để chuyển tab, nên thao tác đơn giản giữa `review` và `completed` vẫn phải đi qua full route refresh path.

Điều này đặc biệt đắt ở tab `completed` vì action [getSamplesWithTab](/root/lims-lite/src/app/actions/sample-approvals.ts) vẫn trả full dataset của tab với nested `results` và `coa_reports`, trong khi page chưa dùng TanStack Query cho queue list dù repo đã có pattern tương tự ở `useSamples`, `useSampleDetail`, và `useApprovalCount`.

Change này là follow-on riêng cho lag khi switch tab. Nó không thay thế change `optimize-approval-queue-two-phase`; phase pagination/RPC vẫn là bước structural tiếp theo.

## Goals / Non-Goals

**Goals:**
- Giảm độ trễ cảm nhận khi manager đổi giữa hai tab của approval queue.
- Tận dụng cache và prefetch của TanStack Query cho queue list theo từng tab.
- Giữ deep-link `?tab=...` và initial server auth gate hiện tại.
- Chuẩn bị implementation packets đủ rõ để dispatch theo subagent-driven-development.
- Khóa hành vi bằng TDD trước khi thay đổi data path và UI path.

**Non-Goals:**
- Không triển khai server-side pagination hoặc RPC mới trong change này.
- Không thay đổi nghiệp vụ approve/cancel/reject/discard.
- Không đổi schema database hay thêm migration.
- Không refactor toàn bộ approval detail flow ngoài những gì cần thiết để tab switch không lag.

## Decisions

### Decision 1: Approval queue list sẽ dùng TanStack Query hook riêng thay vì tiếp tục phụ thuộc server route cho mỗi tab switch

- **Chọn:** tạo `useApprovalQueue` hook với query key riêng cho từng tab.
- **Vì sao:** tab switch là read-only interaction, phù hợp nhất với TanStack Query cache hơn là full App Router navigation.
- **Alternative đã cân nhắc:**
  - Tiếp tục dùng `router.replace(...)` và cố tối ưu server render: vẫn giữ network/render cost cao cho mỗi lần đổi tab.

### Decision 2: Query key phải dùng cấu trúc phân cấp và include dependencies ngay từ đầu

- **Chọn:** dùng key dạng `approvalKeys.list({ tab })` thay vì key string phẳng.
- **Vì sao:** khớp TanStack Query best practices, tránh cache collision, và cho phép mở rộng tự nhiên sang `page/pageSize/sort` ở change pagination sau này.
- **Alternative đã cân nhắc:**
  - Giữ `approvalKeys.list(tab: string)`: đủ dùng ngắn hạn nhưng khó nối tiếp sang contract phân trang mà không đổi key shape thêm lần nữa.

### Decision 3: Client fetch path sẽ đi qua `api-client` + `/api/client-actions`, không gọi Server Action trực tiếp từ hook

- **Chọn:** expose `getSamplesWithTab` qua client action handler và thêm wrapper `fetchApprovalQueueClient`.
- **Vì sao:** đúng pattern repo hiện tại cho client-side fetch/mutation, giữ auth/cookie path nhất quán, và không bypass các guard hiện hữu.
- **Alternative đã cân nhắc:**
  - Tạo route handler riêng `/api/approvals`: thêm surface area mới không cần thiết cho change này.

### Decision 4: Tab switch sẽ đồng bộ URL cục bộ thay vì full route navigation

- **Chọn:** update `tab` query param bằng History API/URL sync helper, để UI đổi tab dựa trên client state + query cache.
- **Vì sao:** mục tiêu của change là loại bỏ chi phí route-level refetch chỉ vì đổi tab.
- **Alternative đã cân nhắc:**
  - Giữ `router.replace(...)`: làm URL đúng nhưng không giải quyết root cause lag.

### Decision 5: Shared tab-state contract là bắt buộc để tránh duplication giữa desktop/mobile

- **Chọn:** mọi logic quyết định `active tab`, `URL sync`, `prefetch tab đối diện`, và `clear/keep selection across tabs` phải nằm trong shared hook/helper hoặc shared utility contract; desktop và mobile chỉ được wire UI lên contract này.
- **Vì sao:** desktop và mobile đang là hai entry points khác nhau của cùng một workflow manager approvals. Nếu mỗi layout tự cài lại state machine tab switching, change này sẽ tạo hai biến thể hành vi khó test và khó nối tiếp sang pagination phase.
- **Alternative đã cân nhắc:**
  - Cho phép desktop/mobile tự triển khai cùng spec rồi “sync bằng review”: nhanh ngắn hạn nhưng gần như chắc chắn tạo drift logic và duplication.

### Decision 6: Prefetch tab đối diện, nhưng chỉ ở mức adjacent tab

- **Chọn:** prefetch tab còn lại sau initial load hoặc theo user intent (focus/hover), và dùng `placeholderData` để giữ UI ổn định khi refetch.
- **Vì sao:** đáp ứng mục tiêu perceived performance mà không mở rộng network cost sang detail prefetch hoặc eager fetch mọi biến thể.
- **Alternative đã cân nhắc:**
  - Eager load cả hai tab ngay khi mount: đơn giản hơn nhưng tăng payload tức thời và không cần thiết với user chỉ xem một tab.

### Decision 7: Change này giữ scope riêng với pagination/RPC follow-up

- **Chọn:** chỉ xử lý tab-switch caching/prefetch trong change này, còn server-side pagination tiếp tục ở change `optimize-approval-queue-two-phase`.
- **Vì sao:** tách perceived-latency fix nhanh khỏi structural DB/query refactor lớn hơn.
- **Alternative đã cân nhắc:**
  - Gộp cả TanStack Query tab caching và pagination/RPC vào cùng một proposal: scope lớn, khó dispatch, khó review.

## Risks / Trade-offs

- **[Risk]** Đồng bộ giữa URL query params và state cache có thể drift nếu helper tab sync không nhất quán.  
  **→ Mitigation:** viết regression tests cho hard refresh, direct deep-link, và repeated tab switching.

- **[Risk]** Prefetch tab đối diện làm tăng background requests.  
  **→ Mitigation:** chỉ prefetch adjacent tab, dùng staleTime hữu hạn, và ưu tiên reuse cache trước khi refetch.

- **[Risk]** Queue data path mới có thể chồng chéo với follow-up pagination work.  
  **→ Mitigation:** chuẩn hóa query key shape theo hướng có thể mở rộng sang `page/pageSize/sort` thay vì hardcode key một lần nữa.

- **[Risk]** Mobile và desktop có thể diverge nếu mỗi layout tự quản lý tab/query riêng.  
  **→ Mitigation:** shared hook/query contract + shared URL sync helper là bắt buộc; packet desktop/mobile không được tạo state machine tab switching riêng.

- **[Risk]** Shared abstraction có thể bị over-engineer so với scope quick win.  
  **→ Mitigation:** chỉ trích xuất đúng 2 thứ dùng chung thật sự là query contract và tab URL sync helper; không tạo framework approval mới.

## Migration Plan

1. Viết RED tests cho tab switching, cache reuse, prefetch, và URL sync.
2. Thêm client action wrapper + hook `useApprovalQueue` + shared tab URL sync helper.
3. Refactor desktop/mobile approval tabs sang path mới bằng shared contract.
4. Chạy targeted tests, `npm run typecheck`, `react-doctor`, và smoke test `/manager/approvals`.

**Rollback:** revert hook/client-action/UI integration về path server-driven hiện tại; không có migration DB để rollback.

## Open Questions

- Khi switch sang tab mà sample đang chọn không tồn tại trong tab mới, có nên clear selection ngay hay giữ selected detail tới khi user chọn lại?
- Stale time tối ưu cho approval queue nên là bao nhiêu để cân bằng perceived speed và freshness trong môi trường manager thực tế?
