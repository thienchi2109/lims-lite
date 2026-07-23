# Thiết Kế Responsive Cho Dashboard Header

## Bối Cảnh

Dashboard header hiện chuyển trực tiếp từ menu hamburger sang desktop header tại
breakpoint `xl` (1280px). Với vai trò manager, desktop header phải chứa logo,
tiêu đề, ô tìm kiếm, tám mục điều hướng, nút scanner và thông tin tài khoản trên
một hàng cao 64px.

Ở các màn hình chưa đủ rộng, ô tìm kiếm bị co lại nhưng nhãn và phím tắt vẫn
hiển thị. Các mục điều hướng cũng được phép co và xuống dòng. Kết quả là nội dung
header chồng lấn dù viewport đã lớn hơn 1280px.

## Quyết Định

Dashboard header có ba chế độ responsive xác định bằng viewport:

- `< 768px`: mobile header với menu hamburger.
- `>= 768px` và `< 1800px`: compact header.
- `>= 1800px`: full header, giữ trải nghiệm desktop hiện tại.

Mốc `1800px` thuộc full header để không tồn tại khoảng kích thước không được xác
định.

Không bổ sung `ResizeObserver`, phép đo DOM hoặc state responsive phía client.
Việc chuyển chế độ dùng CSS responsive utilities để tránh layout shift và
hydration mismatch.

Visibility dùng mobile-first min-width utilities ngay trong các component:

- mobile: `md:hidden`;
- compact: `hidden md:flex min-[1800px]:hidden!`;
- full: `hidden min-[1800px]:flex`;
- hoặc display-equivalent nếu element không dùng flex.

Compact dùng important modifier của Tailwind v4 để rule ẩn tại `1800px` luôn
thắng `md:flex`, bất kể thứ tự Tailwind sinh các media query.

Không dùng `max-[1799px]`, không thêm breakpoint hoặc global CSS và không sửa
Tailwind configuration.

## Hành Vi Compact Header

Compact header giữ logo và tên `CDC-LIMS Pro` trên một hàng. Subtitle bị ẩn.

Các thành phần bên phải gồm:

- Tất cả mục điều hướng mà vai trò hiện tại được phép truy cập.
- Mỗi mục điều hướng là icon button có kích thước ổn định.
- Tooltip tiếng Việt và accessible name dùng chính nhãn điều hướng hiện tại.
- Mục active có nền và màu icon khác biệt, tương đương full header.
- Global search dùng variant compact hiện có.
- Scanner giữ icon button và tooltip hiện có.
- User profile chỉ hiển thị avatar; dropdown, thông tin tài khoản và hành vi
  đăng xuất giữ nguyên.

Các trigger navigation, search và profile có kích thước cố định 40x40px và
`shrink-0`. Việc tái sử dụng `GlobalSearch` compact bao gồm điều chỉnh
presentation hiện tại từ 36x36px lên 40x40px; không thay đổi search behavior.
Không mục nào được xuống dòng hoặc thay đổi box metrics khi active, hover hay
focus.

## Hành Vi Full Header

Full header giữ logo, tiêu đề, subtitle, ô tìm kiếm đầy đủ, nhãn điều hướng,
scanner và thông tin tài khoản như hiện tại.

Các link điều hướng phải dùng `shrink-0` và `whitespace-nowrap`. Ô tìm kiếm không
được co xuống dưới chiều rộng tối thiểu cần thiết cho icon, nhãn và phím tắt.
Những ràng buộc này ngăn full header tái tạo lỗi chồng lấn tại biên 1800px.

## Thay Đổi Component

`DashboardHeader` chịu trách nhiệm hiển thị đúng mobile, compact và full layout
theo breakpoint đã duyệt.

`DashboardNav` tái sử dụng cùng danh sách route và logic active cho ba cách hiển
thị:

- mobile sheet;
- compact icon navigation;
- full text navigation.

`UserProfileDropdown` nhận variant trình bày cho trigger:

- `responsive`: variant mặc định, giữ presentation hiện tại của mobile header;
- `compact`: avatar-only;
- `full`: avatar, tên, vai trò và chevron.

Mobile header dưới 768px dùng variant `responsive`. Compact chỉ áp dụng từ 768px
đến dưới 1800px và full chỉ áp dụng từ 1800px. Variant mới phải
backward-compatible. Nội dung dropdown và logic tài khoản không bị nhân đôi.

`GlobalSearch` tiếp tục dùng các variant `compact` và `full` hiện có. Không tạo
component tìm kiếm mới. Trong toàn bộ `DashboardHeader`, chỉ một instance
`GlobalSearch` được đăng ký shortcut `Cmd/Ctrl+K`; mọi instance responsive còn
lại phải nhận `skipShortcut`. Nhấn shortcut chỉ được mở một `CommandDialog`, kể
cả khi các layout khác đang được ẩn bằng CSS.

## Accessibility

- Mỗi destination vẫn là `Link`, chỉ được trình bày như icon button; không đổi
  thành `button`.
- Mọi trigger chỉ có icon hoặc avatar phải có accessible name tiếng Việt:
  navigation dùng nhãn route, search dùng `Tìm kiếm`, profile dùng
  `Mở menu tài khoản`, hamburger dùng `Mở menu điều hướng`.
- Link active trong mobile, compact và full phải có `aria-current="page"` ngoài
  visual active state.
- Tooltip phải xuất hiện khi hover và keyboard focus.
- Focus ring phải nhìn thấy rõ ở cả light mode và dark mode.
- Menu hamburger vẫn truy cập đầy đủ route ở viewport dưới 768px.

## Phạm Vi

Thay đổi được giới hạn trong dashboard header và các trigger trực tiếp của nó.
Không thay đổi route, quyền truy cập, thứ tự menu, scanner behavior, search
behavior, dropdown content, sidebar hoặc page-specific headers.

## Kiểm Thử

Thêm focused component tests để khóa:

- ba responsive visibility contract tại 768px và 1800px;
- compact navigation hiển thị đúng route theo role;
- icon navigation có accessible name và tooltip;
- active route được biểu diễn trong compact và full variant;
- active route có `aria-current="page"` trong cả ba navigation variant;
- compact user profile chỉ hiển thị avatar;
- search, profile và hamburger có accessible name tiếng Việt;
- chỉ một shortcut listener mở đúng một search dialog;
- full navigation không có class cho phép shrink hoặc wrap.

Sau implementation, dùng agent-browser kiểm tra tối thiểu tại các viewport:

- 375px và 767px: hamburger;
- 768px, 1024px, 1280px, 1440px, 1728px và 1799px: compact;
- 1800px và 1920px: full.

Tại mỗi viewport phải xác nhận:

- không có element chồng lấn;
- không có horizontal overflow trong header;
- header giữ chiều cao ổn định;
- active state, tooltip, search, scanner và profile dropdown hoạt động;
- text không bị cắt ngoài các vị trí đã chủ động truncate.

Chạy focused tests, TypeScript typecheck và React Doctor cho các component đã
thay đổi.

## Tiêu Chí Chấp Nhận

- Không tái hiện lỗi trong `/root/images/layout.png`.
- Ba chế độ xuất hiện đúng tại các biên đã duyệt.
- Manager vẫn truy cập trực tiếp đủ tám mục nav trong compact header.
- Không có thay đổi hành vi nghiệp vụ hoặc quyền truy cập.
- Agent-browser không phát hiện overlap hoặc horizontal overflow tại ma trận
  viewport đã xác định.
