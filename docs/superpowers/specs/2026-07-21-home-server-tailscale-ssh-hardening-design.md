# Thiết Kế Tăng Cường Bảo Mật SSH Cho Home Server

Ngày 2026-07-21, người dùng duyệt phương án triển khai đơn giản gồm OpenSSH
hardening và Fail2ban cho home server `khoa-xn-cdc`.

UFW không được bật trong rollout này. Kiểm tra firewall, thiết bị LAN,
`netns/veth`, local console và reboot được hoãn sang một thay đổi riêng.

## Bối Cảnh Hiện Tại

Home server production:

- hostname: `khoa-xn-cdc`;
- Tailscale IPv4: `100.93.19.42`;
- SSH user: `khoa-xn-cdc`;
- production checkout: `/opt/lims-lite`;
- hệ điều hành: Ubuntu 24.04;
- UFW đã cài nhưng đang `inactive`;
- Fail2ban chưa cài.

Baseline SSH đã kiểm tra:

```text
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin without-password
MaxAuthTries 6
```

Các node quản trị:

| Node | Tailscale IPv4 | Vai trò |
| --- | --- | --- |
| `mystartup` | `100.99.227.53` | Phiên quản trị chính |
| `SYT-TC-CHI` | `100.86.19.103` | Node ban/unban test |
| `iphone-14-plus` | `100.115.19.69` | Termius qua 4G và Tailscale |

Key `windows-lims-home` hiện được giới hạn trong `authorized_keys` cho
`SYT-TC-CHI` và iPhone:

```text
from="100.86.19.103,100.115.19.69"
```

Đây là IP Tailscale, không phải IP công cộng do 4G cấp.

## Phạm Vi Được Duyệt

Rollout production gồm:

1. Giữ SSH key-only.
2. Vô hiệu hóa root login.
3. Chỉ cho phép local account `khoa-xn-cdc`.
4. Giảm `MaxAuthTries` từ `6` xuống `4`.
5. Cài Fail2ban và chỉ bật jail `sshd`.
6. Kiểm tra filter, manual ban và immediate unban bằng `SYT-TC-CHI`.
7. Xác nhận LIMS, Docker và Cloudflare Tunnel không bị ảnh hưởng.

Rollout không gồm:

- bật hoặc cấu hình UFW;
- thay đổi Tailscale grants/ACLs;
- mở TCP 22 trên router;
- chuyển sang Tailscale SSH;
- bind `sshd` vào Tailscale IP;
- reboot home server;
- thay đổi Docker Compose, PostgreSQL, RLS hoặc source code LIMS.

## Giới Hạn Bảo Vệ

Sau rollout này:

- SSH vẫn lắng nghe trên IPv4 và IPv6 hiện có;
- UFW vẫn `inactive`;
- thiết bị có đường mạng tới TCP 22 vẫn có thể thử xác thực;
- password login bị tắt và private key hợp lệ vẫn là điều kiện bắt buộc;
- root login bị tắt;
- Fail2ban phản ứng với các lần xác thực thất bại lặp lại.

Rollout này chưa chứng minh SSH chỉ truy cập được qua Tailscale. Mục tiêu đó
được hoãn cùng UFW.

## Thiết Kế OpenSSH

Giữ `/etc/ssh/sshd_config.d/00-key-only.conf` bất biến.

Tạo `/etc/ssh/sshd_config.d/10-root-login-disabled.conf`:

```text
PermitRootLogin no
```

Tạo `/etc/ssh/sshd_config.d/20-lims-ssh-policy.conf`:

```text
AllowUsers khoa-xn-cdc
MaxAuthTries 4
```

Không giới hạn `AllowUsers` theo IP. Giới hạn nguồn của từng public key tiếp
tục nằm trong `authorized_keys` khi cần.

Mỗi thay đổi SSH phải:

1. Backup cấu hình hiện tại.
2. Chạy `sudo -n sshd -t`.
3. Kiểm tra exact effective config.
4. Arm rollback timer 5 phút cho `20-lims-ssh-policy.conf`.
5. Reload `ssh`, không restart.
6. Giữ phiên SSH hiện tại trong khi mở fresh session.
7. Chỉ cancel timer sau khi fresh SSH từ các node hợp lệ thành công.

Các kiểm tra effective config:

```bash
set -euo pipefail
sudo -n sshd -T | grep -qx 'pubkeyauthentication yes'
sudo -n sshd -T | grep -qx 'passwordauthentication no'
sudo -n sshd -T | grep -qx 'kbdinteractiveauthentication no'
sudo -n sshd -T | grep -qx 'permitrootlogin no'
sudo -n sshd -T | grep -qx 'allowusers khoa-xn-cdc'
sudo -n sshd -T | grep -qx 'maxauthtries 4'
```

Kiểm tra theo connection context của cả ba node:

```bash
set -euo pipefail
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

Rollback timer chỉ gỡ policy account/retry và reload SSH. Nó không xóa
`10-root-login-disabled.conf` và không bật password hoặc root login. Nếu fresh
SSH thất bại, dùng phiên đang giữ để chạy rollback ngay hoặc để timer tự chạy.
Rollback script phải được cài root-only, kiểm tra syntax, chạy rehearsal trước
khi tạo policy mới và tạo marker ngay khi bắt đầu.

Sau reload:

- fresh SSH từ `mystartup` phải thành công;
- fresh SSH từ iPhone qua 4G và Tailscale phải thành công;
- fresh SSH từ `SYT-TC-CHI` phải thành công;
- root login phải bị từ chối;
- không được bật lại password để xử lý lỗi.

## Thiết Kế Fail2ban

Không chỉnh file `.conf` do package cung cấp.

Tạo `/etc/fail2ban/jail.d/10-lims-sshd.local`:

```ini
[DEFAULT]
banaction = nftables-multiport
bantime = 15m
findtime = 10m
maxretry = 6
usedns = no
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
backend = systemd
port = ssh
```

Lý do:

- `backend = systemd` đọc SSH journal;
- `nftables-multiport` dùng native nftables;
- `maxretry = 6` tránh ban do một vài lỗi thao tác;
- `bantime = 15m` cho phép tự phục hồi;
- không whitelist toàn bộ tailnet;
- một node bị ban không làm mất SSH của node quản trị khác.

Các gate cấu hình:

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

Trước lần ban đầu tiên, `f2b-table` có thể chưa tồn tại.

## Ban Test Bắt Buộc

Node test:

- hostname: `syt-tc-chi`;
- Tailscale IPv4: `100.86.19.103`;
- key hợp lệ: `windows-lims-home`.

Phải giữ ít nhất hai đường SSH quản trị khác hoạt động trong phép thử:

- `mystartup`;
- iPhone Termius.

Trình tự:

1. Ghi nhận baseline SSH thành công từ cả ba node.
2. Từ `mystartup`, dùng username không tồn tại `lims-f2b-probe`, một key tạm,
   `IdentitiesOnly=yes` và `IdentityAgent=none` để tạo đúng một lỗi xác thực có
   kiểm soát. Không dùng username hợp lệ `khoa-xn-cdc`: filter `sshd` mặc định
   cố ý không tính khóa public sai cho username hợp lệ để tránh ban nhầm client
   thử nhiều khóa.
3. Xác nhận SSH journal ghi nguồn `100.99.227.53`.
4. Xác nhận bộ đếm failed của jail `sshd` tăng.
5. Chạy manual ban:

```bash
sudo -n fail2ban-client set sshd banip 100.86.19.103
```

6. Xác nhận IP nằm trong danh sách ban:

```bash
sudo -n fail2ban-client status sshd
sudo -n nft list table inet f2b-table
```

7. Xác nhận chain có input hook priority `-1`.
8. Mở fresh SSH từ `SYT-TC-CHI`; kết nối phải bị chặn.
9. Xác nhận fresh SSH từ `mystartup` và iPhone vẫn thành công.
10. Unban ngay:

```bash
sudo -n fail2ban-client set sshd unbanip 100.86.19.103
```

11. Xác nhận `SYT-TC-CHI` mở fresh SSH thành công trở lại.

Không cố tình tạo đủ sáu lỗi trên production để kích hoạt auto-ban.

Nếu manual ban không chặn `SYT-TC-CHI`, unban nếu cần, vô hiệu hóa jail,
rollback Fail2ban và dừng rollout.

## Điều Kiện Trước Rollout

1. `mystartup` đang giữ một phiên SSH hợp lệ.
2. iPhone Termius đã SSH thành công qua 4G và Tailscale.
3. `SYT-TC-CHI` online và sẵn sàng thử fresh SSH.
4. Baseline SSH, Fail2ban, nftables, Docker và Cloudflare đã được ghi lại.
5. Backup mới, bất biến được tạo và đọc lại được.
6. UFW được xác nhận vẫn `inactive`.

Không yêu cầu:

- thiết bị LAN;
- `netns/veth`;
- local console;
- reboot.

## Trình Tự Rollout

1. Tạo backup root-only.
2. Thêm hai OpenSSH drop-in.
3. Chạy `sshd -t` và kiểm tra effective config.
4. Arm OpenSSH rollback timer.
5. Reload `ssh`.
6. Kiểm tra fresh SSH từ `mystartup`, iPhone và `SYT-TC-CHI`.
7. Cancel timer và xác nhận rollback chưa chạy.
8. Cài Fail2ban.
9. Thêm jail `sshd`.
10. Chạy config test, enable và restart service.
11. Chạy filter test từ `mystartup`.
12. Chạy ban/unban test bằng `SYT-TC-CHI`.
13. Xác nhận UFW vẫn `inactive`.
14. Kiểm tra Docker, Cloudflare Tunnel và LIMS.

Mỗi layer phải được kiểm tra xong trước khi chuyển sang layer tiếp theo.

## Tiêu Chí Chấp Nhận

1. `mystartup` SSH được bằng key.
2. iPhone Termius SSH được qua 4G và Tailscale.
3. `SYT-TC-CHI` SSH được trước phép thử.
4. Password login bị tắt.
5. Root login bị từ chối.
6. Chỉ local account `khoa-xn-cdc` được phép.
7. `MaxAuthTries` là `4`.
8. Fail2ban và jail `sshd` active.
9. Một authentication failure từ `mystartup` được nhận đúng IP.
10. Manual ban chặn fresh SSH từ `SYT-TC-CHI`.
11. Manual ban không chặn `mystartup` hoặc iPhone.
12. Immediate unban khôi phục SSH cho `SYT-TC-CHI`.
13. Fail2ban nftables hook có priority `-1`.
14. UFW vẫn `inactive`.
15. Không có LIMS port mới bind wildcard.
16. LIMS và Cloudflare Tunnel vẫn healthy.
17. `curl -fsS https://cdclims.cloud/auth/v1/health` thành công.

## Rollback

### OpenSSH

1. Dùng phiên SSH đang giữ hoặc để rollback timer chạy.
2. Giữ `10-root-login-disabled.conf` nếu file hợp lệ.
3. Xóa `20-lims-ssh-policy.conf` nếu `AllowUsers` hoặc `MaxAuthTries` gây lỗi.
4. Chạy `sudo -n sshd -t`.
5. Reload `ssh`.
6. Kiểm tra fresh SSH.

Không bật password hoặc root login để rollback.

### Fail2ban

```bash
sudo -n systemctl disable fail2ban || true
sudo -n systemctl stop fail2ban || true
sudo -n fail2ban-client stop || true
if sudo -n nft list table inet f2b-table >/dev/null 2>&1
then
  sudo -n nft delete table inet f2b-table
fi
```

Sau đó xác nhận:

- jail `10-lims-sshd.local` đã được chuyển khỏi `jail.d` vào backup điều tra;
- `f2b-table` đã được xóa;
- các node hợp lệ vẫn SSH được;
- log và cấu hình lỗi được giữ lại để điều tra.

Không purge package trong rollout.

## UFW Được Hoãn

UFW phải giữ `inactive` trong toàn bộ rollout này.

Một thay đổi riêng sẽ thiết kế lại:

- allow SSH chỉ trên `tailscale0`;
- IPv4 và IPv6 negative tests;
- tương tác với Tailscale và Docker chains;
- UFW rollback timer và rehearsal;
- local console hoặc out-of-band recovery;
- kiểm tra persistence sau reboot.

Không tái sử dụng các bước UFW cũ nếu chưa review lại baseline production.

## Tài Liệu Tham Khảo

- Fail2ban upstream:
  <https://github.com/fail2ban/fail2ban>
- Fail2ban jail configuration trên Ubuntu 24.04:
  <https://manpages.ubuntu.com/manpages/noble/en/man5/jail.conf.5.html>
- Tailscale access control:
  <https://tailscale.com/kb/1018/acls>
