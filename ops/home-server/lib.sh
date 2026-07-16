#!/usr/bin/env bash

set -Eeuo pipefail

readonly PRODUCTION_PROJECT="lims-lite"
# shellcheck disable=SC2034
readonly PRODUCTION_POSTGRES_VOLUME="lims-lite_postgres-data"
# shellcheck disable=SC2034
readonly PRODUCTION_STORAGE_VOLUME="lims-lite_storage-data"
readonly TUNNEL_CONTAINER="lims-tunnel"
readonly POSTGRES_IMAGE="supabase/postgres:15.1.1.28@sha256:33b96010b760e41a987542c8c043369022a16b16cd88941790d5fcf06cd2484c"

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

require_root() {
    [[ "${EUID}" == "0" ]] || die "this operation must run as root"
}

is_test_project() {
    [[ "${LIMS_ALLOW_TEST_PROJECT:-0}" == "1" && "$1" =~ ^lims-rehearsal-[a-z0-9-]+$ ]]
}

require_project() {
    local project="$1"

    if is_test_project "${project}"; then
        return
    fi

    [[ "${project}" == "${PRODUCTION_PROJECT}" ]] \
        || die "unsupported Compose project: ${project}"
    [[ "${COMPOSE_PROJECT_NAME:-}" == "${PRODUCTION_PROJECT}" ]] \
        || die "COMPOSE_PROJECT_NAME must be ${PRODUCTION_PROJECT}"
}

project_postgres_volume() {
    printf '%s_postgres-data\n' "$1"
}

project_storage_volume() {
    printf '%s_storage-data\n' "$1"
}

require_volume() {
    docker volume inspect "$1" >/dev/null 2>&1 \
        || die "Docker volume not found: $1"
}

volume_mountpoint() {
    docker volume inspect "$1" --format '{{.Mountpoint}}'
}

volume_is_empty() {
    local mountpoint
    mountpoint="$(volume_mountpoint "$1")"
    [[ -z "$(find "${mountpoint}" -mindepth 1 -print -quit)" ]]
}

require_cold_volume() {
    local volume="$1"
    local running_containers

    running_containers="$(docker ps --quiet --filter "volume=${volume}")"
    [[ -z "${running_containers}" ]] \
        || die "volume is attached to a running container: ${volume}"
}

require_tunnel_stopped() {
    local project="$1"
    local running

    if is_test_project "${project}"; then
        return
    fi

    running="$(docker inspect "${TUNNEL_CONTAINER}" \
        --format '{{.State.Running}}' 2>/dev/null || true)"
    [[ "${running}" != "true" ]] \
        || die "Cloudflare Tunnel container must be stopped"
}

write_volume_manifest() {
    local volume="$1"
    local output_file="$2"
    local mountpoint

    mountpoint="$(volume_mountpoint "${volume}")"
    (
        cd "${mountpoint}"
        find . -type f -print0 \
            | LC_ALL=C sort -z \
            | while IFS= read -r -d '' path; do
                printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
                    "$(sha256sum "${path}" | awk '{print $1}')" \
                    "$(stat -c '%s' "${path}")" \
                    "$(stat -c '%u' "${path}")" \
                    "$(stat -c '%g' "${path}")" \
                    "$(stat -c '%a' "${path}")" \
                    "${path#./}"
            done
    ) > "${output_file}"
    chmod 0600 "${output_file}"
}

create_encrypted_volume_archive() {
    local volume="$1"
    local recipient="$2"
    local output_file="$3"
    local mountpoint

    mountpoint="$(volume_mountpoint "${volume}")"
    tar --create --gzip --numeric-owner --acls --xattrs \
        --directory "${mountpoint}" . \
        | age --encrypt --recipient "${recipient}" --output "${output_file}"
    chmod 0600 "${output_file}"
}

restore_encrypted_volume_archive() {
    local archive="$1"
    local identity="$2"
    local volume="$3"
    local mountpoint

    mountpoint="$(volume_mountpoint "${volume}")"
    age --decrypt --identity "${identity}" "${archive}" \
        | tar --extract --gzip --numeric-owner --acls --xattrs \
            --directory "${mountpoint}"
}

refresh_backup_checksums() {
    local output_dir="$1"
    local checksum_temp

    checksum_temp="$(mktemp)"
    (
        cd "${output_dir}"
        find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%P\0' \
            | LC_ALL=C sort -z \
            | xargs -0 --no-run-if-empty sha256sum
    ) > "${checksum_temp}"
    install -m 0600 "${checksum_temp}" "${output_dir}/SHA256SUMS"
    rm -f "${checksum_temp}"
}

require_clean_postgres_volume() {
    local project="$1"
    local volume="$2"
    local mountpoint
    local control_output

    if is_test_project "${project}"; then
        return
    fi

    mountpoint="$(volume_mountpoint "${volume}")"
    [[ "$(<"${mountpoint}/PG_VERSION")" == "15" ]] \
        || die "PostgreSQL volume is not PG_VERSION 15"
    [[ ! -e "${mountpoint}/postmaster.pid" ]] \
        || die "PostgreSQL postmaster.pid still exists"

    control_output="$(docker run --rm \
        --volume "${volume}:/var/lib/postgresql/data:ro" \
        --entrypoint pg_controldata \
        "${POSTGRES_IMAGE}" /var/lib/postgresql/data)"
    grep --quiet 'Database cluster state:.*shut down' <<< "${control_output}" \
        || die "PostgreSQL volume was not shut down cleanly"
}
