#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1090,SC1091
source "${SCRIPT_DIR}/lib.sh"

usage() {
    printf 'Usage: %s --identity FILE --backup-dir DIR --source-project NAME --target-project NAME\n' \
        "$0" >&2
    exit 2
}

identity=""
backup_dir=""
source_project=""
target_project=""

while (($# > 0)); do
    case "$1" in
        --identity)
            identity="${2:-}"
            shift 2
            ;;
        --backup-dir)
            backup_dir="${2:-}"
            shift 2
            ;;
        --source-project)
            source_project="${2:-}"
            shift 2
            ;;
        --target-project)
            target_project="${2:-}"
            shift 2
            ;;
        *)
            usage
            ;;
    esac
done

[[ -n "${identity}" && -n "${backup_dir}" \
    && -n "${source_project}" && -n "${target_project}" ]] || usage

require_command age
require_command docker
require_project "${source_project}"
require_project "${target_project}"
require_tunnel_stopped "${target_project}"

[[ -f "${identity}" ]] || die "age identity file not found"
if ! is_test_project "${target_project}"; then
    [[ "${identity}" == /run/* ]] \
        || die "production age identity must be provided from /run"
fi

[[ -d "${backup_dir}" && -f "${backup_dir}/SHA256SUMS" ]] \
    || die "invalid backup directory"
(
    cd "${backup_dir}"
    sha256sum --check --strict SHA256SUMS >/dev/null
) || die "backup checksum verification failed"

source_postgres_volume="$(project_postgres_volume "${source_project}")"
source_storage_volume="$(project_storage_volume "${source_project}")"
target_postgres_volume="$(project_postgres_volume "${target_project}")"
target_storage_volume="$(project_storage_volume "${target_project}")"

postgres_archive="${backup_dir}/${source_postgres_volume}.tar.gz.age"
storage_archive="${backup_dir}/${source_storage_volume}.tar.gz.age"
[[ -f "${postgres_archive}" && -f "${storage_archive}" ]] \
    || die "expected encrypted archives are missing"

created_volumes=()
cleanup_partial_restore() {
    local exit_code=$?
    local volume

    if ((exit_code != 0)); then
        for volume in "${created_volumes[@]}"; do
            docker volume rm "${volume}" >/dev/null 2>&1 || true
        done
    fi

    exit "${exit_code}"
}
trap cleanup_partial_restore EXIT

for volume in "${target_postgres_volume}" "${target_storage_volume}"; do
    if docker volume inspect "${volume}" >/dev/null 2>&1; then
        volume_is_empty "${volume}" \
            || die "target volume is not empty: ${volume}"
    else
        docker volume create "${volume}" >/dev/null
        created_volumes+=("${volume}")
    fi
    require_cold_volume "${volume}"
done

restore_encrypted_volume_archive \
    "${postgres_archive}" "${identity}" "${target_postgres_volume}"
restore_encrypted_volume_archive \
    "${storage_archive}" "${identity}" "${target_storage_volume}"

trap - EXIT
printf 'Cold restore completed for project: %s\n' "${target_project}"
