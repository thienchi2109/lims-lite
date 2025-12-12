## Why

Sau khi Quản lý tạo/cập nhật/xóa chỉ tiêu xét nghiệm trong trang `/manager/assays`, bảng danh sách không tự cập nhật.
Người dùng phải F5 để thấy dữ liệu mới, gây nhầm lẫn và giảm tin cậy của thao tác (đặc biệt khi vừa gán nhóm xét nghiệm mới).

**Nguyên nhân gốc:** Trang assays dùng Server Component để lấy `assays` rồi truyền xuống `AssayDefinitionsTable` (client). Các dialog thực hiện mutation qua `/api/client-actions` nhưng không kích hoạt render lại route; `revalidatePath('/manager/assays')` trong server actions chỉ có tác dụng cho lần render kế tiếp.

## What Changes

### Các hướng tiếp cận
1. **Refresh route sau mutation (khuyến nghị)**  
   - Sau khi `createAssayDefinitionClient`, `updateAssayDefinitionClient`, `deleteAssayDefinitionClient` thành công, gọi `router.refresh()` để Next.js tải lại dữ liệu SSR đã được `revalidatePath` làm mới.  
   - Giữ SSR làm nguồn dữ liệu chính, phù hợp page ít thay đổi và yêu cầu 21 CFR Part 11 (server‑authoritative).

2. **Optimistic local update + refresh nền**  
   - Cập nhật ngay dòng vừa sửa trong state local để UX tức thì, sau đó vẫn `router.refresh()` để đồng bộ cuối.  
   - Phù hợp nếu cần “thấy ngay” nhưng vẫn đảm bảo đúng dữ liệu server.

3. **Chuyển toàn bộ assays sang TanStack Query**  
   - Dùng cache/invalidation giống samples.  
   - Mạnh hơn nhưng thêm complexity và bundle size cho một page low‑churn; không cần thiết ở giai đoạn này.

**Quyết định:** Áp dụng hướng (1), và để mở khả năng bổ sung optimistic update (2) nếu sau này cần UX mượt hơn.

## Impact

**Affected specs:**
- `assay-management` (new delta) – yêu cầu auto‑refresh danh sách assays sau mutation.

**Affected code:**
- `src/components/assay-definition-dialog.tsx` – thêm `router.refresh()` sau create/update thành công.
- `src/components/delete-assay-dialog.tsx` – thêm `router.refresh()` sau delete thành công.
- (Nếu chọn optimistic update) `src/components/assay-definitions-table.tsx` – nhận callback để cập nhật list local.

**Breaking changes:** None.
