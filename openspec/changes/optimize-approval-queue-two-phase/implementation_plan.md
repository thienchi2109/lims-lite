## Subagent Dispatch Plan (TDD-first)

Mục tiêu: tách work theo write-scope độc lập để chạy song song an toàn.

## Packet A - Shared Detail Worker (Phase 1)

- **Goal:** gom core detail path theo `sampleId`, bỏ duplicate `results` fetch, và giữ previous detail trong lúc sample mới đang tải.
- **Owned files:**
  - `src/components/approval-tabs-client.tsx`
  - `src/components/approval-bottom-row.tsx`
  - `src/hooks/use-sample-detail.ts`
  - `src/hooks/use-assigned-tests-data.ts`
  - desktop/detail tests liên quan approval
- **RED command:**
  - targeted vitest suites cho approval detail path (desktop)
- **GREEN expectation:**
  - test mới fail trước vì core detail/results còn fetch trùng
  - pass sau khi mọi panel dùng chung detail source
- **DoD:**
  - đổi sample không trigger full list fetch cho active tab
  - một lần chọn sample không fetch `results` trùng giữa panel
  - previous detail không bị blank toàn phần trước khi sample mới xong

## Packet B - Mobile Interaction Worker (Phase 1)

- **Goal:** đưa mobile selection sang cùng cache-first detail contract.
- **Owned files:**
  - `src/components/approval-mobile-layout.tsx`
  - `src/components/__tests__/approval-mobile-layout.test.tsx`
- **RED command:**
  - `npx vitest run src/components/__tests__/approval-mobile-layout.test.tsx`
- **GREEN expectation:**
  - test mới fail trước vì mobile còn phụ thuộc route-driven refresh
  - pass sau khi mobile detail path dùng cùng shared contract
- **DoD:**
  - đổi sample trên mobile không cần route refresh để render detail mới
  - deep-link ban đầu vẫn giữ semantics hiện có

## Packet C - Server Data Worker (Phase 2 prep + integration)

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

## Packet D - DB Worker (Migrations + Security)

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

## Packet E - Integration & Verification Worker

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

1. Packet A + Packet B + Packet D có thể chạy song song vì write-scope tách nhau.
2. Packet C bắt đầu khi Packet D có RPC contract ổn định.
3. Packet E chạy sau khi A/B/C/D merge vào branch tích hợp.

## Coordination Rules

- Mỗi worker chỉ sửa file trong ownership; nếu cần vượt scope phải escalate.
- Không revert thay đổi của worker khác.
- Mọi claim “done” bắt buộc kèm command output tóm tắt.
