## 0. TDD Guardrails

- [x] 0.1 Không viết hoặc giữ production code cho mỗi slice trước khi test của slice đó fail vì đúng lý do kỳ vọng.
- [x] 0.2 Nếu test mới pass ngay lần đầu, phải siết assertion cho đến khi có trạng thái RED hợp lệ.
- [x] 0.3 Mỗi slice phải hoàn thành RED → GREEN → REFACTOR trước khi chuyển packet kế tiếp.

## 1. RED: Khóa regression cho tab switching

- [x] 1.1 Thêm test desktop chứng minh switch giữa `review` và `completed` không còn phụ thuộc full route navigation để hiển thị queue list.
- [x] 1.2 Thêm test cho cache reuse, prefetch tab đối diện, và URL sync của `tab` query param.
- [x] 1.3 Thêm test desktop/mobile để khóa semantics `sampleId`: nếu sample không thuộc tab mới thì detail state và URL phải bị clear nhất quán.
- [x] 1.4 Thêm test page-level hoặc integration test chứng minh hidden layout không mount duplicate queue query/tab-sync side effects trên breakpoint còn lại.
- [x] 1.5 Chạy targeted approval queue suites và xác nhận RED trước khi sửa code.

## 2. GREEN: Dựng data layer TanStack Query cho approval queue

- [x] 2.1 Expose `getSamplesWithTab` qua `src/app/api/client-actions/route.ts` và thêm wrapper `fetchApprovalQueueClient` trong `src/lib/api-client.ts`.
- [x] 2.2 Tạo `src/hooks/use-approval-queue.ts` và chuẩn hóa `approvalKeys.list(...)` theo query-key best practices.
- [x] 2.3 Trích shared tab URL sync helper/state contract dùng chung cho desktop và mobile; contract phải encode luôn rule clear `sampleId` khi sample không thuộc active tab.
- [x] 2.4 Cấu hình `placeholderData`, `staleTime`, và adjacent-tab prefetch phù hợp cho approval queue.
- [x] 2.5 Chốt owner strategy để chỉ một viewport-active layout được phép chạy queue query/tab-sync side effects tại một thời điểm.
- [x] 2.6 Chạy lại tests data/hook liên quan và xác nhận GREEN.

## 3. GREEN: Refactor UI tab switching sang cache-first path

- [x] 3.1 Refactor `src/components/approval-tabs-client.tsx` để dùng `useApprovalQueue` và shared tab state contract cho list data của tab hiện hành.
- [x] 3.2 Refactor `src/components/approval-mobile-layout.tsx` để dùng đúng shared tab state contract thay vì state machine riêng.
- [x] 3.3 Refactor `src/app/(dashboard)/manager/approvals/page.tsx` hoặc owner chung tương đương để hidden layout không mount duplicate queue side effects.
- [x] 3.4 Đảm bảo detail panel không hiển thị stale selection khi sample không thuộc tab mới.
- [x] 3.5 Soát code để không còn helper/tab-state duplication giữa desktop và mobile trước khi chốt GREEN.
- [x] 3.6 Chạy lại desktop/mobile interaction tests và xác nhận GREEN.

## 4. REFACTOR + Verification

- [x] 4.1 Dọn helper trùng lặp cho tab URL sync và prefetch sau khi GREEN.
- [x] 4.2 Chạy `npm run typecheck`.
- [x] 4.3 Chạy approval-related vitest suites.
- [x] 4.4 Chạy `npx -y react-doctor@latest . --verbose --diff`.
- [ ] 4.5 Smoke test thủ công `/manager/approvals` với switch tab liên tục ở desktop và mobile breakpoint, xác nhận không có duplicate fetch/prefetch do hidden layout.

## 5. Dispatch Packets Cho Subagent-Driven Development

- [x] 5.1 Chuẩn bị Packet A (Data Worker): ownership `src/app/actions/sample-approvals.ts`, `src/app/api/client-actions/route.ts`, `src/lib/api-client.ts`, `src/hooks/use-approval-queue.ts`, shared tab URL sync helper, `src/types/query-keys.ts`, tests/harness data layer liên quan; packet này phải định nghĩa `sampleId` clearing semantics trong shared contract.
- [x] 5.2 Chuẩn bị Packet B (Desktop Worker): ownership `src/components/approval-tabs-client.tsx` và desktop tests liên quan.
- [x] 5.3 Chuẩn bị Packet C (Mobile Worker): ownership `src/components/approval-mobile-layout.tsx` và mobile tests liên quan.
- [ ] 5.4 Chuẩn bị Packet D (Integration/Verification Worker): ownership `src/app/(dashboard)/manager/approvals/page.tsx`, integration tests, `react-doctor`, `typecheck`, và smoke evidence; packet này phải verify viewport-owner rule để không còn double mount side effects.
- [x] 5.5 Mỗi packet phải có RED command trước khi code, GREEN command sau khi code, file allowlist rõ ràng, và yêu cầu review theo spec compliance trước code-quality review.
- [x] 5.6 Packet B và C không được tự tạo helper/tab-state/query logic trùng lặp; mọi thay đổi vượt shared contract phải quay lại Packet A.
