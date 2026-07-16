#!/usr/bin/env bash

set -Eeuo pipefail

readonly OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BACKUP_SCRIPT="${OPS_DIR}/backup.sh"
readonly RESTORE_SCRIPT="${OPS_DIR}/restore.sh"
readonly VERIFY_SCRIPT="${OPS_DIR}/verify.sh"
readonly IMAGE_MANIFEST_SCRIPT="${OPS_DIR}/image-manifest.sh"
readonly TEST_ID="$$"
readonly SOURCE_PROJECT="lims-rehearsal-${TEST_ID}"
readonly TARGET_PROJECT="lims-rehearsal-restored-${TEST_ID}"

temp_dir=""
coa_server_pid=""

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

assert_file() {
    [[ -f "$1" ]] || fail "missing file: $1"
}

assert_not_file() {
    [[ ! -f "$1" ]] || fail "unexpected file: $1"
}

assert_command_fails() {
    if "$@" >/dev/null 2>&1; then
        fail "command unexpectedly succeeded: $*"
    fi
}

volume_mountpoint() {
    docker volume inspect "$1" --format '{{.Mountpoint}}'
}

remove_volume() {
    docker volume rm "$1" >/dev/null 2>&1 || true
}

cleanup() {
    local exit_code=$?

    if [[ -n "${coa_server_pid}" ]]; then
        kill "${coa_server_pid}" >/dev/null 2>&1 || true
        wait "${coa_server_pid}" >/dev/null 2>&1 || true
    fi

    remove_volume "${SOURCE_PROJECT}_postgres-data"
    remove_volume "${SOURCE_PROJECT}_storage-data"
    remove_volume "${TARGET_PROJECT}_postgres-data"
    remove_volume "${TARGET_PROJECT}_storage-data"

    if [[ -n "${temp_dir}" ]]; then
        rm -rf "${temp_dir}"
    fi

    exit "${exit_code}"
}

trap cleanup EXIT

assert_file "${BACKUP_SCRIPT}"
assert_file "${RESTORE_SCRIPT}"
assert_file "${VERIFY_SCRIPT}"
command -v age >/dev/null || fail "age is required"
command -v age-keygen >/dev/null || fail "age-keygen is required"

temp_dir="$(mktemp -d)"
key_file="${temp_dir}/age-key.txt"
backup_dir="${temp_dir}/backup"
corrupt_dir="${temp_dir}/corrupt"

age-keygen -o "${key_file}" >/dev/null 2>&1
recipient="$(age-keygen -y "${key_file}")"

docker volume create "${SOURCE_PROJECT}_postgres-data" >/dev/null
docker volume create "${SOURCE_PROJECT}_storage-data" >/dev/null

postgres_mount="$(volume_mountpoint "${SOURCE_PROJECT}_postgres-data")"
storage_mount="$(volume_mountpoint "${SOURCE_PROJECT}_storage-data")"

mkdir -p "${postgres_mount}/base" "${storage_mount}/signatures"
printf 'postgres fixture\n' > "${postgres_mount}/base/fixture.txt"
printf 'signature fixture\n' > "${storage_mount}/signatures/signature.png"
chmod 0640 "${storage_mount}/signatures/signature.png"
chown 1234:2345 "${storage_mount}/signatures/signature.png"

LIMS_ALLOW_TEST_PROJECT=1 \
    "${BACKUP_SCRIPT}" cold \
    --project "${SOURCE_PROJECT}" \
    --output-dir "${backup_dir}" \
    --recipient "${recipient}"

assert_file "${backup_dir}/${SOURCE_PROJECT}_postgres-data.tar.gz.age"
assert_file "${backup_dir}/${SOURCE_PROJECT}_storage-data.tar.gz.age"
assert_file "${backup_dir}/${SOURCE_PROJECT}_postgres-data.files.sha256"
assert_file "${backup_dir}/${SOURCE_PROJECT}_storage-data.files.sha256"
assert_file "${backup_dir}/SHA256SUMS"
assert_not_file "${backup_dir}/${SOURCE_PROJECT}_postgres-data.tar.gz"
assert_not_file "${backup_dir}/${SOURCE_PROJECT}_storage-data.tar.gz"

cp -a "${backup_dir}" "${corrupt_dir}"
printf 'corrupt' >> "${corrupt_dir}/${SOURCE_PROJECT}_postgres-data.tar.gz.age"

assert_command_fails env LIMS_ALLOW_TEST_PROJECT=1 \
    "${RESTORE_SCRIPT}" \
    --identity "${key_file}" \
    --backup-dir "${corrupt_dir}" \
    --source-project "${SOURCE_PROJECT}" \
    --target-project "${TARGET_PROJECT}"

assert_command_fails env LIMS_ALLOW_TEST_PROJECT=1 \
    "${BACKUP_SCRIPT}" cold \
    --project "unsafe-project-${TEST_ID}" \
    --output-dir "${temp_dir}/unsafe" \
    --recipient "${recipient}"

docker volume create "${TARGET_PROJECT}_postgres-data" >/dev/null
target_postgres_mount="$(volume_mountpoint "${TARGET_PROJECT}_postgres-data")"
printf 'must not overwrite\n' > "${target_postgres_mount}/existing.txt"

assert_command_fails env LIMS_ALLOW_TEST_PROJECT=1 \
    "${RESTORE_SCRIPT}" \
    --identity "${key_file}" \
    --backup-dir "${backup_dir}" \
    --source-project "${SOURCE_PROJECT}" \
    --target-project "${TARGET_PROJECT}"

remove_volume "${TARGET_PROJECT}_postgres-data"

LIMS_ALLOW_TEST_PROJECT=1 \
    "${RESTORE_SCRIPT}" \
    --identity "${key_file}" \
    --backup-dir "${backup_dir}" \
    --source-project "${SOURCE_PROJECT}" \
    --target-project "${TARGET_PROJECT}"

restored_postgres_mount="$(volume_mountpoint "${TARGET_PROJECT}_postgres-data")"
restored_storage_mount="$(volume_mountpoint "${TARGET_PROJECT}_storage-data")"

cmp \
    "${postgres_mount}/base/fixture.txt" \
    "${restored_postgres_mount}/base/fixture.txt"
cmp \
    "${storage_mount}/signatures/signature.png" \
    "${restored_storage_mount}/signatures/signature.png"

[[ "$(stat -c '%a' "${restored_storage_mount}/signatures/signature.png")" == "640" ]] \
    || fail "restored mode does not match"
[[ "$(stat -c '%u:%g' "${restored_storage_mount}/signatures/signature.png")" == "1234:2345" ]] \
    || fail "restored ownership does not match"

LIMS_ALLOW_TEST_PROJECT=1 \
    "${VERIFY_SCRIPT}" compare-volume-manifests \
    --backup-dir "${backup_dir}" \
    --source-project "${SOURCE_PROJECT}" \
    --target-project "${TARGET_PROJECT}"

assert_command_fails \
    "${VERIFY_SCRIPT}" assert-return-volumes \
    --postgres-volume lims-lite_postgres-data \
    --storage-volume lims-lite_storage-data

"${VERIFY_SCRIPT}" assert-return-volumes \
    --postgres-volume lims-lite-return-postgres-data \
    --storage-volume lims-lite-return-storage-data

fake_bin="${temp_dir}/fake-bin"
portable_image_manifest="${temp_dir}/portable-images.tsv"
mkdir -p "${fake_bin}"
cat > "${fake_bin}/docker" <<'SH'
#!/usr/bin/env bash
case "$*" in
    *'{{.Id}}'*)
        printf '%s\n' 'sha256:destination-store-id'
        ;;
    *'{{.Architecture}}'*)
        printf '%s\n' 'amd64'
        ;;
    *'{{json .RepoDigests}}'*)
        printf '%s\n' '["example/image@sha256:portable-digest"]'
        ;;
    *)
        exit 2
        ;;
esac
SH
chmod +x "${fake_bin}/docker"
printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    service \
    example/image@sha256:portable-digest \
    example/image@sha256:portable-digest \
    sha256:source-store-id \
    amd64 \
    2026-07-16T00:00:00Z \
    > "${portable_image_manifest}"

PATH="${fake_bin}:${PATH}" \
    "${IMAGE_MANIFEST_SCRIPT}" "${portable_image_manifest}"

sed 's/portable-digest/wrong-digest/g' \
    "${portable_image_manifest}" \
    > "${temp_dir}/wrong-images.tsv"
assert_command_fails env PATH="${fake_bin}:${PATH}" \
    "${IMAGE_MANIFEST_SCRIPT}" "${temp_dir}/wrong-images.tsv"

cat > "${temp_dir}/coa-server.py" <<'PY'
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

REPORT = b"<html><body>signed coa fixture</body></html>\n"
SAMPLE_ID = "sample-public-1"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def send_body(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/coa/access":
            self.send_body(200, b"<html><body>CDC LIMS</body></html>", "text/html")
            return

        query = parse_qs(parsed.query)
        has_cookie = "coa_token=test-token" in self.headers.get("Cookie", "")
        if (
            parsed.path == "/api/coa/download"
            and query.get("sample_id") == [SAMPLE_ID]
            and has_cookie
        ):
            self.send_body(200, REPORT, "text/html")
            return

        self.send_body(404, b"not found", "text/plain")

    def do_POST(self):
        if self.path != "/api/coa/authenticate":
            self.send_body(404, b"not found", "text/plain")
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length))
        if body.get("phone") != "0987654321":
            self.send_body(401, b'{"success":false}', "application/json")
            return

        response = json.dumps(
            {
                "success": True,
                "samples": [{"id": SAMPLE_ID, "has_coa": True}],
            }
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Set-Cookie", "coa_token=test-token; Path=/api/coa; HttpOnly")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
with open(sys.argv[1], "w", encoding="ascii") as port_file:
    port_file.write(str(server.server_port))
server.serve_forever()
PY

port_file="${temp_dir}/coa-server.port"
phone_file="${temp_dir}/coa-phone"
coa_manifest="${temp_dir}/coa-portal.manifest"
printf '0987654321\n' > "${phone_file}"
chmod 0600 "${phone_file}"
python3 "${temp_dir}/coa-server.py" "${port_file}" &
coa_server_pid=$!

for _ in {1..50}; do
    [[ -s "${port_file}" ]] && break
    sleep 0.1
done
[[ -s "${port_file}" ]] || fail "CoA test server did not start"
coa_base_url="http://127.0.0.1:$(<"${port_file}")"

LIMS_ALLOW_TEST_PROJECT=1 \
    "${VERIFY_SCRIPT}" coa-portal \
    --base-url "${coa_base_url}" \
    --phone-file "${phone_file}" \
    --sample-id sample-public-1 \
    --output-manifest "${coa_manifest}"

assert_file "${coa_manifest}"
assert_command_fails rg -q '0987654321' "${coa_manifest}"

LIMS_ALLOW_TEST_PROJECT=1 \
    "${VERIFY_SCRIPT}" coa-portal \
    --base-url "${coa_base_url}" \
    --phone-file "${phone_file}" \
    --sample-id sample-public-1 \
    --expected-manifest "${coa_manifest}"

cp "${coa_manifest}" "${temp_dir}/wrong-coa-portal.manifest"
sed -i 's/report_sha256=.*/report_sha256=wrong/' \
    "${temp_dir}/wrong-coa-portal.manifest"
assert_command_fails env LIMS_ALLOW_TEST_PROJECT=1 \
    "${VERIFY_SCRIPT}" coa-portal \
    --base-url "${coa_base_url}" \
    --phone-file "${phone_file}" \
    --sample-id sample-public-1 \
    --expected-manifest "${temp_dir}/wrong-coa-portal.manifest"

printf 'PASS: migration script behavioral checks\n'
