## Context

Trang `/samples` hiện đã tối ưu khá tốt ở phần list: `useSamples` gọi RPC `get_samples_page` và giữ pagination/filter ở server-side. Vấn đề còn lại nằm ở selection flow của bottom row.

Khi user chọn một mẫu trong grid, luồng hiện tại diễn ra theo chuỗi:

1. `SamplesPageClient` đọc `sampleId` từ URL và gọi `useSampleDetail`.
2. Trong lúc `useSampleDetail` còn loading, `SampleBottomRow` blank cả hai panel.
3. Chỉ sau khi `sample detail` về, `AssignedTestsPanel` mới mount và `useAssignedTestsData` mới gọi `getResultsBySample`.
4. Sau khi có `results`, hook này còn phát sinh thêm fetch cho QC status; nếu sample đã `completed` thì lại fetch CoA status.
5. `SampleDetailPanel` vẫn khởi động `useClient`, dù `getSample()` đã join sẵn dữ liệu `client`.

Điều này tạo 3 chi phí riêng:
- waterfall giữa `sample detail` và `results`
- fetch phụ không critical nằm trên hoặc quá sát critical path
- cache/read contract bị tách rời giữa panel trái và panel phải

Người dùng sẽ cảm nhận rõ hơn khi:
- đổi mẫu liên tục trong grid
- mở các mẫu có nhiều result/assay
- làm việc trên kết nối có RTT cao hơn bình thường

Ràng buộc:
- Không đổi business rules của sample lifecycle, test assignment, result entry, hay permissions.
- Không bypass RLS; mọi read path vẫn đi qua server-side contract hiện có hoặc contract mới giữ nguyên security posture.
- Migrations, nếu có, chỉ phục vụ read performance; phải ghi rõ security impact và chạy `run_security_tests()`.
- TDD phải là delivery discipline bắt buộc cho toàn change.

## Goals / Non-Goals

**Goals:**
- Giảm độ trễ cảm nhận khi user chọn hoặc đổi mẫu trong `/samples`.
- Loại bỏ waterfall giữa core sample detail và core assigned-results data.
- Đưa panel trái và panel phải về cùng một cache/read contract theo `sampleId`.
- Giữ previous selection visible trong lúc selection mới đang fetch, thay vì blank toàn bộ bottom row.
- Tách các enrichment không critical như QC, CoA, activity feed, và client fallback ra khỏi first useful render.
- Giảm request trùng và chuẩn hóa invalidation/query-key cho selection flow.
- Lồng ghép TDD theo RED → GREEN → REFACTOR cho từng slice tối ưu.

**Non-Goals:**
- Không đổi layout lớn của `/samples` ngoài loading/transition states cần cho performance.
- Không đổi workflow mutation như assign tests, save batch results, submit for review, discard sample.
- Không refactor toàn bộ `sample-management` capability ngoài selection/read path của `/samples`.
- Không đổi copy tiếng Việt trừ khi cần bổ sung loading/error state tối thiểu cho phần enrichment.

## Decisions

### Decision 1: Tạo shared core selection contract theo `sampleId`

- **Chọn:** giới thiệu một read contract dùng chung cho bottom-row selection, trả về `sample detail + assigned results` như một core payload keyed by `sampleId`.
- **Vì sao:** đây là dữ liệu mà cả panel trái lẫn panel phải đều cần trong mọi lần chọn mẫu. Gom chúng vào cùng cache entry loại bỏ coordination phức tạp giữa 2 panel và giảm round-trip browser-level.
- **Alternative đã cân nhắc:**
  - Giữ `useSampleDetail` và `useAssignedTestsData` là hai luồng riêng rồi chỉ mount panel phải sớm hơn: giảm waterfall một phần, nhưng vẫn duy trì hai cache contract và hai invalidation path.
  - Chỉ chỉnh loading state mà không đổi data contract: perceived UX khá hơn nhưng duplicate reads và race complexity vẫn còn.

### Decision 2: Panel phải phải phụ thuộc vào `sampleId`, không phụ thuộc vào việc panel trái đã render xong

- **Chọn:** `AssignedTestsPanel` và dữ liệu core của nó phải có thể bắt đầu resolve ngay khi `sampleId` đổi, thay vì chờ `sample detail` xong rồi mới mount fetch path.
- **Vì sao:** dependency hiện tại đang nối mạng theo chuỗi mà không có lợi ích nghiệp vụ.
- **Alternative đã cân nhắc:**
  - Tiếp tục gate panel phải bằng `sample` object: đơn giản hơn về component props nhưng chính là nguồn waterfall hiện hữu.

### Decision 3: Dùng cache-first transition thay vì blank-state transition

- **Chọn:** khi đổi mẫu, giữ previous core payload visible trong lúc query mới pending; dùng loading affordance cục bộ để báo đang chuyển selection.
- **Vì sao:** selection lag hiện tại bị phóng đại bởi việc bottom row xóa sạch nội dung trước khi payload mới về.
- **Alternative đã cân nhắc:**
  - Reset toàn bộ bottom row về spinner: dễ cài nhưng UX tệ nhất khi user duyệt nhiều mẫu liên tục.

### Decision 4: Tách enrichment khỏi core payload

- **Chọn:** chỉ `sample detail + assigned results` nằm trong core payload. QC status, CoA status, activity feed, và client fallback là enrichment riêng, enabled theo dữ liệu đã có.
- **Vì sao:** enrichment có tính chất điều kiện và không phải lúc nào cũng cần để user bắt đầu đọc mẫu hoặc thao tác panel phải.
- **Alternative đã cân nhắc:**
  - Nhồi toàn bộ enrichment vào một payload lớn: giảm số query nhưng tăng payload, tăng coupling, và làm mọi selection phải chờ trường hợp nặng nhất.

### Decision 5: Loại bỏ eager client fetch khi embedded client đã đủ

- **Chọn:** `SampleDetailPanel` dùng embedded `client` từ `getSample()` cho initial render; chỉ fallback fetch khi payload không đủ hoặc sau các invalidation thật sự cần.
- **Vì sao:** payload detail hiện đã join client tương đối đầy đủ; fetch client ngay sau đó vừa trùng vừa không cải thiện first render.
- **Alternative đã cân nhắc:**
  - Giữ `useClient` luôn bật để “freshness” đồng nhất: freshness đổi bằng thêm một request mỗi lần chọn mẫu là không đáng ở luồng tương tác nóng.

### Decision 6: Đưa core results path sang query semantics chuẩn thay cho effect-local orchestration

- **Chọn:** dữ liệu core selection phải dùng TanStack Query semantics rõ ràng để có cache reuse, dedupe, cancellation, và background refresh dễ kiểm soát; local state/effect chỉ dành cho editor state hoặc mutation-local concerns.
- **Vì sao:** `useAssignedTestsData` hiện đang tự quản fetch lifecycle bằng refs/effects. Cách này xử lý race tốt nhưng không tận dụng shared cache giữa các consumer.
- **Alternative đã cân nhắc:**
  - Giữ hook effect-based rồi vá thêm caching tay: tăng phức tạp và khó đồng bộ với query invalidation hiện có.

### Decision 7: DB optimization là tùy theo query plan, nhưng phải gắn vào cùng change

- **Chọn:** review query plan của core selection reads; nếu `results by sample` hoặc related ordering cho thấy sort/scan không ổn ở dataset lớn, thêm migration index read-only trong chính change này.
- **Vì sao:** selection flow đã được xác định là bottleneck UX; nếu chỉ sửa client mà bỏ read-path DB, change sẽ thiếu tính hoàn chỉnh khi scale.
- **Alternative đã cân nhắc:**
  - Tách DB optimization sang change khác: giảm scope hiện tại nhưng dễ bỏ sót bottleneck thật.

### Decision 8: TDD là guardrail bắt buộc, không phải hậu kiểm

- **Chọn:** mỗi slice đều phải đi qua RED → GREEN → REFACTOR. Trước khi chạm production code phải có test fail chứng minh waterfall/duplicate fetch/current blank-state behavior.
- **Vì sao:** đây là performance change đa module; regression thường đến từ hành vi ngầm chứ không phải type error.
- **Alternative đã cân nhắc:**
  - Viết code trước rồi bổ sung test: nhanh hơn ở bề mặt nhưng dễ tạo false confidence và bỏ lọt regression ở interaction flow.

## Risks / Trade-offs

- **[Risk]** Shared core payload mới có thể chồng lấn với query keys hiện có (`sample detail`, `sample-tests`, `results`) và làm invalidation khó hiểu.  
  **→ Mitigation:** chuẩn hóa query-key ownership trong `src/types/query-keys.ts`, document rõ query nào là core selection query và query nào là enrichment.

- **[Risk]** Giữ previous data trong lúc pending có thể làm user hiểu nhầm đang xem mẫu cũ.  
  **→ Mitigation:** thêm selected-row highlight và loading affordance rõ ràng cho trạng thái “đang chuyển mẫu”.

- **[Risk]** Nếu gộp payload quá nhiều, mọi selection sẽ tải nặng hơn mức cần thiết.  
  **→ Mitigation:** chỉ gộp core detail + results; enrichment vẫn tách riêng.

- **[Risk]** DB index mới tăng nhẹ write cost trên bảng liên quan.  
  **→ Mitigation:** chỉ thêm index khi query-plan chứng minh cần thiết; ghi rõ security/read-performance impact; ưu tiên partial/composite index nhỏ gọn.

- **[Risk]** Các tests performance-oriented dễ bắt sai implementation detail thay vì behavior.  
  **→ Mitigation:** viết test theo observable contract: dedupe request count, không blank full bottom row, enrichment failure không che core content.

## Migration Plan

### Phase 0: TDD guardrails

1. Xác định các hành vi cần khóa bằng test trước:
   - chọn mẫu không blank toàn bộ bottom row khi cache còn usable
   - một lần đổi mẫu không tạo duplicate core fetch giữa hai panel
   - panel phải không còn bị chặn bởi việc panel trái mount xong
   - enrichment failure không che khuất core sample detail/results
2. Viết RED tests và xác nhận chúng fail vì đúng nguyên nhân.

### Phase 1: Shared core selection flow

1. Tạo shared core query/hook theo `sampleId`.
2. Refactor `SamplesPageClient` và `SampleBottomRow` để dựa vào core selection state thay vì chỉ `useSampleDetail`.
3. Refactor `AssignedTestsPanel`/`useAssignedTestsData` để dùng core payload shared cache cho results.
4. Giữ previous core data trong lúc pending và cập nhật loading affordance.
5. Chạy targeted tests, xác nhận GREEN.

### Phase 2: Enrichment isolation

1. Tách QC, CoA, activity feed, và client fallback thành enrichment queries độc lập.
2. Loại bỏ eager client fetch khi embedded client đủ dùng.
3. Kiểm tra error/loading states của từng enrichment vùng.
4. Chạy targeted tests, xác nhận GREEN rồi REFACTOR.

### Phase 3: Read-path verification và DB support

1. Benchmark/inspect query plans cho core selection reads.
2. Nếu cần, thêm migration index read-only phục vụ selection path.
3. Apply migration bằng Docker flow chuẩn, chạy `run_security_tests()`.
4. Chạy `npm run typecheck`, test liên quan, và verification bổ sung như `react-doctor` nếu component/hook thay đổi đáng kể.

### Rollback

- Rollback app-layer: revert shared core query path và quay lại detail/results queries cũ.
- Rollback DB-layer: drop index/migration chỉ-đọc đã thêm nếu query plan hoặc write impact không đạt kỳ vọng.
- Vì change không đổi mutation semantics nên rollback chủ yếu là rollback read-path.

## Open Questions

- Shared core payload nên đi qua một server action mới trả `{ sample, results }`, hay một hook client-side điều phối song song hai endpoint hiện có nhưng chỉ expose một cache contract?
- Có nên thêm index cụ thể cho pattern `results(sample_id, created_at)` ngay từ đầu, hay chỉ làm sau khi có query-plan evidence?
- UX transition nên hiển thị loading badge/overlay ở cấp bottom row hay ở từng panel để rõ trạng thái “đang chuyển mẫu” nhất?
