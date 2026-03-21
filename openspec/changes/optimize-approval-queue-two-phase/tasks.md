## 0. TDD Guardrails

- [ ] 0.1 Không viết hoặc giữ production code cho mỗi slice trước khi test của slice đó fail vì đúng lý do kỳ vọng.
- [ ] 0.2 Nếu test mới pass ngay lần đầu, phải siết assertion cho đến khi có trạng thái RED hợp lệ.
- [ ] 0.3 Mỗi phase phải hoàn thành RED → GREEN → REFACTOR trước khi chuyển phase kế tiếp.

## 1. Phase 1 RED: Khóa hành vi tương tác queue/detail

- [ ] 1.1 Thêm/điều chỉnh test để chứng minh đổi mẫu trong Approval Queue không kéo theo reload full queue dataset.
- [ ] 1.2 Thêm regression test cho deep-link `sampleId` để đảm bảo mở chi tiết đúng mà không refetch dư.
- [ ] 1.3 Chạy test mục tiêu của approval components và xác nhận fail vì data-path hiện tại còn ghép queue/detail.

## 2. Phase 1 GREEN: Tách data-path queue và detail (quick win)

- [ ] 2.1 Refactor `src/app/(dashboard)/manager/approvals/page.tsx` để giảm truy vấn detail phụ thuộc vào render toàn trang.
- [ ] 2.2 Refactor `src/components/approval-queue-table.tsx` và/hoặc `src/components/approval-mobile-layout.tsx` để selection detail không buộc reload full queue.
- [ ] 2.3 Giữ nguyên semantics nghiệp vụ approve/cancel/reject/discard và copy tiếng Việt.
- [ ] 2.4 Chạy lại test mục tiêu và xác nhận GREEN.

## 3. Phase 1 GREEN: Tối ưu index cho pattern queue

- [x] 3.1 Tạo migration thêm composite partial index `samples(status, updated_at DESC) WHERE deleted_at IS NULL`.
- [x] 3.2 Ghi rõ security impact trong migration (read-performance only, không đổi RLS policy semantics).
- [x] 3.3 Apply migration qua Docker flow chuẩn của dự án.
- [x] 3.4 Chạy `SELECT * FROM run_security_tests();` sau khi apply migration.

## 4. Phase 1 REFACTOR + Verification

- [ ] 4.1 Dọn code trùng lặp ở approval queue/detail sau khi GREEN, không đổi hành vi.
- [ ] 4.2 Chạy `npm run typecheck`.
- [ ] 4.3 Chạy test liên quan approval queue/detail.
- [ ] 4.4 Chạy `npx -y react-doctor@latest . --verbose --diff` và lưu kết quả.

## 5. Phase 2 RED: Khóa contract server-side pagination

- [ ] 5.1 Viết test cho action layer: queue API phải nhận `tab/page/pageSize/sort` và trả về `rows + totalCount`.
- [ ] 5.2 Viết test cho table layer: điều hướng trang phải kích hoạt request trang tương ứng thay vì dựa vào full dataset local.
- [ ] 5.3 Xác nhận test fail trước khi thêm RPC pagination.

## 6. Phase 2 GREEN: Thêm RPC pagination chuyên dụng

- [ ] 6.1 Tạo migration RPC read-only cho approval queue pagination với `SECURITY INVOKER`.
- [ ] 6.2 RPC phải trả counts cần hiển thị trên queue row mà không kéo toàn bộ nested results.
- [ ] 6.3 Đảm bảo role gate manager + RLS là lớp kiểm soát cuối.
- [ ] 6.4 Apply migration, reload PostgREST schema cache, chạy `run_security_tests()`.

## 7. Phase 2 GREEN: Chuyển UI sang server-side pagination thật sự

- [ ] 7.1 Refactor `src/app/actions/sample-approvals.ts` để dùng path pagination mới.
- [ ] 7.2 Refactor `src/components/approval-queue-table.tsx` + `src/components/sample-grid/SampleGridPagination.tsx` usage sang mode server cho approval queue.
- [ ] 7.3 Đảm bảo tab `review/completed` giữ đúng hành vi chọn mẫu, đổi trang, và cập nhật badge.
- [ ] 7.4 Chạy test mục tiêu và xác nhận GREEN.

## 8. Phase 2 REFACTOR + Full Verification

- [ ] 8.1 Dọn mapping/data transform trùng lặp sau migration sang RPC pagination.
- [ ] 8.2 Chạy toàn bộ test liên quan approval + typecheck.
- [ ] 8.3 Chạy `npx -y react-doctor@latest . --verbose --diff` sau thay đổi Phase 2.
- [ ] 8.4 Smoke test thủ công: `/manager/approvals?tab=completed` với đổi mẫu liên tiếp và chuyển trang liên tục.

## 9. Dispatch Packets Cho Subagents

- [ ] 9.1 Chuẩn bị Packet A (UI Interaction Worker): ownership `src/components/approval-queue-table.tsx`, `src/components/approval-mobile-layout.tsx`, test UI liên quan.
- [ ] 9.2 Chuẩn bị Packet B (Server Data Worker): ownership `src/app/actions/sample-approvals.ts`, typings/query-keys liên quan approval pagination contract.
- [ ] 9.3 Chuẩn bị Packet C (DB Worker): ownership migration SQL index + RPC pagination và checklist `run_security_tests()`.
- [ ] 9.4 Chuẩn bị Packet D (Integration/Verification Worker): ownership test integration + react-doctor + typecheck evidence.
- [ ] 9.5 Mỗi packet phải có lệnh RED test trước khi code, lệnh GREEN sau code, và danh sách file được phép sửa (disjoint write scope).
