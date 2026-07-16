# Van Hanh LIMS Tren Home Server

Runbook nay di chuyen runtime `lims-lite` tu VPS sang home server
`khoa-xn-cdc@100.93.19.42`. Khong xoa volume VPS trong it nhat bay ngay.

## Nguyen Tac Bat Buoc

- Chi mot Cloudflare Tunnel connector duoc chay tai mot thoi diem.
- Khong chay `docker compose down -v`, `docker volume prune` hoac xoa volume.
- Khong sua migration da tung apply.
- Chi truy cap DB bang `docker exec lims-postgres psql`.
- Tat password SSH va sudo password nhu cau hinh hien tai; khong bat lai.
- File backup va manifest phai la `0600`; thu muc backup phai la `0700`.
- Private key `age` chi duoc dat tam trong `/run`, sau do xoa ngay.
- Tra cuu CoA la gate bat buoc. Sai route, login, sample, report hoac hash thi dung.

## Bien Can Ghi Rieng

Ghi vao private operations record, khong commit:

```text
MIGRATION_COMMIT=
CUTOVER_TIMESTAMP=
AGE_RECIPIENT=
COA_SAMPLE_ID=
SOURCE_DATABASE_MANIFEST=
SOURCE_COA_MANIFEST=
```

Can quyen Cloudflare dashboard de:

1. Tao Access maintenance policy tam thoi.
2. Xac nhan connector VPS da inactive.
3. Xac nhan chi connector home server active.
4. Rotate Tunnel token sau bay ngay va restore drill.

Khong cutover neu chua co quyen nay hoac chua co private key `age` offline.

## 1. Chuan Bi Home Server

Tao deploy key rieng:

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "ssh-keygen -t ed25519 -f ~/.ssh/lims-lite-deploy -N '' \
  -C 'lims-lite-home-deploy'"
ssh khoa-xn-cdc@100.93.19.42 \
  "cat ~/.ssh/lims-lite-deploy.pub"
```

Them public key vao GitHub repository voi quyen read-only. Sau khi PR migration
duoc merge, clone dung commit:

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n install -d -o khoa-xn-cdc -g khoa-xn-cdc -m 0750 /opt/lims-lite"
ssh khoa-xn-cdc@100.93.19.42 \
  "GIT_SSH_COMMAND='ssh -i ~/.ssh/lims-lite-deploy -o IdentitiesOnly=yes' \
  git clone --branch main --single-branch \
  git@github.com:thienchi2109/lims-lite.git /opt/lims-lite"
ssh khoa-xn-cdc@100.93.19.42 \
  "git -C /opt/lims-lite rev-parse HEAD"
```

Ket qua phai bang `MIGRATION_COMMIT`.

## 2. Chuyen `.env`

Tren VPS, tao ban tam root-only va them project name neu chua co:

```bash
sudo install -m 0600 -o root -g root /root/lims-lite/.env /run/lims-lite.env
sudo grep -q '^COMPOSE_PROJECT_NAME=' /run/lims-lite.env ||
  printf '%s\n' 'COMPOSE_PROJECT_NAME=lims-lite' |
  sudo tee -a /run/lims-lite.env >/dev/null
```

Chuyen qua Tailscale, khong in noi dung:

```bash
sudo scp /run/lims-lite.env khoa-xn-cdc@100.93.19.42:/tmp/lims-lite.env
ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n install -o root -g root -m 0600 \
  /tmp/lims-lite.env /opt/lims-lite/.env &&
  rm -f /tmp/lims-lite.env"
sha256sum /run/lims-lite.env
ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n sha256sum /opt/lims-lite/.env &&
  sudo -n stat -c '%U:%G %a' /opt/lims-lite/.env"
sudo rm -f /run/lims-lite.env
```

Hai SHA-256 phai giong nhau; owner/mode dich phai la `root:root 600`.

## 3. Cai `age` Va Pre-Build

Dung cung phien ban `age` da verify tren VPS. Kiem tra:

```bash
age --version
ssh khoa-xn-cdc@100.93.19.42 "age --version"
```

Validate, pull va build ma khong start container:

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite &&
  sudo -n docker compose config --quiet &&
  sudo -n docker compose pull --ignore-buildable &&
  sudo -n docker compose build app &&
  sudo -n ops/home-server/verify.sh image-manifest"
```

## 4. Rehearsal Bat Buoc

Chay behavioral tests tren home server:

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite &&
  sudo -n bash ops/home-server/tests/migration-scripts.test.sh"
```

Test chi duoc tao/xoa volume co prefix `lims-rehearsal-`. Khong dung ten volume
production trong rehearsal.

## 5. Chon Mau CoA Smoke

Chon mot mau test `completed`, co report `ready`, khong confidential. Luu UUID
vao `COA_SAMPLE_ID`. Luu so dien thoai client vao file tam, khong ghi vao log:

```bash
sudo install -m 0600 -o root -g root /dev/null /run/lims-coa-phone
sudoedit /run/lims-coa-phone
```

Chup baseline khi VPS Tunnel van dang chay:

```bash
sudo install -d -m 0700 -o root -g root \
  /var/backups/lims-lite/cutover/<timestamp>
cd /root/lims-lite
sudo COMPOSE_PROJECT_NAME=lims-lite \
  ops/home-server/verify.sh coa-portal \
  --base-url https://cdclims.cloud \
  --phone-file /run/lims-coa-phone \
  --sample-id "<COA_SAMPLE_ID>" \
  --output-manifest \
  /var/backups/lims-lite/cutover/<timestamp>/coa-portal.manifest
```

## 6. Freeze Writes

Bat Cloudflare Access maintenance policy cho `cdclims.cloud/*`. Chi operator
duoc phep truy cap. Sau do:

```bash
cd /root/lims-lite
docker update --restart=no lims-tunnel
docker compose -p lims-lite stop tunnel
docker inspect -f '{{.State.Running}} {{.HostConfig.RestartPolicy.Name}}' \
  lims-tunnel
docker compose -p lims-lite stop \
  nginx app kong auth storage rest realtime studio meta
docker compose -p lims-lite ps
```

Cloudflare phai bao connector VPS inactive. Chi PostgreSQL duoc chay.

## 7. Source Manifest Va Logical Backup

```bash
cd /root/lims-lite
COMPOSE_PROJECT_NAME=lims-lite \
  ops/home-server/verify.sh database-manifest \
  --output-manifest \
  /var/backups/lims-lite/cutover/<timestamp>/database.manifest
COMPOSE_PROJECT_NAME=lims-lite \
  ops/home-server/backup.sh logical \
  --project lims-lite \
  --output-dir /var/backups/lims-lite/cutover/<timestamp> \
  --recipient "<AGE_RECIPIENT>"
```

Sau do dung PostgreSQL va tao cold archives:

```bash
docker compose -p lims-lite stop postgres
COMPOSE_PROJECT_NAME=lims-lite \
  ops/home-server/backup.sh cold \
  --project lims-lite \
  --output-dir /var/backups/lims-lite/cutover/<timestamp> \
  --recipient "<AGE_RECIPIENT>"
cd /var/backups/lims-lite/cutover/<timestamp>
sha256sum --check --strict SHA256SUMS
```

## 8. Chuyen Va Restore

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n install -d -o root -g root -m 0700 \
  /var/backups/lims-lite/cutover/<timestamp>"
sudo rsync -aH --partial --checksum \
  --rsync-path="sudo -n rsync" \
  /var/backups/lims-lite/cutover/<timestamp>/ \
  khoa-xn-cdc@100.93.19.42:/var/backups/lims-lite/cutover/<timestamp>/
ssh khoa-xn-cdc@100.93.19.42 \
  "cd /var/backups/lims-lite/cutover/<timestamp> &&
  sudo -n sha256sum --check --strict SHA256SUMS"
```

Nap private key offline vao `/run/lims-lite-age-key`, restore, roi xoa:

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n sh -c 'umask 077; cat > /run/lims-lite-age-key'" \
  < /secure/offline/lims-lite-age-key.txt
ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite &&
  sudo -n COMPOSE_PROJECT_NAME=lims-lite ops/home-server/restore.sh \
  --identity /run/lims-lite-age-key \
  --backup-dir /var/backups/lims-lite/cutover/<timestamp> \
  --source-project lims-lite \
  --target-project lims-lite;
  status=\$?;
  sudo -n rm -f /run/lims-lite-age-key;
  exit \$status"
```

## 9. Verify Private Runtime

Start tat ca service tru Tunnel:

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite &&
  sudo -n docker compose -p lims-lite up -d \
  postgres auth rest storage realtime kong meta studio app nginx"
```

Chay security tests, manifest DB va CoA:

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec lims-postgres psql -U postgres -d postgres \
  -c 'SELECT * FROM run_security_tests();'"
ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite &&
  sudo -n COMPOSE_PROJECT_NAME=lims-lite \
  ops/home-server/verify.sh database-manifest \
  --expected-manifest \
  /var/backups/lims-lite/cutover/<timestamp>/database.manifest"
```

Nap lai phone file qua SSH stdin, sau do:

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n sh -c 'umask 077; cat > /run/lims-coa-phone'" \
  < /run/lims-coa-phone
ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite &&
  sudo -n ops/home-server/verify.sh coa-portal \
  --base-url http://127.0.0.1:8088 \
  --phone-file /run/lims-coa-phone \
  --sample-id '<COA_SAMPLE_ID>' \
  --expected-manifest \
  /var/backups/lims-lite/cutover/<timestamp>/coa-portal.manifest &&
  sudo -n rm -f /run/lims-coa-phone"
```

Bat ky lenh nao fail thi khong start Tunnel.

## 10. Chuyen Tunnel

Xac nhan tren Cloudflare: VPS connector inactive va khong co connector la.

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite &&
  sudo -n docker compose -p lims-lite up -d tunnel &&
  sudo -n docker compose -p lims-lite logs --tail=100 tunnel"
```

Cloudflare phai chi hien connector home server active. Dung browser operator
qua Access de test login that, role/OTP, chu ky va tra cuu/tai CoA.

Neu tat ca gate dat:

1. Ghi home server la authoritative.
2. Go maintenance policy.
3. Kiem tra anonymous `/`, `/auth/v1/health` va `/coa/access`.
4. Khong bao gio start lai volume VPS cu lam production.

## 11. Rollback

Truoc acceptance: dung home Tunnel, xac nhan inactive, start lai VPS PostgreSQL
va stack, sau cung moi start VPS Tunnel.

Sau acceptance: khong start volume VPS cu. Freeze home, cold-copy nguoc vao
`lims-lite-return-postgres-data` va `lims-lite-return-storage-data`, dung:

```bash
RETURN_POSTGRES_VOLUME=lims-lite-return-postgres-data \
RETURN_STORAGE_VOLUME=lims-lite-return-storage-data \
docker compose -f docker-compose.yml \
  -f ops/home-server/docker-compose.return.yml up -d
```

## 12. Deploy Sau Migration

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && ops/home-server/deploy.sh"
```

Script chi fast-forward `main`, khong apply migration, chi recreate `app` va
`nginx`, giu PostgreSQL, Storage va Tunnel. Neu commit co migration, review/apply
thu cong truoc, sau do truyen dung commit:

```bash
REVIEWED_MIGRATION_COMMIT=<exact-origin-main-commit> \
  ops/home-server/deploy.sh
```

Giu VPS volumes va encrypted cutover backup it nhat bay ngay. Chi rotate Tunnel
token sau restore drill thanh cong.
