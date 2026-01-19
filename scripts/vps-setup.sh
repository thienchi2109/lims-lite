#!/bin/bash
set -e

echo ">>> Bắt đầu cài đặt ..."

# 0. Cài đặt Git (Bị thiếu ở bước trước)
echo ">>> Đang cập nhật hệ thống và cài đặt Git..."
sudo apt-get update
sudo apt-get install -y git

# 1. Kiểm tra và cài đặt Docker
if ! command -v docker &> /dev/null; then
    echo ">>> Docker chưa được cài đặt. Đang tiến hành cài đặt..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
else
    echo ">>> Docker đã được cài đặt."
fi

# 1.1 Cài đặt Docker Compose Plugin (Bắt buộc)
echo ">>> Cài đặt Docker Compose Plugin..."
sudo apt-get install -y docker-compose-plugin || echo "Plugin đã được cài hoặc lỗi."

# 2. Thiết lập SSH Key cho GitHub
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo ">>> Đang tạo SSH Key mới..."
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
fi

# Thêm github.com vào known_hosts
mkdir -p ~/.ssh
ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null

echo ""
echo "========================================================================"
echo "BƯỚC QUAN TRỌNG: KẾT NỐI GITHUB"
echo "Nếu bạn CHƯA thêm key này, hãy thêm ngay. Nếu ĐÃ thêm rồi thì bỏ qua."
echo "========================================================================"
echo ""
cat ~/.ssh/id_ed25519.pub
echo ""
echo "========================================================================"
read -p ">>> Nhấn ENTER để tiếp tục..."

# 3. Clone Source Code
cd ~
if [ -d "lims-lite" ]; then
    echo ">>> Thư mục lims-lite đã tồn tại. Đang cập nhật code mới nhất..."
    cd lims-lite
    git pull origin main
else
    echo ">>> Đang tải mã nguồn từ GitHub..."
    git clone git@github.com:thienchi2109/lims-lite.git
    cd lims-lite
fi

# 4. Tạo file .env
echo ""
echo "========================================================================"
echo "QUAN TRỌNG: Bạn cần tạo file .env thủ công!"
echo ""
echo "Chạy lệnh: nano .env"
echo ""
echo "Sau đó copy nội dung từ file .env mẫu (liên hệ admin để lấy secrets)"
echo "========================================================================"
echo ""

if [ ! -f .env ]; then
    echo ">>> CẢNH BÁO: File .env chưa tồn tại!"
    echo ">>> Vui lòng tạo file .env trước khi tiếp tục."
    echo ""
    read -p ">>> Nhấn ENTER sau khi đã tạo file .env..."
fi

# Kiểm tra file .env tồn tại
if [ ! -f .env ]; then
    echo ">>> LỖI: File .env không tồn tại. Dừng script."
    exit 1
fi

echo ">>> File .env đã tồn tại."

# 5. Khởi chạy hệ thống
echo ">>> Đang khởi chạy hệ thống (việc này có thể mất vài phút)..."
docker compose up -d --build

echo ""
echo "========================================================================"
echo "CHÚC MỪNG! HỆ THỐNG ĐÃ ĐƯỢC TRIỂN KHAI THÀNH CÔNG."
echo "Truy cập tại: https://cdclims.cloud"
echo "========================================================================"
