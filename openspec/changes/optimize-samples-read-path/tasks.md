## 1. TDD Guardrails

- [x] 1.1 Xác định các hành vi bắt buộc phải chứng minh RED trước khi đổi production code: shared core fetch, không blank toàn bộ bottom row, non-blocking enrichment, và không duplicate fetch.
- [x] 1.2 Với mỗi slice, nếu test mới pass ngay lần đầu thì siết assertion cho đến khi có trạng thái RED hợp lệ.
- [x] 1.3 Chỉ chuyển sang REFACTOR sau khi slice hiện tại đã hoàn thành đầy đủ RED → GREEN.

## 2. RED: Khóa hành vi selection flow của `/samples`

- [x] 2.1 Thêm hoặc cập nhật test chứng minh một lần chọn mẫu không được tạo duplicate core fetch giữa detail panel và assigned-results panel.
- [x] 2.2 Thêm regression test chứng minh đổi mẫu không blank toàn bộ bottom row khi previous selection vẫn còn usable.
- [x] 2.3 Thêm regression test cho behavior panel phải: core assigned-results path không còn phải chờ panel trái mount xong mới bắt đầu resolve.
- [x] 2.4 Thêm regression test chứng minh enrichment failure hoặc delay không được che khuất core sample detail và assigned results.
- [x] 2.5 Chạy targeted tests liên quan `/samples` và xác nhận RED vì luồng hiện tại còn waterfall hoặc duplicate reads.

## 3. GREEN: Thiết lập shared core selection query

- [x] 3.1 Thêm query key và hook/contract dùng chung cho core selected-sample payload keyed by `sampleId`.
- [x] 3.2 Refactor `src/components/samples-page-client.tsx` và `src/components/sample-bottom-row.tsx` để bottom row dựa trên shared core query và transition state thay vì chỉ detail loading.
- [x] 3.3 Refactor `src/components/assigned-tests-panel.tsx` và `src/hooks/use-assigned-tests-data.ts` để dùng core results từ shared query thay cho fetch path tách rời hiện tại.
- [x] 3.4 Đảm bảo selected row, loading affordance, và invalidation behavior vẫn đúng khi user đổi mẫu liên tục.
- [x] 3.5 Chạy lại targeted tests của selection flow và xác nhận GREEN.

## 4. GREEN: Tách enrichment khỏi critical path

- [x] 4.1 Refactor `src/components/sample-detail-panel.tsx` và `src/hooks/use-client.ts` để ưu tiên embedded client data, chỉ fallback fetch khi thật sự cần.
- [x] 4.2 Tách QC status, CoA status, và activity feed thành enrichment path độc lập không chặn first useful render của core payload.
- [x] 4.3 Giữ localized loading/error states chỉ trong vùng enrichment bị ảnh hưởng.
- [x] 4.4 Chạy lại targeted tests cho enrichment isolation và xác nhận GREEN.

## 5. DB Read-Path Verification

- [x] 5.1 Kiểm tra query plan của các core selection reads và ghi lại bottleneck thực tế của `sample detail` / `results by sample`.
- [x] 5.2 Nếu query plan cho thấy cần tối ưu thêm, tạo migration SQL read-only cho index phục vụ selection flow và ghi rõ security impact. Không cần migration mới sau `EXPLAIN ANALYZE`; read-path hiện tại đã dùng index sẵn có.
- [x] 5.3 Apply migration bằng Docker flow chuẩn của dự án và chạy `SELECT * FROM run_security_tests();`. Không áp dụng vì 5.2 kết luận không cần DB change.
- [x] 5.4 Xác nhận sau verification rằng migration mới cải thiện read path, hoặc ghi rõ vì sao không cần DB change.

## 6. REFACTOR + Verification

- [x] 6.1 Dọn query paths, hooks, và loading states cũ không còn cần sau khi shared core flow đã GREEN.
- [x] 6.2 Chạy `npm run typecheck`.
- [x] 6.3 Chạy test liên quan `/samples`, hooks selection, và sample detail/results panels.
- [x] 6.4 Chạy `npx -y react-doctor@latest . --verbose --diff` nếu thay đổi React hooks hoặc component boundaries.
- [ ] 6.5 Smoke test thủ công `/samples` với thao tác đổi mẫu liên tiếp, deep-link `sampleId`, và các mẫu có nhiều results.
