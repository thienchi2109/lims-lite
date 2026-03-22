## 0. TDD Guardrails

- [ ] 0.1 Không viết hoặc giữ production code cho mỗi slice trước khi test của slice đó fail vì đúng lý do kỳ vọng.
- [ ] 0.2 Nếu test mới pass ngay lần đầu, phải siết assertion cho đến khi có trạng thái RED hợp lệ.
- [ ] 0.3 Mỗi slice phải hoàn thành RED → GREEN → REFACTOR trước khi chuyển packet kế tiếp.

## 1. RED: Khóa regression cho tab switching

- [ ] 1.1 Thêm test desktop chứng minh switch giữa `review` và `completed` không còn phụ thuộc full route navigation để hiển thị queue list.
- [ ] 1.2 Thêm test cho cache reuse, prefetch tab đối diện, và URL sync của `tab` query param.
- [ ] 1.3 Thêm test mobile để xác nhận hành vi tab switching mới không làm lệch deep-link hoặc leak detail state sai tab.
- [ ] 1.4 Chạy targeted approval queue suites và xác nhận RED trước khi sửa code.

## 2. GREEN: Dựng data layer TanStack Query cho approval queue

- [ ] 2.1 Expose `getSamplesWithTab` qua `src/app/api/client-actions/route.ts` và thêm wrapper `fetchApprovalQueueClient` trong `src/lib/api-client.ts`.
- [ ] 2.2 Tạo `src/hooks/use-approval-queue.ts` và chuẩn hóa `approvalKeys.list(...)` theo query-key best practices.
- [ ] 2.3 Cấu hình `placeholderData`, `staleTime`, và adjacent-tab prefetch phù hợp cho approval queue.
- [ ] 2.4 Chạy lại tests data/hook liên quan và xác nhận GREEN.

## 3. GREEN: Refactor UI tab switching sang cache-first path

- [ ] 3.1 Refactor `src/components/approval-tabs-client.tsx` để dùng `useApprovalQueue` cho list data của tab hiện hành.
- [ ] 3.2 Refactor `src/components/approval-mobile-layout.tsx` để dùng cùng contract tab switching và URL sync helper.
- [ ] 3.3 Đảm bảo detail panel không hiển thị stale selection khi sample không thuộc tab mới.
- [ ] 3.4 Chạy lại desktop/mobile interaction tests và xác nhận GREEN.

## 4. REFACTOR + Verification

- [ ] 4.1 Dọn helper trùng lặp cho tab URL sync và prefetch sau khi GREEN.
- [ ] 4.2 Chạy `npm run typecheck`.
- [ ] 4.3 Chạy approval-related vitest suites.
- [ ] 4.4 Chạy `npx -y react-doctor@latest . --verbose --diff`.
- [ ] 4.5 Smoke test thủ công `/manager/approvals` với switch tab liên tục ở desktop và mobile breakpoint.

## 5. Dispatch Packets Cho Subagent-Driven Development

- [ ] 5.1 Chuẩn bị Packet A (Data Worker): ownership `src/app/actions/sample-approvals.ts`, `src/app/api/client-actions/route.ts`, `src/lib/api-client.ts`, `src/hooks/use-approval-queue.ts`, `src/types/query-keys.ts`, tests/harness data layer liên quan.
- [ ] 5.2 Chuẩn bị Packet B (Desktop Worker): ownership `src/components/approval-tabs-client.tsx` và desktop tests liên quan.
- [ ] 5.3 Chuẩn bị Packet C (Mobile Worker): ownership `src/components/approval-mobile-layout.tsx` và mobile tests liên quan.
- [ ] 5.4 Chuẩn bị Packet D (Integration/Verification Worker): ownership `src/app/(dashboard)/manager/approvals/page.tsx`, integration tests, `react-doctor`, `typecheck`, và smoke evidence.
- [ ] 5.5 Mỗi packet phải có RED command trước khi code, GREEN command sau khi code, file allowlist rõ ràng, và yêu cầu review theo spec compliance trước code-quality review.
