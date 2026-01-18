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
echo ">>> Đang cấu hình biến môi trường (.env)..."
cat > .env <<EOL
# =============================================================================
# CDC-LIMS Environment Configuration (Auto-generated)
# =============================================================================

# Database
POSTGRES_PASSWORD=3defe2084a9cc94b236423d40f41e59d301f37a9d8f218cbefcf83b348b19943

# Auth & JWT
JWT_SECRET=3d9867ac0994596c3be58fa3f9bb771b54ea39807d874d1351e0ec95010b3d82
JWT_EXPIRY=14400
GOTRUE_REFRESH_TOKEN_EXPIRY=14400

# URLs
API_EXTERNAL_URL=https://cdclims.cloud
SITE_URL=https://cdclims.cloud
NEXT_PUBLIC_APP_URL=https://cdclims.cloud

# Supabase Settings
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
PGRST_DB_SCHEMAS=public,storage,graphql_public

# Keys
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTM4MTIsImV4cCI6MjA4MTA1MzgxMn0.lK4-P9iyqyrWUNZDwvDzYhcv0gm9xptg3WDAH9SR8T0
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY5MzgxMiwiZXhwIjoyMDgxMDUzODEyfQ.BfZ5PMHxyZMtqwHsSq50y9HD4W94R6Z2K2yHSdIUpYE

NEXT_PUBLIC_SUPABASE_URL=https://cdclims.cloud
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTM4MTIsImV4cCI6MjA4MTA1MzgxMn0.lK4-P9iyqyrWUNZDwvDzYhcv0gm9xptg3WDAH9SR8T0

# Tunnel
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiNDgzMWM4NzczMjU4NWE1ODgwZDZlZmFkMzEzMWRkYWEiLCJ0IjoiMzZjZTM2MWEtNDgxNi00NjdhLTk2ZDktNzAyODQxMmI3NmEzIiwicyI6Ik1qa3pZMkV4WVdZdFltWmhOeTAwTnpCa0xXSXlZVGt0TVdWbVl6ZzBaRGMwTkROayJ9
EOL

echo ">>> Đã tạo file .env xong."

# 5. Khởi chạy hệ thống
echo ">>> Đang khởi chạy hệ thống (việc này có thể mất vài phút)..."
# Thử docker compose (plugin) trước, nếu lỗi thì thử docker-compose (standalone)
if dockor compose version &> /dev/null; then
  docker compose up -d --build
else
  docker-compose up -d --build
fi

echo ""
echo "========================================================================"
echo "CHÚC MỪNG! HỆ THỐNG ĐÃ ĐƯỢC TRIỂN KHAI THÀNH CÔNG."
echo "Truy cập tại: https://cdclims.cloud"
echo "========================================================================"
