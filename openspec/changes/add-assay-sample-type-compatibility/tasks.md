## 1. Phase 1 - Sample-Type Master Data (PR/Session 1)

- [x] 1.1 Rebase từ `main`, xác minh migration number mới nhất và query read-only home-server baseline mà không đọc dữ liệu định danh.
- [x] 1.2 Viết regression tests đỏ cho mã `LM-NNNNNN`, blank/collision abort, code immutability, soft delete, `compatibility_generation`, grants/RLS và exact audit trigger binding.
- [x] 1.3 Tạo migration forward-only thêm sequence, `sample_types`, `samples.sample_type_id`, constraints/indexes và projection `samples.type`; không thay assignment RPC.
- [x] 1.4 Backfill loại mẫu/liên kết mẫu theo ánh xạ xác định; abort nguyên transaction nếu blank, collision hoặc hậu điều kiện không đạt.
- [x] 1.5 Chạy focused migration/SQL/security tests, typecheck nếu contracts đổi và OpenSpec strict validation.
- [x] 1.6 Hoàn tất phase chỉ khi migration chưa apply persistent DB, file cũ giữ nguyên và assignment production chưa đổi hành vi.

## 2. Phase 2 - Compatibility Revision Core (PR/Session 2)

- [x] 2.1 Viết tests đỏ cho revision/review/pair schema, published immutability, một-draft/một-published invariants và lifecycle generation snapshot.
- [x] 2.2 Tạo migration forward-only thêm revision, review, allowlist và candidate provenance tables cùng constraints/indexes/audit.
- [x] 2.3 Bootstrap revision 1 draft với `source_revision_id = NULL`, system/migration actor và candidate lịch sử trong một transaction; candidate chưa review không có authority.
- [x] 2.4 Thêm tests cho bootstrap atomicity, content integrity, candidate non-authority, assay/sample-type retire/restore generation và rollback khi baseline sai.
- [x] 2.5 Chạy focused migration/SQL/security tests và OpenSpec strict validation.
- [x] 2.6 Hoàn tất phase chỉ khi có foundation để review nhưng chưa có resolver/assignment enforcement.

## 3. Phase 3 - Catalog RPC And Application Contracts (PR/Session 3)

- [ ] 3.1 Viết tests đỏ cho manager-only clone/update/review/publish, full coverage, same-manager publication, optimistic concurrency, content hash và audit actor/reason.
- [ ] 3.2 Tạo migration forward-only cho catalog RPCs với `SECURITY DEFINER`, fixed `search_path`, explicit revoke/grant; Analyst chỉ đọc published catalog tối thiểu.
- [ ] 3.3 Thêm Zod/TypeScript contracts và API client actions; client không gửi code, actor, hash hoặc publication state tùy ý.
- [ ] 3.4 Chạy focused SQL/action/API tests, typecheck, lint và OpenSpec strict validation.
- [ ] 3.5 Hoàn tất phase chỉ khi manager contracts đủ để quản trị catalog, Analyst không đọc draft và assignment RPC cũ vẫn nguyên trạng.

## 4. Phase 4 - Manager Workspace And First Publication (PR/Session 4)

- [ ] 4.1 Viết component tests đỏ cho coverage filters, candidate provenance, review disposition, draft diff và publish reason.
- [ ] 4.2 Tạo `/manager/assays/compatibility`, liên kết từ trang chỉ tiêu và dùng toàn bộ nhãn/lỗi tiếng Việt; không lộ draft cho Analyst.
- [ ] 4.3 Chạy focused component tests, React Doctor, typecheck, lint và OpenSpec strict validation.
- [ ] 4.4 Sau merge/push, apply chỉ migration Phase 1-3 trên home server, deploy manager app và chạy `run_security_tests()` cùng smoke manager workspace.
- [ ] 4.5 Phụ trách chuyên môn review toàn bộ coverage, ghi lý do và publish revision 1; lưu revision/hash/actor aggregate không chứa dữ liệu định danh.
- [ ] 4.6 Hoàn tất phase chỉ khi đúng một revision published hoàn chỉnh tồn tại và assignment production vẫn dùng contract cũ.

## 5. Phase 5 - Additive Resolver And Assignment V2 (PR/Session 5)

- [ ] 5.1 Viết tests đỏ cho resolver success, missing catalog/pair, stale expected revision, inactive entity và generation mismatch sau method/rename/retire/restore.
- [ ] 5.2 Viết transaction tests đỏ cho RPC v2, yêu cầu một pair lỗi rollback toàn bộ sample/result/audit và result lịch sử không bị diễn giải lại.
- [ ] 5.3 Tạo migration additive cho resolver và RPC create/accession/assign v2 nhận `sample_type_id`/`expected_revision_number`; giữ nguyên RPC cũ.
- [ ] 5.4 Preserve auth, sample status, method, sample quality, duplicate và audit behavior hiện tại; response v2 trả revision đã dùng và stable SQLSTATE.
- [ ] 5.5 Chạy focused migration/SQL/security tests và OpenSpec strict validation.
- [ ] 5.6 Sau merge/push, apply migration v2 trên home server và smoke app cũ để chứng minh additive compatibility.

## 6. Phase 6 - Server And API Adoption (PR/Session 6)

- [ ] 6.1 Viết action/API tests đỏ cho sample-type id/code, expected revision, RPC v2 selection và mapping error code sang thông báo tiếng Việt an toàn.
- [ ] 6.2 Cập nhật Zod/types, `api-client` route và server actions dùng RPC v2; không fallback text tự do, raw DB error hoặc RPC cũ.
- [ ] 6.3 Tạm thời chấp nhận legacy request shape chỉ để trả lỗi tiếng Việt yêu cầu tải lại; không thực hiện assignment và không fallback sang RPC cũ.
- [ ] 6.4 Chạy focused action/API tests, typecheck, lint và OpenSpec strict validation.
- [ ] 6.5 Hoàn tất phase sau merge/push nhưng chưa deploy app; release production phải chờ Phase 7 UI merge để không tạo trạng thái server/UI lệch contract.

## 7. Phase 7 - Accession And Assignment UI (PR/Session 7)

- [ ] 7.1 Viết component/integration tests đỏ cho desktop/mobile picker theo loại mẫu, incompatible/stale hiding, revision reload và selection reset khi đổi loại mẫu.
- [ ] 7.2 Cập nhật accession wizard, test-assignment module và gán bổ sung dùng published catalog; giữ specialty filter, pagination và responsive behavior.
- [ ] 7.3 Hiển thị compatibility status cần thiết trong assay manager read views nhưng không thêm workbook parser hoặc draft controls cho Analyst.
- [ ] 7.4 Chạy focused component/integration tests, React Doctor, typecheck, lint và OpenSpec strict validation.
- [ ] 7.5 Sau merge/push cả Phase 6-7, deploy server/API/UI trong cùng một release và smoke desktop/mobile; browser tab cũ SHALL nhận lỗi tải lại, không tạo assignment legacy.
- [ ] 7.6 Theo dõi log/telemetry qua cửa sổ vận hành đã định, xác minh mọi assignment thành công dùng v2 trong khi RPC cũ chỉ còn rollback path.

## 8. Phase 8 - Database Enforcement (PR/Session 8)

- [ ] 8.1 Viết tests đỏ cho direct `results` INSERT trigger, sample-type immutability sau result đầu tiên và precondition telemetry không còn assignment thành công qua contract cũ.
- [ ] 8.2 Tạo migration enforcement forward-only: xác minh published revision hoàn chỉnh, retire/revoke RPC cũ, bật result trigger và khóa thay đổi loại mẫu sau assignment.
- [ ] 8.3 Thêm tests chứng minh result lịch sử giữ nguyên, pair bị bỏ chỉ chặn INSERT mới và sửa loại mẫu trước result vẫn được audit.
- [ ] 8.4 Chạy focused migration/SQL/security tests, review exact function/trigger/grant bindings và OpenSpec strict validation.
- [ ] 8.5 Hoàn tất phase chỉ khi migration chưa apply production và rollback strategy là forward-only correction, không sửa file đã apply.

## 9. Phase 9 - Final Deployment And Runtime Verification (Session 9)

- [ ] 9.1 Xác nhận các PR đã merge/push theo thứ tự, source và `/opt/lims-lite` up-to-date, migration numbers duy nhất và file đã apply giữ nguyên byte-for-byte.
- [ ] 9.2 Query preconditions: đúng một published revision hoàn chỉnh, không blank/collision, mọi assay active có disposition và mọi configured assay có pair active không stale.
- [ ] 9.3 Apply migration enforcement bằng `sudo -n docker exec ... psql -v ON_ERROR_STOP=1`; nếu lỗi, dừng và sửa bằng migration forward-only.
- [ ] 9.4 Chạy `run_security_tests()`, SQL regression suite và transactional drills cho valid/incompatible/stale/method-change/restore/direct-insert; không persist fixture.
- [ ] 9.5 Chạy app health checks, production smoke manager catalog và accession desktop/mobile; chạy focused tests, typecheck, lint và `openspec validate --all --strict`.
- [ ] 9.6 Cập nhật #107 và bổ sung runtime evidence vào #110 đã đóng, xác nhận contract revision sẵn sàng cho #112, archive change, commit/push archive và kiểm tra repo up-to-date với origin.
