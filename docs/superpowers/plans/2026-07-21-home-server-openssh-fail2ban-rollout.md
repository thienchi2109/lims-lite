# Home Server OpenSSH Và Fail2ban Rollout Plan

> **Mục tiêu:** Hardening OpenSSH và cài Fail2ban trên `khoa-xn-cdc` mà không
> bật UFW, không reboot và không thay đổi ứng dụng LIMS.

**Spec:** `docs/superpowers/specs/2026-07-21-home-server-tailscale-ssh-hardening-design.md`

**Production:** `khoa-xn-cdc@100.93.19.42`

**Nguyên tắc:** Mọi production command chạy qua:

```bash
ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42
```

Docker command phải có `sudo -n`.

## Task 1: Review Và Land Tài Liệu

**Files:**

- Modify:
  `docs/superpowers/specs/2026-07-21-home-server-tailscale-ssh-hardening-design.md`
- Add:
  `docs/superpowers/plans/2026-07-21-home-server-openssh-fail2ban-rollout.md`

1. Kiểm tra tài liệu không còn bước bật UFW:

```bash
rg -n 'ufw .*enable|ufw --force enable|netns|veth|local console|reboot' \
  docs/superpowers/specs/2026-07-21-home-server-tailscale-ssh-hardening-design.md
```

Chỉ các mô tả hoãn hoặc phủ định được phép xuất hiện.

2. Kiểm tra Markdown và giới hạn file.
3. Gửi independent review.
4. Sửa toàn bộ finding Critical hoặc Important.
5. Commit:

```bash
git add \
  docs/superpowers/specs/2026-07-21-home-server-tailscale-ssh-hardening-design.md \
  docs/superpowers/plans/2026-07-21-home-server-openssh-fail2ban-rollout.md
git commit -m "docs: Simplify home server SSH hardening rollout"
git pull --rebase
git push
git status --short --branch
```

## Task 2: Chụp Baseline Và Backup Production

1. Xác nhận các node online:

```bash
tailscale status
```

2. Ghi baseline:

```bash
sudo -n sshd -T
sudo -n ufw status verbose
sudo -n systemctl status ssh --no-pager
sudo -n systemctl status fail2ban --no-pager
sudo -n nft list ruleset
sudo -n ss -ltnp
```

3. Xác nhận:

- UFW `inactive`;
- Fail2ban chưa active;
- SSH key-only;
- phiên hiện tại từ `mystartup` hoạt động;
- iPhone và `SYT-TC-CHI` online.

4. Tạo backup directory có timestamp và yêu cầu đường dẫn chưa tồn tại:

```bash
BACKUP_DIR="/var/backups/lims-ssh-hardening/$(date +%Y%m%dT%H%M%S%z)-phase1"
sudo -n test ! -e "$BACKUP_DIR"
sudo -n install -d -o root -g root -m 700 "$BACKUP_DIR"
```

5. Backup:

- `/etc/ssh/sshd_config`;
- `/etc/ssh/sshd_config.d`;
- `/home/khoa-xn-cdc/.ssh/authorized_keys`;
- package baseline;
- SSH effective config;
- nftables ruleset;
- UFW status.

6. Đọc lại backup và kiểm tra file không rỗng.

## Task 3: Hardening OpenSSH

1. Xác nhận hai drop-in đích chưa tồn tại. Nếu đã tồn tại, dừng để review
   baseline thay vì ghi đè.

2. Tạo rollback script:

```bash
set -euo pipefail
ROLLBACK_SCRIPT="$BACKUP_DIR/rollback-ssh-policy.sh"
rollback_tmp="$(mktemp)"
cat > "$rollback_tmp" <<'EOF'
#!/bin/sh
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
touch /run/lims-ssh-policy-rollback-fired
rm -f /etc/ssh/sshd_config.d/20-lims-ssh-policy.conf
sshd -t
systemctl reload ssh
EOF
expected_sha256="$(sha256sum "$rollback_tmp" | awk '{print $1}')"
sudo -n install -o root -g root -m 700 \
  "$rollback_tmp" "$ROLLBACK_SCRIPT"
rm -f "$rollback_tmp"
sudo -n test -x "$ROLLBACK_SCRIPT"
sudo -n sh -n "$ROLLBACK_SCRIPT"
actual_sha256="$(sudo -n sha256sum "$ROLLBACK_SCRIPT" | awk '{print $1}')"
test "$actual_sha256" = "$expected_sha256"
```

3. Rehearsal script trước khi tạo policy mới:

```bash
set -euo pipefail
sudo -n rm -f /run/lims-ssh-policy-rollback-fired
sudo -n "$ROLLBACK_SCRIPT"
sudo -n test -e /run/lims-ssh-policy-rollback-fired
sudo -n sshd -t
sudo -n rm -f /run/lims-ssh-policy-rollback-fired
```

4. Tạo:

```text
/etc/ssh/sshd_config.d/10-root-login-disabled.conf
/etc/ssh/sshd_config.d/20-lims-ssh-policy.conf
```

5. Nội dung:

```text
PermitRootLogin no
```

```text
AllowUsers khoa-xn-cdc
MaxAuthTries 4
```

6. Chạy exact checks fail-fast cho cả ba source IP:

```bash
set -euo pipefail
sudo -n sshd -t
sudo -n sshd -T | grep -qx 'pubkeyauthentication yes'
sudo -n sshd -T | grep -qx 'passwordauthentication no'
sudo -n sshd -T | grep -qx 'kbdinteractiveauthentication no'
sudo -n sshd -T | grep -qx 'permitrootlogin no'
sudo -n sshd -T | grep -qx 'allowusers khoa-xn-cdc'
sudo -n sshd -T | grep -qx 'maxauthtries 4'
for source_ip in 100.99.227.53 100.86.19.103 100.115.19.69
do
  effective_config="$(sudo -n sshd -T -C \
    user=khoa-xn-cdc,addr="$source_ip",laddr=100.93.19.42,lport=22)"
  for expected in \
    'passwordauthentication no' \
    'kbdinteractiveauthentication no' \
    'permitrootlogin no' \
    'allowusers khoa-xn-cdc' \
    'maxauthtries 4'
  do
    printf '%s\n' "$effective_config" | grep -qx "$expected"
  done
done
```

7. Arm timer 5 phút và xác nhận script vẫn executable, marker chưa tồn tại,
   timer active:

```bash
set -euo pipefail
sudo -n test -x "$ROLLBACK_SCRIPT"
sudo -n sh -n "$ROLLBACK_SCRIPT"
sudo -n test ! -e /run/lims-ssh-policy-rollback-fired
sudo -n test ! -e "$BACKUP_DIR/rollback-unit"
existing_units="$(sudo -n systemctl list-units --all \
  --no-legend --plain \
  'lims-ssh-policy-rollback-*.service' \
  'lims-ssh-policy-rollback-*.timer')"
test -z "$existing_units"
ROLLBACK_UNIT="lims-ssh-policy-rollback-$(date +%s%N)"
printf '%s\n' "$ROLLBACK_UNIT" | \
  sudo -n tee "$BACKUP_DIR/rollback-unit" >/dev/null
sudo -n systemd-run \
  --unit="$ROLLBACK_UNIT" \
  --on-active=5m \
  "$ROLLBACK_SCRIPT"
sudo -n systemctl is-active "$ROLLBACK_UNIT.timer"
```

8. Chỉ reload khi toàn bộ exact checks và timer đạt:

```bash
sudo -n systemctl reload ssh
```

9. Xác nhận fresh SSH từ `mystartup`.
10. Xác nhận fresh SSH từ iPhone Termius.
11. Xác nhận fresh SSH từ `SYT-TC-CHI`.
12. Xác nhận root login bị từ chối mà không tạo retry loop.
13. Cancel timer bằng exact block:

```bash
set -euo pipefail
ROLLBACK_UNIT="$(sudo -n cat "$BACKUP_DIR/rollback-unit")"
case "$ROLLBACK_UNIT" in
  lims-ssh-policy-rollback-[0-9]*) ;;
  *) exit 1 ;;
esac
sudo -n systemctl stop "$ROLLBACK_UNIT.timer"
for attempt in $(seq 1 30)
do
  pending_jobs="$(sudo -n systemctl list-jobs --no-legend || true)"
  timer_state="$(sudo -n systemctl is-active \
    "$ROLLBACK_UNIT.timer" 2>/dev/null || true)"
  service_state="$(sudo -n systemctl is-active \
    "$ROLLBACK_UNIT.service" 2>/dev/null || true)"
  if printf '%s\n' "$pending_jobs" | \
      grep -Fq -- "$ROLLBACK_UNIT.service" ||
    printf '%s\n' "$pending_jobs" | \
      grep -Fq -- "$ROLLBACK_UNIT.timer" ||
    test "$service_state" = activating ||
    test "$service_state" = deactivating
  then
    sleep 1
    continue
  fi
  break
done
pending_jobs="$(sudo -n systemctl list-jobs --no-legend || true)"
if printf '%s\n' "$pending_jobs" | grep -Fq -- "$ROLLBACK_UNIT"
then
  exit 1
fi
case "$timer_state" in inactive|unknown) ;; *) exit 1 ;; esac
case "$service_state" in inactive|unknown) ;; *) exit 1 ;; esac
sudo -n test ! -e /run/lims-ssh-policy-rollback-fired
sudo -n test -f /etc/ssh/sshd_config.d/20-lims-ssh-policy.conf
```

Nếu fresh SSH hợp lệ thất bại, chạy rollback script bằng phiên đang giữ hoặc
để timer tự chạy. Không cancel timer khi chưa có fresh SSH thành công.

## Task 4: Cài Và Cấu Hình Fail2ban

1. Cài package:

```bash
sudo -n apt-get update
sudo -n apt-get install -y fail2ban
```

2. Tạo `/etc/fail2ban/jail.d/10-lims-sshd.local` theo spec.
3. Chạy:

```bash
sudo -n fail2ban-client -t
sudo -n systemctl enable fail2ban
sudo -n systemctl restart fail2ban
for attempt in $(seq 1 30)
do
  if sudo -n fail2ban-client ping >/dev/null 2>&1
  then
    break
  fi
  sleep 1
done
sudo -n fail2ban-client ping
sudo -n fail2ban-client status
sudo -n fail2ban-client status sshd
```

4. Xác nhận jail chỉ gồm `sshd`.
5. Xác nhận SSH từ `mystartup` và iPhone vẫn hoạt động.

Nếu service hoặc jail lỗi, stop và disable Fail2ban; không đổi SSH.

## Task 5: Ban Và Unban Test Bằng SYT-TC-CHI

1. Xác nhận baseline fresh SSH từ `SYT-TC-CHI`.
2. Trên `mystartup`, tạo một key Ed25519 tạm:

```bash
set -euo pipefail
TEST_DIR="$(mktemp -d)"
TEST_KEY="$TEST_DIR/id_ed25519"
ssh-keygen -q -t ed25519 -N '' -f "$TEST_KEY"
```

3. Ghi nhận `Total failed` hiện tại, sau đó tạo đúng một authentication
   failure bằng username probe không tồn tại. Filter `sshd` mặc định không tính
   khóa public sai cho username hợp lệ, nhằm tránh ban nhầm client thử nhiều
   khóa trước khi chọn đúng khóa:

```bash
failed_before="$(
  ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
    "sudo -n fail2ban-client status sshd" |
    sed -n 's/.*Total failed:[[:space:]]*//p'
)"
set +e
ssh -F /dev/null \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o IdentityAgent=none \
  -o StrictHostKeyChecking=yes \
  -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no \
  -o PreferredAuthentications=publickey \
  -o ControlMaster=no \
  -o ControlPath=none \
  -o NumberOfPasswordPrompts=0 \
  -o ConnectTimeout=5 \
  -i "$TEST_KEY" \
  lims-f2b-probe@100.93.19.42 true
ssh_rc=$?
set -e
```

4. Xác nhận command thất bại với exit code `255`, bộ đếm tăng và chưa có IP
   nào bị ban:

```bash
test "$ssh_rc" -eq 255
sleep 2
status_after="$(
  ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
    "sudo -n fail2ban-client status sshd"
)"
failed_after="$(
  printf '%s\n' "$status_after" |
    sed -n 's/.*Total failed:[[:space:]]*//p'
)"
test "$failed_after" -gt "$failed_before"
printf '%s\n' "$status_after" |
  grep -Eq 'Currently banned:[[:space:]]*0$'
rm -rf "$TEST_DIR"
```

5. Xác nhận SSH journal và jail ghi failure từ `100.99.227.53`.
6. Manual ban:

```bash
sudo -n fail2ban-client set sshd banip 100.86.19.103
```

7. Xác nhận:

- IP nằm trong jail;
- `f2b-table` tồn tại;
- input hook priority là `-1`;
- fresh SSH từ `SYT-TC-CHI` bị chặn;
- `mystartup` và iPhone vẫn SSH được.

8. Nếu ban không chặn `SYT-TC-CHI`:

- immediate unban nếu IP còn trong jail;
- chuyển `10-lims-sshd.local` khỏi `jail.d` vào `$BACKUP_DIR/failed`;
- luôn stop và disable Fail2ban dù client socket lỗi;
- xóa `f2b-table` thủ công nếu service không dọn được;
- xác nhận `f2b-table` đã bị xóa;
- dừng rollout.

9. Immediate unban:

```bash
sudo -n fail2ban-client set sshd unbanip 100.86.19.103
```

10. Xác nhận fresh SSH từ `SYT-TC-CHI` hoạt động lại.

Không tạo đủ sáu lỗi xác thực trên production.

## Task 6: Acceptance Và Handoff

1. Xác nhận:

```bash
sudo -n sshd -t
sudo -n fail2ban-client -t
sudo -n systemctl is-active ssh
sudo -n systemctl is-active fail2ban
sudo -n systemctl is-enabled fail2ban
sudo -n ufw status
```

2. Xác nhận Fail2ban không còn IP test trong danh sách ban.
3. Xác nhận không có LIMS port bind wildcard.
4. Kiểm tra Docker:

```bash
sudo -n docker ps
sudo -n docker inspect lims-tunnel lims-nginx
```

5. Kiểm tra public health:

```bash
curl -fsS https://cdclims.cloud/auth/v1/health
```

6. Ghi lại:

- backup path;
- package version;
- effective SSH settings;
- Fail2ban jail state;
- bằng chứng ban/unban;
- UFW vẫn `inactive`;
- các kiểm tra chưa thực hiện vì UFW đã hoãn.
