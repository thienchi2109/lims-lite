# Thiết Kế Tăng Cường Bảo Mật SSH Cho Home Server

Ngày 2026-07-21, tài liệu này mô tả phương án bảo vệ SSH cho home server
`khoa-xn-cdc` mà vẫn cho phép nhiều thiết bị hợp lệ trong Tailscale truy cập,
bao gồm laptop, máy tính khác và điện thoại dùng Termius qua 4G.

Thiết kế không khóa SSH theo IP của từng thiết bị. Các lớp bảo vệ gồm Tailscale,
UFW, SSH key-only, vô hiệu hóa root login và Fail2ban với thời gian cấm ngắn.
Tài liệu này chưa cho phép triển khai production cho đến khi có kế hoạch triển
khai và cửa sổ bảo trì được duyệt.

## Bối Cảnh Hiện Tại

Home server production:

- hostname: `khoa-xn-cdc`;
- Tailscale IPv4: `100.93.19.42`;
- Tailscale IPv6: `fd7a:115c:a1e0::1336:132b`;
- LAN IPv4: `192.168.1.154`;
- SSH user: `khoa-xn-cdc`;
- production checkout: `/opt/lims-lite`;
- hệ điều hành: Ubuntu 24.04.4 LTS;
- firewall backend: `iptables` trên `nf_tables`;
- UFW 0.36.2 đã cài nhưng đang inactive;
- Fail2ban chưa cài;
- gói Fail2ban khả dụng: `1.0.2-3ubuntu0.1`.

Trạng thái SSH đã kiểm tra read-only:

- `sshd` đang nghe `0.0.0.0:22` và `[::]:22`;
- `PubkeyAuthentication yes`;
- `PasswordAuthentication no`;
- `KbdInteractiveAuthentication no`;
- `PermitRootLogin without-password`;
- `MaxAuthTries 6`;
- chỉ có `root` và `khoa-xn-cdc` là local account có login shell;
- 30 ngày gần nhất không có authentication failure trong SSH journal;
- các phiên SSH quan sát được đều đi qua Tailscale.

Các node Tailscale hiện được home server nhìn thấy:

- `mystartup`: `100.99.227.53`;
- `SYT-TC-CHI`: `100.86.19.103`;
- `localhost`: `100.115.19.69`, hiện offline;
- điện thoại Termius phải được ghi nhận hostname và Tailscale IP trước rollout.

Live Tailscale packet filter hiện là allow-all trong tailnet. Không có
Tailscale SSH policy. Việc thay đổi grants/ACLs sẽ ảnh hưởng toàn bộ luồng giữa
các node nên không thuộc phạm vi triển khai này.

Các Docker port nhạy cảm của LIMS đang bind vào loopback. `lims-tunnel` và
`lims-nginx` giao tiếp qua Docker network `lims-lite_default`.
`127.0.0.1:8088` chỉ là đường kiểm tra từ host.

## Mô Hình Bảo Vệ

Luồng truy cập dự kiến:

```text
Internet hoặc thiết bị ngoài tailnet
    -> không route được Tailscale IP
    -> UFW chặn SSH trên LAN/public interface

Thiết bị hợp lệ trong tailnet
    -> kết nối được tới sshd
    -> phải có SSH private key hợp lệ
    -> root login bị vô hiệu hóa
    -> thử sai lặp lại bị Fail2ban cấm tạm thời
```

Các lớp bảo vệ có trách nhiệm độc lập:

1. **Tailscale:** cung cấp mạng riêng được mã hóa và xác thực thiết bị.
2. **UFW:** chặn SSH đi trực tiếp qua LAN hoặc interface không phải Tailscale.
3. **OpenSSH:** chỉ chấp nhận key, không chấp nhận password và không cho root.
4. **Fail2ban:** phản ứng với các lần xác thực SSH thất bại lặp lại.
5. **Nhật ký:** lưu bằng chứng ban, unban, lỗi xác thực và thay đổi dịch vụ.

IP 4G công cộng của điện thoại có thể thay đổi mà không ảnh hưởng đến kết nối
Termius nếu điện thoại bật Tailscale và Termius kết nối tới `100.93.19.42`
hoặc MagicDNS của home server.

## Quyết Định

Triển khai bốn thay đổi:

1. Giữ SSH key-only và vô hiệu hóa root login.
2. Chỉ cho phép local account `khoa-xn-cdc`, nhưng không giới hạn theo IP node.
3. Bật UFW để chặn non-Tailscale ingress.
4. Cài Fail2ban và chỉ bật jail `sshd` với ngưỡng cấm bảo thủ.

Không thay Tailscale grants/ACLs trong rollout này.

Không bind `sshd` trực tiếp vào Tailscale IP vì cách đó tạo dependency khởi
động giữa `sshd` và `tailscaled`.

## Mục Tiêu

- Laptop, máy tính khác và điện thoại Termius trong tailnet vẫn SSH được.
- Thiết bị ngoài tailnet không truy cập được SSH qua Internet hoặc LAN.
- Thiết bị trong tailnet vẫn cần SSH private key hợp lệ.
- Root không thể đăng nhập SSH.
- Một node thử xác thực sai lặp lại bị cấm mà không khóa các node khác.
- Có ít nhất một thiết bị quản trị khác để unban khi một node bị cấm.
- LIMS, Docker và Cloudflare Tunnel không bị ảnh hưởng.
- Mọi thay đổi tồn tại đúng sau reboot và có rollback rõ ràng.

## Ngoài Phạm Vi

- Không mở TCP 22 trên router.
- Không chuyển sang Tailscale SSH.
- Không thay Tailscale grants/ACLs.
- Không khóa `AllowUsers` theo IP thiết bị.
- Không thêm jail cho nginx, Cloudflare, Docker, Supabase hoặc LIMS.
- Không bật permanent ban, progressive ban hoặc `recidive`.
- Không thay đổi Docker Compose, PostgreSQL, RLS hoặc source code LIMS.

## Thiết Kế OpenSSH

Giữ `/etc/ssh/sshd_config.d/00-key-only.conf` bất biến. Tách hardening thành
hai drop-in để rollback không bao giờ bật lại root login.

`/etc/ssh/sshd_config.d/10-root-login-disabled.conf`:

```text
PermitRootLogin no
```

`/etc/ssh/sshd_config.d/20-lims-ssh-policy.conf`:

```text
AllowUsers khoa-xn-cdc
MaxAuthTries 4
```

`AllowUsers` chỉ giới hạn local account, không giới hạn thiết bị. Mọi node hợp
lệ trong Tailscale có thể thử SSH nhưng vẫn phải có private key tương ứng trong
`authorized_keys`.

Mỗi thay đổi SSH phải:

1. Backup cấu hình hiện tại.
2. Chạy `sudo -n sshd -t`.
3. Kiểm tra exact effective config:

```bash
sudo -n sshd -T | grep -qx 'pubkeyauthentication yes'
sudo -n sshd -T | grep -qx 'passwordauthentication no'
sudo -n sshd -T | grep -qx 'kbdinteractiveauthentication no'
sudo -n sshd -T | grep -qx 'permitrootlogin no'
sudo -n sshd -T | grep -qx 'allowusers khoa-xn-cdc'
sudo -n sshd -T | grep -qx 'maxauthtries 4'
effective_config="$(sudo -n sshd -T -C \
  user=khoa-xn-cdc,addr=100.99.227.53,laddr=100.93.19.42,lport=22)"
for expected in \
  'passwordauthentication no' \
  'kbdinteractiveauthentication no' \
  'permitrootlogin no' \
  'allowusers khoa-xn-cdc' \
  'maxauthtries 4'
do
  printf '%s\n' "$effective_config" | grep -qx "$expected"
done
```

4. Reload `ssh`, không restart trực tiếp.
5. Giữ ít nhất một phiên SSH cũ đang mở.
6. Mở fresh session từ `mystartup`.
7. Mở fresh session từ điện thoại Termius qua 4G và Tailscale.
8. Kiểm tra root login bị từ chối.

Không bật lại password authentication để rollback.

## Thiết Kế Fail2ban

Fail2ban chỉ giám sát SSH. Không chỉnh file `.conf` do package cung cấp; cấu
hình riêng nằm trong `/etc/fail2ban/jail.d/10-lims-sshd.local`.

Baseline dự kiến:

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

Lý do chọn cấu hình:

- `backend = systemd` đọc trực tiếp SSH journal.
- `nftables-multiport` là action có sẵn trong gói Fail2ban 1.0.2 và dùng
  native nftables.
- action upstream tạo input hook với priority `-1`; rollout vẫn phải kiểm tra
  thực tế rằng rule ban chạy trước đường accept của `ts-input`.
- `maxretry = 6` tránh ban do một vài lỗi thao tác.
- `bantime = 15m` cho phép tự phục hồi nếu operator tự khóa một thiết bị.
- không whitelist toàn bộ `100.64.0.0/10`;
- không whitelist điện thoại hoặc laptop riêng lẻ;
- một node bị ban không được làm mất SSH của các node quản trị khác.

Các gate bắt buộc:

1. `fail2ban-client -t` thành công.
2. `fail2ban-client status sshd` cho thấy jail active.
3. Trước lần ban đầu tiên, `f2b-table` có thể chưa tồn tại; đây không phải lỗi.
4. Sau manual `banip` và trước `unbanip`,
   `nft list chain inet f2b-table f2b-chain` phải cho thấy:
   - `type filter`;
   - `hook input`;
   - priority `-1`;
   - set/rule dành cho SSH.
5. Fail2ban nhận cả IPv4 và IPv6 theo cấu hình package.
6. Ban thử một node không quan trọng do người dùng chỉ định rõ.

### Ban Test Bắt Buộc

Người dùng đã duyệt node kiểm thử:

- `TEST_NODE`: `SYT-TC-CHI`;
- `TEST_NODE_TAILSCALE_IP`: `100.86.19.103`;
- ít nhất hai node quản trị khác vẫn SSH được trong toàn bộ phép thử.

`SYT-TC-CHI` chỉ mất SSH tạm thời trong phép thử và phải được unban ngay.
Không được thay node thử thành `mystartup`, điện thoại Termius hoặc thiết bị
duy nhất có thể truy cập local console nếu chưa có phê duyệt mới.

Ban test tách việc kiểm tra filter và ban action:

1. Ghi baseline SSH thành công từ `mystartup`, điện thoại Termius và
   `SYT-TC-CHI`.
2. Trên `SYT-TC-CHI`, tạo đúng một authentication failure bằng một key tạm:

```bash
set -euo pipefail
probe_dir="$(mktemp -d)"
trap 'rm -rf "$probe_dir"' EXIT
ssh-keygen -q -t ed25519 -N '' -f "$probe_dir/id_ed25519"
if ssh -F none \
  -o BatchMode=yes \
  -o ControlMaster=no \
  -o ControlPath=none \
  -o IdentitiesOnly=yes \
  -o IdentityAgent=none \
  -o PreferredAuthentications=publickey \
  -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no \
  -o StrictHostKeyChecking=yes \
  -i "$probe_dir/id_ed25519" \
  khoa-xn-cdc@100.93.19.42 true
then
  printf '%s\n' 'Lỗi: key tạm đã được chấp nhận' >&2
  exit 1
fi
rm -rf "$probe_dir"
trap - EXIT
```

Các option trên bỏ qua client config, vô hiệu SSH agent, connection sharing và
mọi default identity. Vì vậy client chỉ gửi public key tạm đã chỉ định. Phải
đăng nhập thành công bằng key thật tới đúng IP `100.93.19.42` trước phép thử để
host key đã có trong `known_hosts`.

3. Xác nhận SSH journal và Fail2ban log nhận đúng
   `100.86.19.103`.
4. Ban thủ công để kiểm tra action:

```bash
sudo -n fail2ban-client set sshd banip 100.86.19.103
```

5. Xác nhận `fail2ban-client status sshd` liệt kê `100.86.19.103`.
6. Trong khi IP đang bị ban, kiểm tra:

```bash
sudo -n nft list chain inet f2b-table f2b-chain
sudo -n nft list set inet f2b-table addr-set-sshd
```

Chain phải có input hook priority `-1`; set `addr-set-sshd` phải chứa
`100.86.19.103`.

7. Xác nhận kết nối TCP/SSH mới từ `SYT-TC-CHI` bị chặn.
8. Xác nhận `mystartup` và điện thoại Termius vẫn SSH được.
9. Unban:

```bash
sudo -n fail2ban-client set sshd unbanip 100.86.19.103
```

10. Xác nhận `SYT-TC-CHI` SSH được lại khi dùng key hợp lệ.

Không cố tình tạo đủ sáu lỗi xác thực trên production chỉ để kích hoạt auto
ban. Một lỗi kiểm tra filter cộng với manual `banip` kiểm tra action là đủ để
chứng minh hai phần hoạt động độc lập.

Nếu IP xuất hiện trong Fail2ban nhưng kết nối từ node đó vẫn vào được, action
không chặn trước `ts-input`; rollout bị fail và phải rollback Fail2ban.

## Thiết Kế UFW

UFW chỉ chịu trách nhiệm chặn non-Tailscale ingress. Tailscale hiện tự thêm
`ts-input` và `ts-forward`; UFW không được mô tả như lớp phân quyền giữa các
node tailnet.

Trước khi stage UFW, tạo kho rollback root-only tồn tại qua reboot:

```bash
ROLLBACK_DIR=/var/lib/lims-ssh-hardening-rollout
sudo -n test ! -e "$ROLLBACK_DIR"
sudo -n install -d -o root -g root -m 700 "$ROLLBACK_DIR"
```

Lưu các backup sau vào `$ROLLBACK_DIR`:

- `/etc/default/ufw`;
- `/etc/ufw/ufw.conf`;
- `/etc/ufw/sysctl.conf`;
- `/etc/ufw/user.rules`;
- `/etc/ufw/user6.rules`;
- `iptables-save`;
- `ip6tables-save`;
- `nft list ruleset`;
- `iptables -S INPUT`;
- `iptables -S FORWARD`;
- `iptables -S ts-input`;
- `iptables -S ts-forward`;
- `iptables -S DOCKER-USER`;
- exact IPv4/IPv6 built-in chain policies;
- toàn bộ runtime sysctl được khai báo active trong `/etc/ufw/sysctl.conf`;
- `net.ipv4.ip_forward` và `net.ipv6.conf.all.forwarding`;
- listeners và Docker host publications.

Các giá trị bắt buộc:

```text
IPV6=yes
DEFAULT_INPUT_POLICY="DROP"
DEFAULT_OUTPUT_POLICY="ACCEPT"
DEFAULT_FORWARD_POLICY="DROP"
MANAGE_BUILTINS=no
```

`MANAGE_BUILTINS=no` phải giữ nguyên để UFW không flush các built-in chain do
Tailscale và Docker sử dụng.

Baseline runtime đã quan sát và phải được kiểm tra lại ngay trước rollout:

```text
IPv4 INPUT ACCEPT
IPv4 OUTPUT ACCEPT
IPv4 FORWARD DROP
IPv6 INPUT ACCEPT
IPv6 OUTPUT ACCEPT
IPv6 FORWARD ACCEPT
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 0
```

Nếu baseline tại thời điểm rollout khác danh sách trên, dừng và cập nhật thiết
kế; không dùng các giá trị cũ để rollback.

Rule dự kiến:

```bash
sudo -n ufw default deny incoming
sudo -n ufw default allow outgoing
sudo -n ufw allow in on tailscale0 to any port 22 proto tcp \
  comment 'SSH over Tailscale'
sudo -n ufw show added
```

Chụp exact sysctl baseline vào file root-owned trước khi enable UFW:

```bash
set -euo pipefail
ROLLBACK_DIR=/var/lib/lims-ssh-hardening-rollout
sudo -n test -d "$ROLLBACK_DIR"
raw_keys_tmp="$(mktemp)"
keys_tmp="$(mktemp)"
baseline_tmp="$(mktemp)"
trap 'rm -f "$raw_keys_tmp" "$keys_tmp" "$baseline_tmp"' EXIT
awk -F= '
  !/^[[:space:]]*(#|$)/ {
    key = $1
    gsub(/[[:space:]]/, "", key)
    gsub("/", ".", key)
    print key
  }
' /etc/ufw/sysctl.conf > "$raw_keys_tmp"
printf '%s\n' \
  net.ipv4.ip_forward \
  net.ipv6.conf.all.forwarding >> "$raw_keys_tmp"
LC_ALL=C sort -u "$raw_keys_tmp" > "$keys_tmp"
test -s "$keys_tmp"

while IFS= read -r key
do
  value="$(sysctl -n "$key")"
  printf '%s=%s\n' "$key" "$value"
done < "$keys_tmp" > "$baseline_tmp"
test "$(wc -l < "$baseline_tmp")" -eq "$(wc -l < "$keys_tmp")"
sudo -n install -o root -g root -m 600 \
  "$baseline_tmp" "$ROLLBACK_DIR/ufw-sysctl-baseline.conf"
sudo -n test -s "$ROLLBACK_DIR/ufw-sysctl-baseline.conf"
rm -f "$raw_keys_tmp" "$keys_tmp" "$baseline_tmp"
trap - EXIT
```

Tạo emergency rollback script root-owned:

```bash
ROLLBACK_DIR=/var/lib/lims-ssh-hardening-rollout
date --iso-8601=seconds | \
  sudo -n tee "$ROLLBACK_DIR/started-at" >/dev/null
sudo -n rm -f /run/lims-ufw-rollback-fired
sudo -n tee "$ROLLBACK_DIR/ufw-emergency-rollback.sh" >/dev/null <<'EOF'
#!/bin/sh
set -u

status=0
run_rollback_step() {
  "$@" || status=1
}

/usr/bin/date --iso-8601=seconds > /run/lims-ufw-rollback-fired || status=1
run_rollback_step /usr/sbin/ufw --force disable
run_rollback_step /usr/sbin/iptables -P INPUT ACCEPT
run_rollback_step /usr/sbin/iptables -P OUTPUT ACCEPT
run_rollback_step /usr/sbin/iptables -P FORWARD DROP
run_rollback_step /usr/sbin/ip6tables -P INPUT ACCEPT
run_rollback_step /usr/sbin/ip6tables -P OUTPUT ACCEPT
run_rollback_step /usr/sbin/ip6tables -P FORWARD ACCEPT
run_rollback_step /usr/sbin/sysctl \
  -p /var/lib/lims-ssh-hardening-rollout/ufw-sysctl-baseline.conf
exit "$status"
EOF
sudo -n chmod 700 "$ROLLBACK_DIR/ufw-emergency-rollback.sh"
```

Script không dừng giữa chừng nếu `ufw disable` hoặc một lệnh restore lỗi. Nó
thử toàn bộ bước rollback, sau đó trả exit code khác `0` nếu có bất kỳ bước nào
không thành công. Các policy trong script phải được cập nhật nếu baseline ngay
trước rollout khác giá trị đã ghi trong tài liệu. Sysctl được khôi phục từ
exact baseline vừa chụp, không chỉ hai forwarding setting.

Arm rollback timer rồi mới enable UFW. Toàn bộ block phải chạy trong cùng một
Bash shell; bất kỳ lệnh nào lỗi đều dừng trước lệnh enable:

```bash
set -euo pipefail
ROLLBACK_DIR=/var/lib/lims-ssh-hardening-rollout
sudo -n test -x "$ROLLBACK_DIR/ufw-emergency-rollback.sh"
sudo -n test -s "$ROLLBACK_DIR/ufw-sysctl-baseline.conf"
sudo -n test ! -e /run/lims-ufw-rollback-fired
sudo -n test ! -e /run/lims-ufw-rollback-unit
ROLLBACK_UNIT="lims-ufw-rollback-$(date +%s%N)"
ufw_enable_started=0

cleanup_failed_arm() {
  local rc=$?
  trap - EXIT
  if [ "$rc" -ne 0 ] && [ "$ufw_enable_started" -eq 0 ]
  then
    if sudo -n systemctl stop "$ROLLBACK_UNIT.timer" 2>/dev/null
    then
      sudo -n rm -f /run/lims-ufw-rollback-unit
    else
      printf '%s\n' \
        'Không dừng được timer; giữ file unit để xử lý thủ công' >&2
    fi
  fi
  exit "$rc"
}

trap cleanup_failed_arm EXIT
printf '%s\n' "$ROLLBACK_UNIT" | \
  sudo -n tee /run/lims-ufw-rollback-unit >/dev/null
sudo -n systemd-run \
  --unit="$ROLLBACK_UNIT" \
  --on-active=5m \
  "$ROLLBACK_DIR/ufw-emergency-rollback.sh"
test "$(sudo -n systemctl is-active "$ROLLBACK_UNIT.timer")" = active
timer_list="$(sudo -n systemctl list-timers \
  "$ROLLBACK_UNIT.timer" --no-pager)"
grep -Fq -- "$ROLLBACK_UNIT.timer" <<<"$timer_list"
ufw_enable_started=1
sudo -n ufw --force enable
sudo -n ufw status | grep -qx 'Status: active'
sudo -n grep -qx 'ENABLED=yes' /etc/ufw/ufw.conf
trap - EXIT
```

Nếu validation trước lệnh enable lỗi, UFW không được bật. Nếu validation sau
lệnh enable lỗi, giữ nguyên timer để emergency rollback tự chạy.

Chỉ cancel timer sau khi fresh SSH từ ít nhất hai node và health checks thành
công. Chỉ stop timer; không stop rollback service:

```bash
set -euo pipefail
ROLLBACK_UNIT="$(sudo -n cat /run/lims-ufw-rollback-unit)"
case "$ROLLBACK_UNIT" in
  lims-ufw-rollback-[0-9]*) ;;
  *)
    printf '%s\n' 'Lỗi: tên rollback unit không hợp lệ' >&2
    exit 1
    ;;
esac
sudo -n systemctl stop "$ROLLBACK_UNIT.timer"

read_unit_state() {
  local state
  state="$(sudo -n systemctl is-active "$1" 2>/dev/null)" || true
  case "$state" in
    active|activating|deactivating|inactive|failed|unknown)
      printf '%s\n' "$state"
      ;;
    *)
      return 1
      ;;
  esac
}

timer_state="$(read_unit_state "$ROLLBACK_UNIT.timer")"
case "$timer_state" in
  inactive|unknown) ;;
  *)
    printf '%s\n' \
      "Lỗi: trạng thái rollback timer không an toàn: $timer_state" >&2
    exit 1
    ;;
esac

service_state="$(read_unit_state "$ROLLBACK_UNIT.service")"
while case "$service_state" in active|activating|deactivating) true;; *) false;; esac
do
  sleep 1
  service_state="$(read_unit_state "$ROLLBACK_UNIT.service")"
done

case "$service_state" in
  inactive|unknown) ;;
  *)
    printf '%s\n' \
      "Lỗi: trạng thái rollback service không an toàn: $service_state" >&2
    exit 1
    ;;
esac

if sudo -n test -e /run/lims-ufw-rollback-fired
then
  printf '%s\n' 'Rollback đã chạy; giữ UFW disabled và dừng rollout' >&2
  exit 1
fi

sudo -n test ! -e /run/lims-ufw-rollback-fired
sudo -n systemctl is-active fail2ban
ufw_status="$(sudo -n ufw status)"
grep -qx 'Status: active' <<<"$ufw_status"
sudo -n grep '^ENABLED=yes' /etc/ufw/ufw.conf
sudo -n rm -f /run/lims-ufw-rollback-unit
```

Sau khi cancel:

- timer và rollback service đều phải inactive;
- file `/run/lims-ufw-rollback-unit` đã được xóa;
- marker `/run/lims-ufw-rollback-fired` không tồn tại, chứng minh rollback
  service chưa chạy;
- UFW vẫn active;
- `ENABLED=yes`;
- Fail2ban vẫn active.

Nếu service đã bắt đầu, block cancel đợi nó chạy xong và fail vì marker tồn tại;
không bao giờ kill rollback giữa chừng. Emergency timer disable UFW và khôi
phục runtime policy/sysctl baseline. Full rollback vẫn phải restore persistent
UFW files để tránh rule cũ xuất hiện trong lần enable sau.

### Rehearsal Rollback Bắt Buộc

Sau lần enable UFW đầu tiên và sau khi fresh SSH đã thành công:

1. Chạy nguyên block cancel timer; không stop rollback service.
2. Chạy thủ công
   `/var/lib/lims-ssh-hardening-rollout/ufw-emergency-rollback.sh`.
3. Xác nhận:
   - UFW inactive;
   - marker rollback tồn tại;
   - IPv4/IPv6 policies khớp exact baseline;
   - mọi giá trị trong
     `/var/lib/lims-ssh-hardening-rollout/ufw-sysctl-baseline.conf` khớp
     runtime;
   - `ts-input`, `ts-forward`, `DOCKER-USER` và Docker hooks vẫn reachable;
   - `mystartup`, điện thoại Termius và node quản trị thứ hai SSH được;
   - Docker và Cloudflare vẫn healthy.

Kiểm tra exact sysctl baseline:

```bash
set -euo pipefail
baseline_check_tmp="$(mktemp)"
trap 'rm -f "$baseline_check_tmp"' EXIT
sudo -n cat \
  /var/lib/lims-ssh-hardening-rollout/ufw-sysctl-baseline.conf \
  > "$baseline_check_tmp"
test -s "$baseline_check_tmp"
while IFS='=' read -r key expected
do
  actual="$(sysctl -n "$key")"
  test "$actual" = "$expected"
done < "$baseline_check_tmp"
rm -f "$baseline_check_tmp"
trap - EXIT
```

4. Xóa marker.
5. Chạy lại nguyên block arm rollback timer rồi enable UFW. Block đã chứa lệnh
   enable; không chạy `ufw --force enable` thêm lần nữa.

Nếu rehearsal không khôi phục đúng baseline, rollback UFW hoàn toàn và dừng
rollout.

## Ràng Buộc Docker Và Cloudflare

Docker-published traffic không được bảo vệ theo cách thông thường bởi UFW vì
Docker tạo NAT/filter rules riêng. Vì vậy rollout phải xác nhận:

- các host-published LIMS port vẫn bind `127.0.0.1`;
- không xuất hiện publication mới trên `0.0.0.0` hoặc `[::]`;
- `DOCKER-USER`, Docker chains, `ts-input` và `ts-forward` vẫn có reachable
  hooks sau UFW và sau reboot;
- `lims-tunnel` và `lims-nginx` vẫn cùng `lims-lite_default`;
- Cloudflare Tunnel vẫn healthy.

Không thêm HTTP jail vì origin cần thiết kế riêng để tin đúng
`CF-Connecting-IP` và không ban nhầm Cloudflare proxy.

## Điều Kiện Trước Rollout

1. Operator có mặt tại home server và đã thử local console login.
2. `mystartup` SSH được bằng key.
3. Điện thoại Termius SSH được qua 4G và Tailscale.
4. `SYT-TC-CHI` đã được người dùng duyệt làm node ban test tạm thời.
5. Có ít nhất hai node quản trị không dùng cùng một thiết bị vật lý.
6. Router không forward TCP 22.
7. Có một thiết bị trên cùng LAN để kiểm tra direct IPv4 và IPv6 link-local.
8. IPv6 link-local của `wlp3s0` được đọc lại ngay trước test; giá trị đã quan
   sát là `fe80::d058:2971:51a6:4c77`.
9. Baseline SSH, UFW, Fail2ban, netfilter, Docker và Cloudflare đã ghi lại.
10. Backup cấu hình đã tạo và đọc lại được.

Trước khi stage UFW, chạy positive control từ đúng thiết bị LAN sẽ dùng cho
negative test:

```bash
set -euo pipefail
CLIENT_LAN_INTERFACE=wlan0
SERVER_LAN_IPV4=192.168.1.154
SERVER_LAN_IPV6=fe80::d058:2971:51a6:4c77
nc -4 -vz -w 5 "$SERVER_LAN_IPV4" 22
nc -6 -vz -w 5 \
  "${SERVER_LAN_IPV6}%${CLIENT_LAN_INTERFACE}" 22
```

Thay `wlan0` bằng interface LAN thật của thiết bị kiểm tra. Cả hai kết nối phải
thành công trước khi bật UFW. Nếu một kết nối không thành công, không thể dùng
timeout sau rollout làm bằng chứng UFW đã chặn; rollout phải dừng.

## Trình Tự Rollout

1. Lưu toàn bộ baseline và backup.
2. Thêm OpenSSH hardening drop-in.
3. Chạy `sshd -t`, reload và kiểm tra fresh SSH từ laptop và điện thoại.
4. Cài Fail2ban.
5. Thêm jail `sshd`, chạy config test và start service.
6. Chạy filter/action test bằng `SYT-TC-CHI`.
7. Sau manual ban, kiểm tra nftables hook priority `-1`, sau đó unban ngay.
8. Stage UFW defaults và Tailscale SSH allow rule.
9. Kiểm tra `IPV6=yes`, `MANAGE_BUILTINS=no`, `ufw show added`, rồi chụp
   sysctl baseline và tạo emergency rollback script.
10. Chạy nguyên block arm rollback timer rồi enable UFW.
11. Kiểm tra fresh SSH từ `mystartup` và điện thoại Termius.
12. Chạy nguyên block cancel timer, sau đó chạy thủ công rehearsal rollback.
13. Xác nhận exact runtime baseline, SSH, hooks, Docker và Cloudflare phục hồi.
14. Xóa marker, chạy lại nguyên block arm rollback timer rồi enable UFW lần
    cuối.
15. Từ đúng thiết bị, interface và địa chỉ đã qua positive control, chạy
    negative test:

```bash
set -euo pipefail
CLIENT_LAN_INTERFACE=wlan0
SERVER_LAN_IPV4=192.168.1.154
SERVER_LAN_IPV6=fe80::d058:2971:51a6:4c77
if nc -4 -vz -w 5 "$SERVER_LAN_IPV4" 22
then
  printf '%s\n' 'Lỗi: SSH qua LAN IPv4 vẫn truy cập được' >&2
  exit 1
fi
if nc -6 -vz -w 5 \
  "${SERVER_LAN_IPV6}%${CLIENT_LAN_INTERFACE}" 22
then
  printf '%s\n' 'Lỗi: SSH qua LAN IPv6 vẫn truy cập được' >&2
  exit 1
fi
```

Không có thiết bị đủ điều kiện chạy negative test IPv6 thì dừng rollout; không
thay bằng việc chỉ nhìn `IPV6=yes`.

16. Kiểm tra `ip6tables -S INPUT`, Docker, Cloudflare và LIMS.
17. Kiểm tra Fail2ban vẫn active và ban test vẫn hoạt động sau UFW.
18. Chạy nguyên block cancel timer và xác nhận rollback chưa chạy trong lần
    enable cuối.
19. Reboot trong maintenance window với operator tại local console.
20. Lặp lại toàn bộ acceptance checks sau reboot.
21. Chỉ sau khi post-reboot acceptance đạt, kết thúc rollback window và xử lý
    kho `/var/lib/lims-ssh-hardening-rollout` theo retention đã duyệt.

Trước khi cancel timer, lỗi phải dừng rollout và rollback thay đổi vừa áp dụng.
Sau khi cancel timer hoặc reboot, phải chẩn đoán đúng layer trước khi rollback.

## Tiêu Chí Chấp Nhận

1. `mystartup` SSH được qua Tailscale.
2. Điện thoại Termius SSH được khi dùng 4G và Tailscale.
3. Một node quản trị thứ hai SSH được.
4. Password login bị tắt.
5. Root login bị từ chối.
6. Chỉ local account `khoa-xn-cdc` được phép.
7. Một authentication failure từ `SYT-TC-CHI` được filter nhận đúng
   `100.86.19.103`.
8. Sau manual ban, `f2b-table` có input hook priority `-1` và chứa IP test.
9. Manual ban làm `SYT-TC-CHI` mất SSH nhưng các node khác vẫn SSH được.
10. Unban khôi phục SSH cho `SYT-TC-CHI`.
11. Fail2ban nftables hook chạy trước đường accept của Tailscale.
12. UFW active với `IPV6=yes` và `MANAGE_BUILTINS=no`.
13. Rehearsal rollback khôi phục exact IPv4/IPv6 policies, toàn bộ sysctl
    baseline, Tailscale/Docker hooks và SSH.
14. Timer và rollback service đều inactive; marker
    `/run/lims-ufw-rollback-fired` và file `/run/lims-ufw-rollback-unit` không
    tồn tại sau khi cancel.
15. SSH trực tiếp tới `192.168.1.154:22` từ LAN bị chặn.
16. SSH trực tiếp tới IPv6 link-local của `wlp3s0` từ cùng LAN bị chặn.
17. IPv6 `INPUT` có UFW hooks/rules đúng và không có non-Tailscale allow cho
    TCP 22.
18. `INPUT` và `FORWARD` vẫn có reachable hooks tới UFW, Tailscale và Docker.
19. Không có LIMS port bind wildcard.
20. `lims-tunnel` và các container LIMS vẫn healthy.
21. `curl -fsS https://cdclims.cloud/auth/v1/health` thành công.
22. Operator đăng nhập LIMS, mở trang Mẫu và đọc một chi tiết mẫu mà không tạo
    mutation.
23. Tất cả kiểm tra vẫn đạt sau reboot.
24. Tailscale policy vẫn giữ nguyên allow-all trong rollout này.

## Rollback Theo Layer

### OpenSSH

1. Dùng existing session hoặc local console.
2. Giữ nguyên `10-root-login-disabled.conf`.
3. Nếu `AllowUsers` hoặc `MaxAuthTries` gây lỗi, xóa
   `20-lims-ssh-policy.conf`.
4. Nếu file root hardening bị lỗi cú pháp, thay nó bằng file tối thiểu đã
   validate chỉ chứa `PermitRootLogin no`; không xóa để quay về baseline.
5. Chạy `sshd -t`.
6. Reload `ssh`.
7. Kiểm tra `sshd -T` vẫn có `permitrootlogin no`.
8. Kiểm tra fresh SSH.

Không bật password hoặc root login để rollback.

### Fail2ban

```bash
sudo -n fail2ban-client stop
sudo -n systemctl disable --now fail2ban
```

Sau đó xác nhận `f2b-table` đã được xóa và SSH từ các node hợp lệ vẫn hoạt
động. Chỉ purge package sau khi log và cấu hình cần điều tra đã được giữ lại.

### UFW Trước Khi Cancel Timer

Để timer chạy hoặc dùng existing session/local console:

```bash
sudo -n \
  /var/lib/lims-ssh-hardening-rollout/ufw-emergency-rollback.sh
```

Sau khi khôi phục truy cập, restore persistent UFW files từ backup và giữ UFW
disabled cho đến khi review xong. Xác nhận exact IPv4/IPv6 policies và
toàn bộ sysctl trong baseline khớp runtime; chỉ restore file là chưa đủ.

### Sau Khi Cancel Timer Hoặc Reboot

Duy trì `/var/lib/lims-ssh-hardening-rollout` với owner `root:root` và mode
`0700` cho đến khi toàn bộ post-reboot acceptance đạt. Không đặt script,
baseline hoặc backup chỉ trong `/run` vì `/run` bị xóa khi reboot.

Dùng local console để xác định layer:

1. Kiểm tra `sshd -t`, SSH journal và effective config.
2. Kiểm tra `fail2ban-client status`, nftables hook và danh sách ban.
3. Kiểm tra UFW defaults, `MANAGE_BUILTINS`, INPUT/FORWARD hooks.
4. Kiểm tra Tailscale, Docker và Cloudflare.

Chỉ rollback layer lỗi. Nếu nhiều layer cùng lỗi, rollback UFW trước để khôi
phục network path, sau đó rollback Fail2ban hoặc OpenSSH.

Rollback UFW phải chạy emergency script, restore persistent files và xác nhận:

- UFW inactive;
- IPv4/IPv6 runtime policies khớp baseline;
- toàn bộ sysctl baseline khớp runtime;
- Tailscale/Docker hooks vẫn reachable;
- fresh SSH hoạt động.

Không rollback bằng cách mở TCP 22 trên router.

## Công Việc Theo Sau

Tạo thiết kế riêng nếu muốn chuyển Tailscale policy từ allow-all sang
deny-by-default theo người dùng, nhóm hoặc device tag. Việc đó phải inventory
toàn bộ luồng giữa các node và có positive/negative policy tests.

## Tài Liệu Tham Khảo

- Fail2ban upstream:
  <https://github.com/fail2ban/fail2ban>
- Fail2ban jail configuration trên Ubuntu 24.04:
  <https://manpages.ubuntu.com/manpages/noble/en/man5/jail.conf.5.html>
- Tailscale access control:
  <https://tailscale.com/kb/1018/acls>
- Tailscale Ubuntu server hardening:
  <https://tailscale.com/kb/1077/secure-server-ubuntu-18-04>
- UFW framework:
  <https://manpages.ubuntu.com/manpages/noble/en/man8/ufw-framework.8.html>
- Docker packet filtering và UFW:
  <https://docs.docker.com/engine/network/packet-filtering-firewalls/>
- Cloudflare original visitor IP:
  <https://developers.cloudflare.com/support/troubleshooting/restoring-visitor-ips/restoring-original-visitor-ips/>
