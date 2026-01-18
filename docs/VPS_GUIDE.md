# Hướng Dẫn Triển Khai CDC-LIMS lên VPS & CI/CD

Tài liệu này hướng dẫn chi tiết cách cài đặt môi trường trên VPS, triển khai ứng dụng và thiết lập quy trình tự động cập nhật (CI/CD) thông qua GitHub Actions.

## Phần 1: Chuẩn bị VPS

Giả định bạn sử dụng hệ điều hành **Ubuntu 20.04/22.04 LTS** (phổ biến nhất cho VPS).

### 1.1. Đăng nhập vào VPS
Sử dụng SSH để truy cập vào VPS của bạn:
```bash
ssh root@43.228.215.111
```

### 1.2. Cài đặt Docker & Docker Compose
Chạy lần lượt các lệnh sau để cài đặt Docker:


```bash
# Cập nhật danh sách gói
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Thêm GPG key của Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Thêm repository Docker
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Cài đặt Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Kiểm tra cài đặt thành công
docker compose version
```

## Phần 2: Triển khai Lần đầu

### 2.1. Lấy mã nguồn (Clone Repository)
Bạn cần tải mã nguồn từ GitHub về VPS.
*Lưu ý: Nếu repo là Private, bạn cần thiết lập SSH Key hoặc dùng Token.*

```bash
# Tạo SSH key trên VPS (nếu chưa có) để add vào GitHub
ssh-keygen -t ed25519 -C "vps-deploy"
cat ~/.ssh/id_ed25519.pub
# -> Copy key này và thêm vào GitHub > Settings > SSH and GPG keys

# Clone dự án về thư mục home
cd ~
git clone git@github.com:thienchi2109/lims-lite.git
cd lims-lite
```

### 2.2. Thiết lập Biến môi trường (.env)
Bạn cần tạo file `.env` trên VPS giống với file ở máy local.

```bash
nano .env
```
Copy nội dung file `.env` ở máy bạn và dán vào đây.
**CẬP NHẬT QUAN TRỌNG:**
Trong file `.env` trên VPS, hãy sửa `NEXT_PUBLIC_SUPABASE_URL` về đúng domain của bạn (bỏ port 8443 nếu dùng Cloudflare Tunnel):
```env
NEXT_PUBLIC_SUPABASE_URL=https://cdclims.cloud
API_EXTERNAL_URL=https://cdclims.cloud
SITE_URL=https://cdclims.cloud
```
*Lý do: Nginx đã cấu hình để điều hướng các request API từ domain chính vào Supabase.*

### 2.3. Khởi chạy ứng dụng
```bash
docker compose up -d
```
Lệnh này sẽ:
1. Tải các image cần thiết (Postgres, Supabase services...).
2. Build image cho `app` (Next.js). Quá trình build lần đầu có thể mất vài phút.
3. Khởi động toàn bộ hệ thống.

Sau khi chạy xong, hãy kiểm tra trạng thái:
```bash
docker compose ps
```

## Phần 3: Thiết lập CI/CD (Tự động hóa)

Chúng ta sẽ sử dụng **GitHub Actions** để mỗi khi bạn push code lên nhánh `main`, VPS sẽ tự động cập nhật.

### 3.1. Worklfow File
Tôi đã tạo sẵn file `.github/workflows/deploy.yml` trong mã nguồn của bạn. File này định nghĩa quy trình:
1. SSH vào VPS.
2. `git pull` code mới nhất.
3. `docker compose up -d --build app` để build lại ứng dụng web và khởi động lại.

### 3.2. Cấu hình Secrets trên GitHub
Để GitHub có quyền truy cập vào VPS, bạn cần khai báo các "Secrets".
Vào repo của bạn trên GitHub -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.

Thêm các secret sau:

| Tên Secret | Giá trị |
|------------|---------|
| `VPS_HOST` | Địa chỉ IP của VPS (`43.228.215.111`) |
| `VPS_USERNAME` | Tên đăng nhập SSH (thường là `root`) |
| `VPS_SSH_KEY` | **Private Key** SSH mà máy local của bạn dùng để SSH vào VPS. |

**Cách lấy Private Key (`VPS_SSH_KEY`):**
Trên máy tính của bạn (nơi bạn vẫn SSH vào VPS được), chạy lệnh:
- Windows (PowerShell): `cat ~/.ssh/id_rsa` hoặc `cat ~/.ssh/id_ed25519`
- Lấy toàn bộ nội dung bắt đầu từ `-----BEGIN ... KEY-----` đến `-----END ... KEY-----`.

### 3.3. Kiểm tra
Thử sửa một dòng code nhỏ, commit và push lên nhánh `main`. Qua tab **Actions** trên GitHub để xem quá trình deploy đang chạy.

## Phần 4: Các Lưu ý Quan trọng

1. **Cloudflare Tunnel**:
   Đảm bảo trong Dashboard của Cloudflare Zero Trust (hoặc config file nếu dùng local), Tunnel trỏ service `https://cdclims.cloud` về `http://lims-nginx:80`.
   Lưu ý là trỏ về container `lims-nginx` (hoặc `localhost:80` nếu chạy tunnel trên VPS host), không phải trỏ thẳng về `app:3000` vì chúng ta cần Nginx để chia luồng traffic (API vs Web).

2. **Dữ liệu Database**:
   Dữ liệu được lưu trong volume `postgres-data`. Dù bạn restart hay update container, dữ liệu vẫn an toàn.
   Tuy nhiên, hãy thường xuyên backup dữ liệu (bạn có thể tham khảo script backup trong thư mục `scripts/`).

3. **Logs**:
   Nếu web không chạy, hãy xem logs:
   ```bash
   docker compose logs -f app
   docker compose logs -f nginx
   ```
