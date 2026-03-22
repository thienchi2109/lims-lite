## Why

Trang `/manager/approvals` vẫn cho cảm giác lag khi đổi qua lại giữa `Chờ duyệt KQ` và `Đã duyệt KQ` vì mỗi lần đổi tab đang đi qua `router.replace(...)`, kéo theo render lại server route và refetch lại toàn bộ queue cho tab mới. Repo đã có TanStack Query cho các luồng samples/count/detail khác, nhưng approval queue tab data vẫn chưa tận dụng cache, placeholder data, hay prefetch theo intent.

## What Changes

- Chuyển approval queue list sang luồng TanStack Query với cache riêng cho từng tab `review` / `completed`.
- Thêm client fetch path cho `getSamplesWithTab` qua `api-client` và `client-actions` để queue tab có thể tải lại mà không cần full route navigation.
- Refactor desktop và mobile approval tab switching để đồng bộ URL cục bộ, render cached rows ngay khi đổi tab, và refetch background khi cần.
- Thêm regression coverage theo TDD cho tab switch latency, URL sync, trạng thái lỗi tiếng Việt, và deep-link semantics hiện có.
- Chuẩn bị task breakdown + dispatch packets sẵn sàng cho subagent-driven-development với write scope tách biệt theo data layer, desktop UI, mobile UI, và verification.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `sample-management`: bổ sung yêu cầu rằng manager approval queue SHALL dùng TanStack Query cache/prefetch cho tab switching để tránh full route refresh chỉ vì đổi giữa `review` và `completed`.

## Impact

- **Code chính bị ảnh hưởng:**
  - `src/app/(dashboard)/manager/approvals/page.tsx`
  - `src/components/approval-tabs-client.tsx`
  - `src/components/approval-mobile-layout.tsx`
  - `src/components/approval-queue-table.tsx`
  - `src/app/actions/sample-approvals.ts`
  - `src/app/api/client-actions/route.ts`
  - `src/lib/api-client.ts`
  - `src/hooks/use-approval-queue.ts` (mới)
  - `src/types/query-keys.ts`
  - approval-related tests ở `src/components/__tests__/` và `src/hooks/__tests__/`
- **Dependencies / patterns:**
  - tái sử dụng TanStack Query đã có trong repo, không thêm package mới.
  - áp dụng `placeholderData`, hierarchical query keys, và adjacent-tab prefetch theo TanStack Query best practices.
- **Compliance / audit / RLS:**
  - chỉ thay đổi read path và client caching; không thêm mutation mới, không đổi audit semantics, không nới lỏng RLS.
- **Localization:**
  - mọi loading/error state mới vẫn phải dùng tiếng Việt.
