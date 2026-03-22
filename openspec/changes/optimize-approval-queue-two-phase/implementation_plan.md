## Subagent Dispatch Plan (TDD-first)

Mục tiêu: tách work theo write-scope độc lập để chạy song song an toàn.

## Packet A - UI Interaction Worker (Phase 1)

- **Goal:** loại bỏ full queue reload khi chỉ đổi sample detail.
- **Owned files:**
  - `src/components/approval-queue-table.tsx`
  - `src/components/approval-mobile-layout.tsx`
  - `src/components/__tests__/approval-mobile-layout.test.tsx`
  - `src/components/__tests__/approval-queue-table.test.tsx`
- **RED command:**
  - `npx vitest run src/components/__tests__/approval-mobile-layout.test.tsx src/components/__tests__/approval-queue-table.test.tsx`
- **GREEN expectation:**
  - test mới fail trước vì queue/detail còn ghép data-path
  - pass sau khi refactor interaction path
- **DoD:**
  - đổi sample không trigger full list fetch cho active tab
  - row selection + mobile drawer behavior giữ nguyên UX hiện hành

## Packet B - Server Data Worker (Phase 2 prep + integration)

- **Goal:** chuẩn hóa contract queue page (rows + totalCount + sort/page params).
- **Owned files:**
  - `src/app/actions/sample-approvals.ts`
  - `src/types/query-keys.ts`
  - tests action-layer liên quan approval
- **RED command:**
  - command test action-layer approval queue (thêm mới theo suite hiện hữu)
- **GREEN expectation:**
  - action trả về đúng contract phân trang, không đổi semantics nghiệp vụ
- **DoD:**
  - tab `review/completed` dùng cùng contract phân trang
  - xử lý lỗi nhất quán với hiện trạng

## Packet C - DB Worker (Migrations + Security)

- **Goal:** thêm index và RPC pagination read-only.
- **Owned files:**
  - `supabase/migrations/<new_index_migration>.sql`
  - `supabase/migrations/<new_approval_queue_pagination_rpc>.sql`
- **RED command:**
  - SQL-level checks / test script chứng minh query path cũ còn thiếu pagination contract
- **GREEN expectation:**
  - migration apply thành công
  - RPC callable với manager context
- **Mandatory verification:**
  - `SELECT * FROM run_security_tests();`
  - kiểm tra policy/index hiện hành sau migration
- **DoD:**
  - `SECURITY INVOKER`
  - không nới lỏng RLS
  - security impact được ghi trong migration

## Packet D - Integration & Verification Worker

- **Goal:** xác nhận end-to-end behavior + quality gates.
- **Owned files:**
  - test integration mới/cập nhật quanh approval queue
  - không sửa SQL hay action contract (trừ khi fix test harness)
- **Commands:**
  - targeted vitest suites cho approval queue
  - `npm run typecheck`
  - `npx -y react-doctor@latest . --verbose --diff`
- **DoD:**
  - có bằng chứng RED/GREEN theo TDD
  - có log command + exit code cho tất cả quality gates

## Dispatch Order

1. Packet A + Packet C chạy song song (không đụng file nhau).
2. Packet B bắt đầu khi Packet C có RPC contract ổn định.
3. Packet D chạy sau khi A/B/C merge vào branch tích hợp.

## Coordination Rules

- Mỗi worker chỉ sửa file trong ownership; nếu cần vượt scope phải escalate.
- Không revert thay đổi của worker khác.
- Mọi claim “done” bắt buộc kèm command output tóm tắt.
