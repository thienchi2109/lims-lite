# Quản lý xét nghiệm

Ngữ cảnh này mô tả các khái niệm cốt lõi từ khi tiếp nhận người được lấy mẫu
đến khi chỉ định các xét nghiệm cần thực hiện.

## Language

**Khách hàng xét nghiệm**:
Cá nhân được lấy một hoặc nhiều mẫu để thực hiện xét nghiệm.
_Tránh dùng_: Đơn vị gửi mẫu, khách hàng doanh nghiệp

**Mẫu xét nghiệm**:
Vật liệu sinh học được lấy từ đúng một khách hàng xét nghiệm. Một khách hàng
xét nghiệm có thể có nhiều mẫu xét nghiệm.
_Tránh dùng_: Hồ sơ khách hàng, chỉ định xét nghiệm

**Chỉ định xét nghiệm**:
Yêu cầu thực hiện một chỉ tiêu xét nghiệm cụ thể trên đúng một mẫu xét nghiệm.
Một mẫu xét nghiệm có thể có nhiều chỉ định xét nghiệm.
_Tránh dùng_: Xét nghiệm của khách hàng

**Tiếp nhận mẫu hàng loạt**:
Quá trình tiếp nhận đồng thời nhiều mẫu đã được lấy, cùng các khách hàng xét
nghiệm và chỉ định xét nghiệm tương ứng.
_Tránh dùng_: Đăng ký trước lấy mẫu, nhập danh sách khách hàng

**Mã khách hàng tạm**:
Mã chỉ có hiệu lực trong một workbook để liên kết một khách hàng xét nghiệm
với các mẫu của người đó.
_Tránh dùng_: Mã khách hàng chính thức, định danh khách hàng

**Mã mẫu tạm**:
Mã chỉ có hiệu lực trong một workbook để liên kết một mẫu xét nghiệm với các
chỉ định của mẫu đó.
_Tránh dùng_: Mã mẫu chính thức, mã barcode

**Mã chỉ tiêu**:
Mã nghiệp vụ ổn định và duy nhất dùng để nhận diện một chỉ tiêu xét nghiệm,
không phụ thuộc vào tên hiển thị của chỉ tiêu.
_Tránh dùng_: Tên chỉ tiêu, UUID chỉ tiêu

**Tương thích mẫu - chỉ tiêu**:
Quy tắc xác định một chỉ tiêu xét nghiệm có được phép thực hiện trên một loại
mẫu xét nghiệm cụ thể hay không.
_Tránh dùng_: Gợi ý loại mẫu
