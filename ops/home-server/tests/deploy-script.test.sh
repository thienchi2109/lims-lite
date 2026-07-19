#!/usr/bin/env bash

set -Eeuo pipefail

readonly OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DEPLOY_SCRIPT="${OPS_DIR}/deploy.sh"

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

retry_function="$(
    awk '/^retry_command\(\) \{/,/^}/ { print }' "${DEPLOY_SCRIPT}"
)"
[[ -n "${retry_function}" ]] || fail "deploy script must define retry_command"
eval "${retry_function}"

attempt_count=0
eventually_succeeds() {
    ((attempt_count += 1))
    ((attempt_count >= 3))
}

DEPLOY_VERIFY_ATTEMPTS=3 \
DEPLOY_VERIFY_DELAY_SECONDS=0 \
    retry_command "temporary failure" eventually_succeeds
[[ "${attempt_count}" -eq 3 ]] \
    || fail "retry_command did not retry until success"

attempt_count=0
always_fails() {
    ((attempt_count += 1))
    return 1
}

if DEPLOY_VERIFY_ATTEMPTS=3 \
    DEPLOY_VERIFY_DELAY_SECONDS=0 \
    retry_command "persistent failure" always_fails; then
    fail "retry_command unexpectedly accepted a persistent failure"
fi
[[ "${attempt_count}" -eq 3 ]] \
    || fail "retry_command did not stop at the configured attempt limit"

printf 'PASS: deploy verification retries are bounded\n'
