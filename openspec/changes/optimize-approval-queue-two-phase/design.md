## Context

Manager Approval Queue hiện dùng luồng:

1. Server action `getSamplesWithTab(tab)` tải toàn bộ mẫu của tab (kèm nested `results` và `coa_reports`).
2. UI dùng TanStack Table phân trang phía client.
3. Khi đổi mẫu để xem chi tiết, URL `sampleId` thay đổi và có thể kéo theo chi phí render/fetch vượt nhu cầu thực tế.

Với tab `completed`, số mẫu tăng liên tục theo vận hành thực tế nên chi phí tải full dataset sẽ tăng tuyến tính theo dữ liệu, gây:
- tăng payload mạng
- tăng CPU transform ở app server
- tăng thời gian tương tác khi user đổi mẫu liên tục

Ngoài vấn đề queue list, detail path hiện còn có 3 nguồn trễ chính:
- desktop selection path tự clear detail rồi fetch `sample detail` + `results`, tạo cảm giác blank-state trước khi dữ liệu mới về
- `AssignedTestsPanel` fetch `results` lại cho cùng sample nên một lần chọn mẫu có thể tạo duplicate request cho cùng payload cốt lõi
- riêng `completed`, các fetch enrichment như CoA/QC/client detail nối thêm sau core detail làm thao tác đổi mẫu có nhiều chặng hơn tab `review`

Ràng buộc:
- Không thay đổi nghiệp vụ phê duyệt (status lifecycle giữ nguyên).
- Không bypass RLS.
- Migrations phải giữ an toàn Part 11 (security impact note + run_security_tests).

## Goals / Non-Goals

**Goals:**
- Giảm độ trễ cảm nhận khi manager đổi mẫu trong approval queue.
- Không fetch trùng `results` khi chỉ đổi sample detail.
- Giữ detail hiện tại trong lúc sample kế tiếp đang tải thay vì blank toàn bộ panel.
- Đảm bảo mobile và desktop dùng cùng detail-selection contract theo `sampleId`.
- Tách enrichment riêng của `completed` khỏi critical path của core detail.
- Ngăn tình trạng tải toàn bộ tab `completed` trước khi phân trang.
- Chuẩn hóa read-path queue để scale theo dữ liệu lớn.
- Áp dụng TDD cho mọi thay đổi hành vi và truy vấn.
- Chuẩn bị work packages độc lập để dispatch cho subagents.

**Non-Goals:**
- Không đổi business rules của approve/cancel/reject/discard.
- Không đổi copy tiếng Việt hoặc layout lớn của trang.
- Không refactor toàn bộ `/samples` workspace trong change này.
- Không thay đổi quyền/RLS semantics (chỉ tối ưu query/read flow).

## Decisions

### Decision 1: Triển khai theo 2 phase để giảm rủi ro

- **Chọn:** Phase 1 quick win trước, Phase 2 structural sau.
- **Vì sao:** giảm lag sớm cho người dùng, đồng thời giữ scope có thể rollback.
- **Alternative đã cân nhắc:**
  - Làm thẳng Phase 2 end-to-end trong 1 đợt: tối ưu mạnh hơn ngay nhưng rủi ro regression cao hơn, khó isolate root cause khi có lỗi.

### Decision 2: Phase 1 ưu tiên giảm chi phí tương tác đổi mẫu, không chờ full refactor

- **Chọn:** tách rõ chi phí queue list và chi phí detail panel; sample selection phải đi qua shared query theo `sampleId` để core detail/results chỉ có một nguồn dữ liệu.
- **Vì sao:** lag user cảm nhận chủ yếu ở thao tác chọn mẫu liên tiếp.
- **Alternative đã cân nhắc:**
  - Chỉ thêm debounce/throttle UI: không giải quyết root cause data-path.

### Decision 3: Phase 1 giữ previous detail trong lúc sample mới đang tải

- **Chọn:** không blank toàn bộ detail panel ngay khi click sample mới; thay vào đó giữ sample cũ và hiển thị trạng thái loading chuyển tiếp ở vùng cần thiết.
- **Vì sao:** phần lớn cảm giác "lag" hiện tại đến từ việc UI tự xóa detail trước khi request hoàn tất, dù network time không quá lớn.
- **Alternative đã cân nhắc:**
  - Tiếp tục reset toàn bộ panel về empty/loading state: implementation đơn giản hơn nhưng làm interaction trông chậm hơn thực tế.

### Decision 4: `completed` enrichments phải tách khỏi core detail path

- **Chọn:** core detail (sample + results cần để xem/approve/cancel) phải load trước; CoA/QC/client enrichments load riêng và không được tạo duplicate `results` fetch.
- **Vì sao:** `completed` luôn nặng hơn `review`, nên nếu enrichment nằm trên critical path thì tab này sẽ tiếp tục có độ trễ cảm nhận cao hơn mức cần thiết.
- **Alternative đã cân nhắc:**
  - Giữ mọi enrichment trong một chain effect hiện tại: ít đổi code hơn nhưng tiếp tục kéo chậm first useful paint của detail panel.

### Decision 5: Phase 1 thêm composite partial index cho pattern queue

- **Chọn:** index `samples(status, updated_at DESC) WHERE deleted_at IS NULL`.
- **Vì sao:** khớp trực tiếp filter + sort chính của approval queue.
- **Alternative đã cân nhắc:**
  - Chỉ dùng `idx_samples_status` + `idx_samples_updated_at_not_deleted` riêng lẻ: planner có thể vẫn phải sort nhiều khi cardinality lớn.

### Decision 6: Phase 2 dùng RPC chuyên dụng cho queue pagination + pre-aggregated counts

- **Chọn:** tạo RPC read-only trả về rows theo page + total_count (+ trường count cần render).
- **Vì sao:** giảm overfetch nested `results`; scale tốt khi tab completed lớn.
- **Alternative đã cân nhắc:**
  - Giữ PostgREST select hiện tại và thêm `.range()`: vẫn khó giữ logic aggregate count sạch, dễ duplicate mapping ở app layer.

### Decision 7: Bắt buộc TDD cho cả UI behavior và data-path

- **Chọn:** viết regression test RED trước cho:
  - không refetch full queue khi chỉ đổi detail
  - không duplicate `results` fetch khi đổi sample
  - mobile không phụ thuộc route refresh để mở detail sample mới
  - pagination query đúng page/size/sort
  - output contract giữ ổn định với UI
- **Vì sao:** change có ảnh hưởng performance + luồng tương tác, dễ regression âm thầm nếu không khóa hành vi.
- **Alternative đã cân nhắc:**
  - Thay đổi code trước rồi bổ sung test: không đảm bảo test thực sự bắt được bug/perf regression.

## Risks / Trade-offs

- **[Risk]** Tách detail fetch khỏi server render có thể làm mất deep-link semantics hiện tại.  
  **→ Mitigation:** giữ khả năng hydrate từ `sampleId` ban đầu; thêm test cho hard refresh với query param.

- **[Risk]** Nhiều panel dùng nguồn data khác nhau cho cùng sample (`results` ở action panel khác `results` ở assigned tests).  
  **→ Mitigation:** gom về shared query source cho core detail/results và chỉ cho enrichment fetch phần bổ sung.

- **[Risk]** RPC mới có thể drift so với contract UI hiện tại (field naming/count semantics).  
  **→ Mitigation:** thêm contract tests ở tầng action + component.

- **[Risk]** Index mới tăng chi phí ghi nhẹ trên `samples`.  
  **→ Mitigation:** dùng partial index (`deleted_at IS NULL`) để giới hạn footprint; theo dõi write latency sau deploy.

- **[Risk]** Scope Phase 2 lớn, dễ trộn với refactor unrelated.  
  **→ Mitigation:** chia work packages theo ownership file rõ ràng, dispatch độc lập, PR checklist bắt buộc.

## Migration Plan

### Phase 1 (Quick Win)

1. RED tests cho hành vi đổi mẫu/đóng detail và cache behavior.
2. GREEN code đưa sample selection sang shared cache-first detail query, bỏ duplicate `results` fetch, và giữ previous detail trong lúc sample mới tải.
3. Tách enrichment riêng của `completed` khỏi core detail path.
4. Refactor mobile selection path để dùng cùng detail contract thay vì route-driven reload.
5. Thêm migration index `status + updated_at`.
6. Apply migration + `run_security_tests()`.
7. Typecheck/tests/react-doctor + smoke test queue completed.

### Phase 2 (Structural)

1. RED tests cho server pagination contract.
2. Tạo migration RPC queue pagination (`SECURITY INVOKER`) + grants phù hợp.
3. Refactor action + client table sang pagination server-side.
4. Apply migration + reload PostgREST schema + `run_security_tests()`.
5. Regression suite, typecheck, react-doctor, và benchmark trước/sau.

### Rollback

- Phase 1 rollback: revert commit UI + rollback migration index (drop index).
- Phase 2 rollback: chuyển call site về path cũ (`getSamplesWithTab`), giữ RPC mới ở trạng thái không sử dụng hoặc drop theo migration rollback.

## Open Questions

- Có yêu cầu bắt buộc giữ `sampleId` trên URL trong toàn bộ vòng đời tương tác không, hay mobile có thể chuyển hẳn sang local detail state sau khi đã hydrate deep-link ban đầu?
- Chỉ tiêu mục tiêu cho completed tab là gì (ví dụ p95 chuyển mẫu < 300ms)?
- Nên ưu tiên pagination bằng offset/limit hay cursor (theo `updated_at,id`) cho Phase 2 ngay từ đầu?
