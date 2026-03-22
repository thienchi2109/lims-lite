## Subagent Dispatch Plan (TDD-first)

Mục tiêu: giảm lag khi switch giữa `review` và `completed` bằng TanStack Query cache/prefetch, nhưng vẫn giữ deep-link semantics và file ownership tách biệt để triển khai an toàn bằng subagent-driven-development.

## Packet A - Data Worker

- **Goal:** dựng contract fetch/cache cho approval queue tabs.
- **Owned files:**
  - `src/app/actions/sample-approvals.ts`
  - `src/app/api/client-actions/route.ts`
  - `src/lib/api-client.ts`
  - `src/hooks/use-approval-queue.ts`
  - `src/types/query-keys.ts`
  - tests/harness data layer approval liên quan
- **RED command:**
  - targeted vitest command cho hook/client action/query-key contract mới
- **GREEN expectation:**
  - queue list query có cache key theo tab
  - adjacent-tab prefetch có test chứng minh
- **DoD:**
  - không bypass `api-client`
  - key shape future-proof cho `page/pageSize/sort`
  - không đổi semantics RLS/auth hiện tại

## Packet B - Desktop Worker

- **Goal:** desktop approval tabs dùng cache-first tab switching thay cho full route navigation.
- **Owned files:**
  - `src/components/approval-tabs-client.tsx`
  - `src/components/__tests__/approval-tabs-client.test.tsx`
- **RED command:**
  - `npx vitest run src/components/__tests__/approval-tabs-client.test.tsx`
- **GREEN expectation:**
  - switch tab không phụ thuộc server route navigation để hiện queue list
  - deep-link tab sync giữ đúng URL behavior
- **DoD:**
  - không làm hỏng selected sample/detail semantics đã có
  - error state vẫn là tiếng Việt

## Packet C - Mobile Worker

- **Goal:** mobile approval layout dùng cùng contract tab switching và không bị stale detail giữa hai tab.
- **Owned files:**
  - `src/components/approval-mobile-layout.tsx`
  - `src/components/__tests__/approval-mobile-layout.test.tsx`
- **RED command:**
  - `npx vitest run src/components/__tests__/approval-mobile-layout.test.tsx`
- **GREEN expectation:**
  - mobile tab switching giữ đúng URL sync
  - không leak selected detail sai tab
- **DoD:**
  - UX mobile drawer vẫn đóng/mở đúng như fix hiện tại

## Packet D - Integration & Verification Worker

- **Goal:** hoàn tất wiring chung, verify toàn bộ, và chốt bằng chứng cho review.
- **Owned files:**
  - `src/app/(dashboard)/manager/approvals/page.tsx`
  - integration tests approval liên quan
  - OpenSpec task checkboxes/evidence nếu cần cập nhật
- **Commands:**
  - approval-related vitest suites
  - `npm run typecheck`
  - `npx -y react-doctor@latest . --verbose --diff`
- **DoD:**
  - có bằng chứng RED/GREEN cho từng packet
  - checks cuối cùng pass hoặc có note rõ ràng về baseline còn lại

## Dispatch Order

1. Packet A trước để khóa contract hook/query key chung.
2. Packet B và Packet C sau khi Packet A merge vào branch tích hợp.
3. Packet D chạy cuối để wiring chung, verification, và review evidence.

## Coordination Rules

- Mỗi worker chỉ sửa file trong ownership; nếu cần vượt scope phải escalate.
- Workers không được revert thay đổi của nhau.
- Mọi claim `DONE` phải kèm command đã chạy và kết quả tóm tắt.
- Spec compliance review phải xảy ra trước code-quality review cho từng packet.
