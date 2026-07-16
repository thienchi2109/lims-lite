#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1090,SC1091
source "${SCRIPT_DIR}/lib.sh"

usage() {
    cat >&2 <<'EOF'
Usage:
  verify.sh compare-volume-manifests --backup-dir DIR --source-project NAME --target-project NAME
  verify.sh assert-return-volumes --postgres-volume NAME --storage-volume NAME
  verify.sh database-manifest (--output-manifest FILE | --expected-manifest FILE)
  verify.sh image-manifest [MANIFEST]
  verify.sh coa-portal --base-url URL --phone-file FILE --sample-id ID \
    (--output-manifest FILE | --expected-manifest FILE)
EOF
    exit 2
}

compare_volume_manifests() {
    local backup_dir=""
    local source_project=""
    local target_project=""
    local temp_dir

    while (($# > 0)); do
        case "$1" in
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

    [[ -n "${backup_dir}" && -n "${source_project}" && -n "${target_project}" ]] \
        || usage
    require_project "${source_project}"
    require_project "${target_project}"

    source_postgres_volume="$(project_postgres_volume "${source_project}")"
    source_storage_volume="$(project_storage_volume "${source_project}")"
    target_postgres_volume="$(project_postgres_volume "${target_project}")"
    target_storage_volume="$(project_storage_volume "${target_project}")"

    require_volume "${target_postgres_volume}"
    require_volume "${target_storage_volume}"

    temp_dir="$(mktemp -d)"
    trap 'rm -rf "${temp_dir}"' RETURN

    write_volume_manifest \
        "${target_postgres_volume}" "${temp_dir}/${source_postgres_volume}.files.sha256"
    write_volume_manifest \
        "${target_storage_volume}" "${temp_dir}/${source_storage_volume}.files.sha256"

    cmp \
        "${backup_dir}/${source_postgres_volume}.files.sha256" \
        "${temp_dir}/${source_postgres_volume}.files.sha256"
    cmp \
        "${backup_dir}/${source_storage_volume}.files.sha256" \
        "${temp_dir}/${source_storage_volume}.files.sha256"
}

assert_return_volumes() {
    local postgres_volume=""
    local storage_volume=""

    while (($# > 0)); do
        case "$1" in
            --postgres-volume)
                postgres_volume="${2:-}"
                shift 2
                ;;
            --storage-volume)
                storage_volume="${2:-}"
                shift 2
                ;;
            *)
                usage
                ;;
        esac
    done

    [[ -n "${postgres_volume}" && -n "${storage_volume}" ]] || usage
    [[ "${postgres_volume}" != "${PRODUCTION_POSTGRES_VOLUME}" ]] \
        || die "return PostgreSQL volume must differ from production"
    [[ "${storage_volume}" != "${PRODUCTION_STORAGE_VOLUME}" ]] \
        || die "return Storage volume must differ from production"
    [[ "${postgres_volume}" =~ ^lims-lite-return-[a-z0-9-]+$ ]] \
        || die "invalid return PostgreSQL volume"
    [[ "${storage_volume}" =~ ^lims-lite-return-[a-z0-9-]+$ ]] \
        || die "invalid return Storage volume"
    [[ "${postgres_volume}" != "${storage_volume}" ]] \
        || die "return volumes must be distinct"
}

verify_coa_portal() {
    local base_url=""
    local phone_file=""
    local sample_id=""
    local output_manifest=""
    local expected_manifest=""
    local phone
    local phone_mode
    local temp_dir
    local current_manifest

    while (($# > 0)); do
        case "$1" in
            --base-url)
                base_url="${2:-}"
                shift 2
                ;;
            --phone-file)
                phone_file="${2:-}"
                shift 2
                ;;
            --sample-id)
                sample_id="${2:-}"
                shift 2
                ;;
            --output-manifest)
                output_manifest="${2:-}"
                shift 2
                ;;
            --expected-manifest)
                expected_manifest="${2:-}"
                shift 2
                ;;
            *)
                usage
                ;;
        esac
    done

    [[ -n "${base_url}" && -n "${phone_file}" && -n "${sample_id}" ]] || usage
    [[ -z "${output_manifest}" || -z "${expected_manifest}" ]] || usage
    [[ -n "${output_manifest}" || -n "${expected_manifest}" ]] || usage
    [[ "${base_url}" =~ ^https?://[^/@]+(:[0-9]+)?$ ]] \
        || die "base URL must contain only scheme and host"
    [[ "${sample_id}" =~ ^[a-zA-Z0-9-]+$ ]] || die "invalid sample ID"

    require_command curl
    require_command python3
    [[ -f "${phone_file}" ]] || die "CoA phone file not found"
    phone_mode="$(stat -c '%a' "${phone_file}")"
    (( (8#${phone_mode} & 077) == 0 )) \
        || die "CoA phone file must not be group/world accessible"
    if [[ "${LIMS_ALLOW_TEST_PROJECT:-0}" != "1" ]]; then
        [[ "${phone_file}" == /run/* ]] \
            || die "production CoA phone file must be provided from /run"
    fi

    phone="$(tr -d '\r\n' < "${phone_file}")"
    [[ "${phone}" =~ ^(0[0-9]{9}|\+84[0-9]{9})$ ]] \
        || die "CoA phone file contains an invalid phone number"

    base_url="${base_url%/}"
    umask 077
    temp_dir="$(mktemp -d)"
    trap 'rm -rf "${temp_dir}"' EXIT

    curl --fail --silent --show-error --location --max-time 30 \
        --output "${temp_dir}/portal.html" \
        "${base_url}/coa/access"
    grep --quiet 'CDC LIMS' "${temp_dir}/portal.html" \
        || die "CoA portal page marker not found"

    printf '{"phone":"%s"}' "${phone}" \
        | curl --fail --silent --show-error --max-time 30 \
            --header 'Content-Type: application/json' \
            --cookie-jar "${temp_dir}/cookies.txt" \
            --data-binary @- \
            --output "${temp_dir}/authenticate.json" \
            "${base_url}/api/coa/authenticate"

    python3 - "${temp_dir}/authenticate.json" "${sample_id}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as response_file:
    response = json.load(response_file)

sample_id = sys.argv[2]
samples = response.get("samples", [])
matching_sample = next(
    (sample for sample in samples if sample.get("id") == sample_id),
    None,
)

if response.get("success") is not True:
    raise SystemExit("CoA authentication did not succeed")
if matching_sample is None or matching_sample.get("has_coa") is not True:
    raise SystemExit("expected sample does not have a ready CoA")
PY

    curl --fail --silent --show-error --location --max-time 30 \
        --cookie "${temp_dir}/cookies.txt" \
        --output "${temp_dir}/report.html" \
        "${base_url}/api/coa/download?sample_id=${sample_id}"

    current_manifest="${temp_dir}/coa-portal.manifest"
    {
        printf 'format=lims-coa-portal-v1\n'
        printf 'portal_route=ok\n'
        printf 'sample_id_sha256=%s\n' \
            "$(printf '%s' "${sample_id}" | sha256sum | awk '{print $1}')"
        printf 'report_sha256=%s\n' \
            "$(sha256sum "${temp_dir}/report.html" | awk '{print $1}')"
        printf 'report_bytes=%s\n' "$(stat -c '%s' "${temp_dir}/report.html")"
    } > "${current_manifest}"
    chmod 0600 "${current_manifest}"

    if [[ -n "${output_manifest}" ]]; then
        [[ ! -e "${output_manifest}" ]] \
            || die "output CoA manifest already exists"
        install -m 0600 "${current_manifest}" "${output_manifest}"
    else
        [[ -f "${expected_manifest}" ]] || die "expected CoA manifest not found"
        cmp "${expected_manifest}" "${current_manifest}" \
            || die "CoA portal result differs from the source baseline"
    fi

    rm -rf "${temp_dir}"
    trap - EXIT
    printf 'CoA portal verification passed\n'
}

case "${1:-}" in
    compare-volume-manifests)
        shift
        compare_volume_manifests "$@"
        ;;
    assert-return-volumes)
        shift
        assert_return_volumes "$@"
        ;;
    coa-portal)
        shift
        verify_coa_portal "$@"
        ;;
    database-manifest)
        shift
        exec "${SCRIPT_DIR}/database-manifest.sh" "$@"
        ;;
    image-manifest)
        shift
        exec "${SCRIPT_DIR}/image-manifest.sh" "$@"
        ;;
    *)
        usage
        ;;
esac
