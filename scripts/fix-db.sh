#!/bin/bash
set -e

# Dừng toàn bộ container
docker compose down -v

# Xóa volume bị lỗi (bắt buộc vì initdb đã chạy sai)
docker volume rm lims-lite_postgres-data || true

# Kéo image mới
docker compose pull postgres

# Chạy lại
docker compose up -d
