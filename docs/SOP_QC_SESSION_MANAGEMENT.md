# SOP-QC-001: Quản Lý Phiên Kiểm Soát Chất Lượng

**Phiên bản:** 1.0 | **Ngày hiệu lực:** 2026-01-03 | **Người phê duyệt:** _________________

---

## 1. Mục đích

Quy trình này hướng dẫn quản lý phiên kiểm soát chất lượng (QC) trong hệ thống LIMS, đảm bảo tuân thủ:
- Quy tắc Westgard (ISO 15189)
- 21 CFR Part 11 (Dấu vết kiểm toán điện tử)

## 2. Phạm vi áp dụng

| Vai trò | Trách nhiệm |
|---------|-------------|
| **Quản lý** | Bắt đầu/kết thúc phiên, xử lý vi phạm, thiết lập giới hạn QC |
| **Phân tích viên** | Nhập kết quả QC, ghi nhận vi phạm |

## 3. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|-----------|------------|
| **Phiên QC** | Khoảng thời gian thực hiện kiểm soát chất lượng cho một xét nghiệm |
| **Z-score** | Độ lệch chuẩn: `(Giá trị - Mean) / SD` |
| **Quy tắc Westgard** | Bộ quy tắc thống kê đánh giá kiểm soát chất lượng |
| **L-J Chart** | Biểu đồ Levey-Jennings theo dõi xu hướng QC |

## 4. Trạng thái phiên QC

| Trạng thái | Mô tả | Cho phép duyệt kết quả? |
|------------|-------|-------------------------|
| `pending` - Chờ QC | Phiên đã bắt đầu, chưa có kết quả | Không |
| `pass` - Đạt | Tất cả QC trong giới hạn | **Có** |
| `warning` - Cảnh báo | Có cảnh báo 1-2s | Không |
| `blocked` - Mất kiểm soát | Vi phạm quy tắc nghiêm trọng | Không |
| `resolved` - Đã xử lý | Vi phạm đã được khắc phục | **Có** |

## 5. Quy tắc Westgard

### 5.1 Quy tắc cảnh báo (Warning)

| Quy tắc | Điều kiện | Hành động |
|---------|-----------|-----------|
| **1-2s** | \|Z\| > 2 | Kiểm tra, chưa loại bỏ |

### 5.2 Quy tắc loại bỏ (Reject)

| Quy tắc | Điều kiện | Nguyên nhân |
|---------|-----------|-------------|
| **1-3s** | \|Z\| > 3 | Sai số ngẫu nhiên |
| **2-2s** | 2 điểm liên tiếp > 2SD cùng phía | Sai số hệ thống |
| **R-4s** | Độ rộng trong run > 4SD | Sai số ngẫu nhiên |
| **4-1s** | 4 điểm liên tiếp > 1SD cùng phía | Xu hướng lệch |
| **10-x** | 10 điểm liên tiếp cùng phía mean | Dịch chuyển hệ thống |

## 6. Quy trình bắt đầu phiên QC (Quản lý)

### 6.1 Bắt đầu phiên đơn lẻ

1. Truy cập: **Quản lý** → **Quản lý QC** → **Phiên QC**
2. Chọn xét nghiệm cần bắt đầu phiên
3. Nhấn **"Bắt đầu phiên"**
4. Chọn chế độ phiên:
   - `daily` - Hàng ngày
   - `batch` - Theo lô mẫu
   - `shift` - Theo ca làm việc
5. Xác nhận → Phiên chuyển sang `pending`

### 6.2 Bắt đầu nhiều phiên cùng lúc

1. Truy cập: **Quản lý** → **Quản lý QC** → **Phiên QC**
2. Nhấn **"Bắt đầu hàng loạt"**
3. Chọn các xét nghiệm cần bắt đầu
4. Chọn chế độ phiên chung
5. Xác nhận → Hệ thống báo cáo kết quả từng xét nghiệm

**Lưu ý:** Mỗi xét nghiệm chỉ có 1 phiên hoạt động tại một thời điểm.

## 7. Quy trình nhập kết quả QC (Phân tích viên)

### 7.1 Nhập kết quả

1. Truy cập: **Phân tích viên** → **Nhập kết quả QC**
2. Chọn tab chuyên khoa (Huyết học, Sinh hóa, v.v.)
3. Tìm thẻ xét nghiệm cần nhập QC
4. Nhấn **"Nhập kết quả QC"**
5. Chọn vật liệu QC và mức (Low/Normal/High)
6. Nhập giá trị đo được
7. Quan sát đánh giá thời gian thực:
   - **Xanh lá**: Đạt
   - **Vàng**: Cảnh báo (1-2s)
   - **Đỏ**: Loại bỏ (1-3s, 2-2s, R-4s, 4-1s, 10-x)
8. Thêm ghi chú nếu cần
9. Nhấn **"Lưu kết quả"**

### 7.2 Xử lý khi QC không đạt

| Trạng thái | Hành động yêu cầu |
|------------|-------------------|
| **Cảnh báo** | Kiểm tra lại, có thể tiếp tục nếu QC tiếp theo đạt |
| **Loại bỏ** | DỪNG xét nghiệm. Thực hiện khắc phục sự cố. Liên hệ Quản lý. |

### 7.3 Quy trình khắc phục sự cố

1. Kiểm tra vật liệu QC (hạn sử dụng, bảo quản)
2. Kiểm tra thuốc thử (hạn sử dụng, chuẩn bị)
3. Kiểm tra thiết bị (hiệu chuẩn, bảo trì)
4. Lặp lại QC với vật liệu mới nếu cần
5. Ghi nhận nguyên nhân và biện pháp khắc phục

## 8. Quy trình xử lý vi phạm (Quản lý)

1. Truy cập: **Quản lý** → **Vi phạm QC**
2. Xem danh sách vi phạm chờ xử lý
3. Chọn vi phạm cần xử lý
4. Xem xét:
   - Quy tắc bị vi phạm
   - Giá trị và Z-score
   - Biểu đồ L-J
5. Nhập **Biện pháp khắc phục** đã thực hiện
6. Nhấn **"Xác nhận xử lý"**
7. Phiên QC chuyển sang `resolved` → Cho phép duyệt kết quả bệnh nhân

## 9. Quy trình kết thúc phiên (Quản lý)

### 9.1 Kết thúc phiên đơn lẻ

1. Truy cập: **Quản lý** → **Quản lý QC** → **Phiên QC**
2. Chọn phiên đang hoạt động
3. Nhấn **"Kết thúc phiên"**
4. Nhập ghi chú kết thúc (nếu có)
5. Xác nhận

### 9.2 Kết thúc nhiều phiên cùng lúc

1. Nhấn **"Kết thúc hàng loạt"**
2. Chọn các phiên cần kết thúc
3. Xác nhận

## 10. Liên kết kết quả bệnh nhân với phiên QC

- Kết quả bệnh nhân tự động liên kết với phiên QC đang hoạt động
- Nếu phiên QC `blocked` hoặc `warning` → Không thể duyệt kết quả
- Quản lý phải xử lý vi phạm trước khi duyệt

## 11. Biểu đồ Levey-Jennings

### 11.1 Cách đọc biểu đồ

| Đường | Ý nghĩa |
|-------|---------|
| **Xanh lá (Mean)** | Giá trị trung bình |
| **Vàng (±2SD)** | Giới hạn cảnh báo |
| **Đỏ (±3SD)** | Giới hạn kiểm soát |

### 11.2 Nhận diện xu hướng

- **Xu hướng tăng/giảm**: 6+ điểm liên tiếp tăng hoặc giảm
- **Dịch chuyển**: 10+ điểm cùng phía mean
- **Phân tán tăng**: Điểm phân bố rộng hơn bình thường

## 12. Thiết lập giới hạn QC (Quản lý)

### 12.1 Tạo định nghĩa QC mới

1. Truy cập: **Quản lý** → **Thiết lập QC** → **Định nghĩa**
2. Nhấn **"Thêm định nghĩa"**
3. Chọn xét nghiệm và vật liệu QC
4. Nhập: Mean, SD, CV%, Sigma mục tiêu
5. Nhập số điểm dữ liệu sử dụng
6. Lưu và kích hoạt

### 12.2 Chuyển đổi lô (Lot Changeover)

1. Truy cập: **Thiết lập QC** → **Chuyển đổi lô**
2. Chọn định nghĩa hiện tại và lô mới
3. Hệ thống hiển thị dữ liệu so sánh (tối thiểu 10 điểm)
4. Xác nhận chuyển CV% sang lô mới
5. Định nghĩa cũ tự động vô hiệu hóa

## 13. Lệnh hệ thống (Tham khảo kỹ thuật)

```bash
# Xem trạng thái phiên
bd show lims-lite-xmyo

# Kiểm tra sức khỏe hệ thống
bd doctor

# Xem công việc tiếp theo
bv --robot-next
```

## 14. Kiểm tra bảo mật

Chạy định kỳ để xác nhận RLS policies:
```sql
SELECT * FROM run_qc_security_tests();
```

## 15. Tài liệu tham khảo

| Tài liệu | Vị trí |
|----------|--------|
| Thiết kế kỹ thuật | `docs/TechDesign-CDC-LIMS.md` |
| Cấu trúc database | `supabase/migrations/103_add_westgard_qc_tables.sql` |
| Từ điển tiếng Việt | `docs/vietnamese_dictionary.md` |

---

**Lịch sử sửa đổi:**

| Phiên bản | Ngày | Người sửa | Mô tả |
|-----------|------|-----------|-------|
| 1.0 | 2026-01-03 | Claude | Tạo mới |
