#!/usr/bin/env bash

set -Eeuo pipefail

readonly EXPECTED_USER="khoa-xn-cdc"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://cdclims.cloud}"

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

[[ "$(id -un)" == "${EXPECTED_USER}" ]] \
    || die "deploy must run as ${EXPECTED_USER}"
command -v flock >/dev/null 2>&1 || die "flock is required"
command -v git >/dev/null 2>&1 || die "git is required"
sudo -n true >/dev/null 2>&1 || die "passwordless sudo is required"

mkdir -p "${HOME}/.cache"
exec 9>"${HOME}/.cache/lims-lite-deploy.lock"
flock --nonblock 9 || die "another deployment is already running"

cd "${REPO_DIR}"
[[ "$(git branch --show-current)" == "main" ]] || die "checkout must be on main"
[[ -z "$(git status --porcelain)" ]] || die "checkout must be clean"

export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -i ${HOME}/.ssh/lims-lite-deploy -o IdentitiesOnly=yes}"
git fetch origin main

current_commit="$(git rev-parse HEAD)"
target_commit="$(git rev-parse origin/main)"
git merge-base --is-ancestor "${current_commit}" "${target_commit}" \
    || die "origin/main is not a fast-forward update"

mapfile -t migration_changes < <(
    git diff --name-only "${current_commit}..${target_commit}" -- supabase/migrations/
)
if ((${#migration_changes[@]} > 0)); then
    [[ "${REVIEWED_MIGRATION_COMMIT:-}" == "${target_commit}" ]] \
        || die "database migrations require review; rerun with REVIEWED_MIGRATION_COMMIT=${target_commit}"
fi

rollback_image="lims-lite-app:rollback-${current_commit:0:12}"
deployment_started=0

rollback() {
    local exit_code=$?

    trap - ERR
    if ((deployment_started == 1)); then
        printf 'Deployment verification failed; restoring %s\n' "${current_commit}" >&2
        git reset --hard "${current_commit}" >/dev/null
        sudo -n docker tag "${rollback_image}" lims-lite-app:latest
        sudo -n docker compose -p lims-lite up -d \
            --no-deps --force-recreate app nginx
    fi

    exit "${exit_code}"
}
trap rollback ERR

sudo -n docker image inspect lims-lite-app:latest >/dev/null
sudo -n docker tag lims-lite-app:latest "${rollback_image}"

git merge --ff-only origin/main
deployment_started=1

sudo -n docker compose -p lims-lite build app
sudo -n docker compose -p lims-lite up -d \
    --no-deps --force-recreate app nginx

sudo -n docker exec lims-nginx wget -qO- \
    http://127.0.0.1/ >/dev/null
sudo -n docker exec lims-nginx wget -qO- \
    http://127.0.0.1/auth/v1/health >/dev/null
sudo -n docker exec lims-nginx wget -qO- \
    http://127.0.0.1/coa/access \
    | grep --quiet 'CDC LIMS'
curl --fail --silent --show-error --max-time 30 \
    "${PUBLIC_BASE_URL}/auth/v1/health" >/dev/null

trap - ERR
printf 'Deployment completed: %s\n' "$(git rev-parse HEAD)"
