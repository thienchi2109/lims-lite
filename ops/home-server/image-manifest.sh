#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1090,SC1091
source "${SCRIPT_DIR}/lib.sh"

manifest="${1:-${SCRIPT_DIR}/runtime-images.tsv}"
[[ -f "${manifest}" ]] || die "runtime image manifest not found"
require_command docker

while IFS=$'\t' read -r service image repository_digest _ architecture _; do
    [[ -n "${service}" && "${service}" != \#* ]] || continue

    actual_architecture="$(docker image inspect "${image}" --format '{{.Architecture}}')"
    actual_digests="$(docker image inspect "${image}" --format '{{json .RepoDigests}}')"

    # Local image IDs differ between classic and containerd image stores.
    [[ "${actual_architecture}" == "${architecture}" ]] \
        || die "image architecture mismatch for service: ${service}"
    grep --fixed-strings --quiet "\"${repository_digest}\"" <<< "${actual_digests}" \
        || die "repository digest mismatch for service: ${service}"
done < "${manifest}"

printf 'Runtime image manifest verification passed\n'
