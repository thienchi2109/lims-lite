#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1090,SC1091
source "${SCRIPT_DIR}/lib.sh"

usage() {
    cat >&2 <<EOF
Usage:
  $0 logical --project NAME --output-dir DIR --recipient AGE_RECIPIENT
  $0 cold --project NAME --output-dir DIR --recipient AGE_RECIPIENT
EOF
    exit 2
}

mode="${1:-}"
[[ "${mode}" == "logical" || "${mode}" == "cold" ]] || usage
shift

project=""
output_dir=""
recipient=""

while (($# > 0)); do
    case "$1" in
        --project)
            project="${2:-}"
            shift 2
            ;;
        --output-dir)
            output_dir="${2:-}"
            shift 2
            ;;
        --recipient)
            recipient="${2:-}"
            shift 2
            ;;
        *)
            usage
            ;;
    esac
done

[[ -n "${project}" && -n "${output_dir}" && -n "${recipient}" ]] || usage

require_command age
require_command docker
require_project "${project}"
require_tunnel_stopped "${project}"
require_root

postgres_volume="$(project_postgres_volume "${project}")"
storage_volume="$(project_storage_volume "${project}")"

umask 077
mkdir -p "${output_dir}"
chmod 0700 "${output_dir}"

if [[ "${mode}" == "logical" ]]; then
    [[ "${project}" == "${PRODUCTION_PROJECT}" ]] \
        || die "logical backup is supported only for the production project"
    [[ "$(docker inspect lims-postgres \
        --format '{{.State.Running}}' 2>/dev/null || true)" == "true" ]] \
        || die "PostgreSQL container must be running for logical backup"
    [[ ! -e "${output_dir}/postgres.dump.age" ]] \
        || die "logical database backup already exists"
    [[ ! -e "${output_dir}/globals.sql.age" ]] \
        || die "global database backup already exists"

    docker exec lims-postgres \
        pg_dump -U postgres -d postgres --format=custom \
        | age --encrypt --recipient "${recipient}" \
            --output "${output_dir}/postgres.dump.age"
    docker exec lims-postgres \
        pg_dumpall -U postgres --globals-only \
        | age --encrypt --recipient "${recipient}" \
            --output "${output_dir}/globals.sql.age"
    printf '%s' "${recipient}" \
        | sha256sum \
        | awk '{print "age_recipient_sha256=" $1}' \
        > "${output_dir}/recovery-recipient.manifest"
    chmod 0600 \
        "${output_dir}/postgres.dump.age" \
        "${output_dir}/globals.sql.age" \
        "${output_dir}/recovery-recipient.manifest"
    refresh_backup_checksums "${output_dir}"
    printf 'Encrypted logical backups created: %s\n' "${output_dir}"
    exit 0
fi

require_volume "${postgres_volume}"
require_volume "${storage_volume}"
require_cold_volume "${postgres_volume}"
require_cold_volume "${storage_volume}"
require_clean_postgres_volume "${project}" "${postgres_volume}"

postgres_manifest="${output_dir}/${postgres_volume}.files.sha256"
storage_manifest="${output_dir}/${storage_volume}.files.sha256"
postgres_archive="${output_dir}/${postgres_volume}.tar.gz.age"
storage_archive="${output_dir}/${storage_volume}.tar.gz.age"
for output_file in \
    "${postgres_manifest}" "${storage_manifest}" \
    "${postgres_archive}" "${storage_archive}"; do
    [[ ! -e "${output_file}" ]] || die "backup artifact already exists: ${output_file}"
done

write_volume_manifest "${postgres_volume}" "${postgres_manifest}"
write_volume_manifest "${storage_volume}" "${storage_manifest}"
create_encrypted_volume_archive "${postgres_volume}" "${recipient}" "${postgres_archive}"
create_encrypted_volume_archive "${storage_volume}" "${recipient}" "${storage_archive}"

refresh_backup_checksums "${output_dir}"

printf 'Encrypted cold backup created: %s\n' "${output_dir}"
