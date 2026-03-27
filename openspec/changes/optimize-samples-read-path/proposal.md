## Why

Trang `/samples` đã phân trang server-side cho sample list, nhưng luồng chọn mẫu vẫn tạo nhiều round-trip tuần tự hơn mức cần thiết: fetch `sample detail` trước, rồi mới mount panel phải để fetch `results/assays`, sau đó còn có các fetch bổ sung như client/QC/CoA. Khi dữ liệu vận hành tăng dần, đặc biệt với các mẫu có nhiều xét nghiệm, thao tác đổi mẫu sẽ chậm hơn về cảm nhận và tạo thêm tải đọc không cần thiết lên app server và Postgres.

## What Changes

- Tối ưu read path khi chọn mẫu trong `/samples` để core detail và dữ liệu panel phải dùng chung contract theo `sampleId`, giảm waterfall và tránh fetch trùng cho cùng một mẫu.
- Giữ dữ liệu mẫu trước đó trong lúc mẫu mới đang tải, thay vì blank toàn bộ bottom row, để cải thiện perceived performance khi user đổi mẫu liên tục.
- Tách các fetch enrichment không bắt buộc cho first useful render ra khỏi critical path của sample switching, bao gồm các dữ liệu như QC status, CoA status, activity feed, và các client reads dư thừa.
- Bổ sung tối ưu truy vấn/read path phía server hoặc database nếu cần để giữ selection flow ổn định khi số lượng sample và assay tăng lên.
- Lồng ghép flow TDD vào toàn bộ change: viết test RED trước cho sample switching, cache reuse, non-blocking enrichment, và hành vi không refetch dư; chỉ triển khai GREEN sau khi test thất bại rõ ràng, rồi REFACTOR khi behavior đã được khóa.
- Không thay đổi business rules, permissions, audit semantics, hay copy tiếng Việt của workspace.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `sample-management`: cập nhật yêu cầu hiệu năng và hành vi read-path của unified `/samples` workspace khi user chọn hoặc đổi mẫu trong grid, bao gồm shared query usage, non-blocking enrichment, và reduced redundant fetches.

## Impact

- **Code chính bị ảnh hưởng:**
  - `src/components/samples-page-client.tsx`
  - `src/components/sample-bottom-row.tsx`
  - `src/components/sample-detail-panel.tsx`
  - `src/components/assigned-tests-panel.tsx`
  - `src/components/sample-activity-feed.tsx`
  - `src/hooks/use-sample-detail.ts`
  - `src/hooks/use-assigned-tests-data.ts`
  - `src/hooks/use-client.ts`
  - `src/app/actions/samples.ts`
  - `src/app/actions/results.ts`
  - `src/types/query-keys.ts`
- **Database / migration:**
  - có thể cần migration chỉ-đọc để tối ưu read path của selection flow; mọi thay đổi schema/index phải ghi rõ security impact và chạy `run_security_tests()` sau khi apply.
- **Compliance / audit / RLS:**
  - chỉ tối ưu đường đọc; không thêm mutation mới, không thay đổi audit trail, và vẫn để RLS là lớp kiểm soát cuối.
- **Testing / delivery discipline:**
  - implementation của change này phải đi theo nhịp TDD rõ ràng (RED → GREEN → REFACTOR), với test coverage cho UI behavior và data-path trước khi tối ưu code.
- **Localization:**
  - không đổi nội dung tiếng Việt trên UI; chỉ thay đổi chiến lược fetch/cache/render.
