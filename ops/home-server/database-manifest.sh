#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1090,SC1091
source "${SCRIPT_DIR}/lib.sh"

usage() {
    printf 'Usage: %s (--output-manifest FILE | --expected-manifest FILE)\n' "$0" >&2
    exit 2
}

output_manifest=""
expected_manifest=""

while (($# > 0)); do
    case "$1" in
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

[[ -z "${output_manifest}" || -z "${expected_manifest}" ]] || usage
[[ -n "${output_manifest}" || -n "${expected_manifest}" ]] || usage

require_root
require_project "${PRODUCTION_PROJECT}"
require_command docker
[[ "$(docker inspect lims-postgres \
    --format '{{.State.Running}}' 2>/dev/null || true)" == "true" ]] \
    || die "PostgreSQL container is not running"

umask 077
temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT
current_manifest="${temp_dir}/database.manifest"

docker exec -i lims-postgres psql \
    -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
    > "${current_manifest}" <<'SQL'
\pset tuples_only on
\pset format unaligned

CREATE FUNCTION pg_temp.emit_query_manifest(p_key text, p_query text)
RETURNS TABLE(line text)
LANGUAGE plpgsql
AS $$
DECLARE
    manifest_count bigint;
    manifest_hash text;
BEGIN
    EXECUTE format(
        'WITH source_rows AS (%s),
         row_hashes AS (
             SELECT encode(digest(to_jsonb(source_row)::text, ''sha256''), ''hex'') AS row_hash
             FROM source_rows AS source_row
         )
         SELECT count(*),
                encode(
                    digest(coalesce(string_agg(row_hash, '''' ORDER BY row_hash), ''''), ''sha256''),
                    ''hex''
                )
         FROM row_hashes',
        p_query
    )
    INTO manifest_count, manifest_hash;

    line := p_key || '.count=' || manifest_count;
    RETURN NEXT;
    line := p_key || '.sha256=' || manifest_hash;
    RETURN NEXT;
END;
$$;

SELECT 'format=lims-database-manifest-v1';
SELECT 'postgres.server_version=' || current_setting('server_version');
SELECT 'postgres.block_size=' || current_setting('block_size');
SELECT 'postgres.wal_segment_size=' || current_setting('wal_segment_size');

SELECT line FROM pg_temp.emit_query_manifest('table.auth.users', 'SELECT * FROM auth.users');
SELECT line FROM pg_temp.emit_query_manifest('table.auth.identities', 'SELECT * FROM auth.identities');
SELECT line FROM pg_temp.emit_query_manifest('table.auth.sessions', 'SELECT * FROM auth.sessions');
SELECT line FROM pg_temp.emit_query_manifest('table.auth.refresh_tokens', 'SELECT * FROM auth.refresh_tokens');
SELECT line FROM pg_temp.emit_query_manifest('table.auth.mfa_factors', 'SELECT * FROM auth.mfa_factors');
SELECT line FROM pg_temp.emit_query_manifest('table.public.users', 'SELECT * FROM public.users');
SELECT line FROM pg_temp.emit_query_manifest(
    'table.public.manager_otp_settings',
    'SELECT * FROM public.manager_otp_settings'
);
SELECT line FROM pg_temp.emit_query_manifest(
    'table.public.manager_otp_challenges',
    'SELECT * FROM public.manager_otp_challenges'
);
SELECT line FROM pg_temp.emit_query_manifest(
    'table.public.user_signatures',
    'SELECT * FROM public.user_signatures'
);
SELECT line FROM pg_temp.emit_query_manifest(
    'table.storage.objects.coa_and_signatures',
    $$SELECT * FROM storage.objects
      WHERE bucket_id IN ('user-signatures', 'coa-reports')$$
);

SELECT 'role.' || role || '=' || count(*)
FROM public.users
GROUP BY role
ORDER BY role;

SELECT 'orphan.public_users_without_auth=' || count(*)
FROM public.users AS profile
LEFT JOIN auth.users AS account ON account.id = profile.id
WHERE account.id IS NULL;

SELECT 'orphan.auth_users_without_profile=' || count(*)
FROM auth.users AS account
LEFT JOIN public.users AS profile ON profile.id = account.id
WHERE profile.id IS NULL;

SELECT 'orphan.signatures_without_user=' || count(*)
FROM public.user_signatures AS signature
LEFT JOIN public.users AS profile ON profile.id = signature.user_id
WHERE profile.id IS NULL;

SELECT 'storage.' || bucket_id || '.count=' || count(*)
FROM storage.objects
WHERE bucket_id IN ('user-signatures', 'coa-reports')
GROUP BY bucket_id
ORDER BY bucket_id;

SELECT 'storage.' || bucket_id || '.bytes=' ||
       coalesce(sum(
           CASE
               WHEN metadata->>'size' ~ '^[0-9]+$' THEN (metadata->>'size')::bigint
               ELSE 0
           END
       ), 0)
FROM storage.objects
WHERE bucket_id IN ('user-signatures', 'coa-reports')
GROUP BY bucket_id
ORDER BY bucket_id;

SELECT 'extension.' || extname || '=' || extversion
FROM pg_extension
WHERE extname IN ('pgcrypto', 'plpgsql', 'unaccent', 'uuid-ossp')
ORDER BY extname;
SQL

chmod 0600 "${current_manifest}"

if [[ -n "${output_manifest}" ]]; then
    [[ ! -e "${output_manifest}" ]] || die "output database manifest already exists"
    install -m 0600 "${current_manifest}" "${output_manifest}"
else
    [[ -f "${expected_manifest}" ]] || die "expected database manifest not found"
    cmp "${expected_manifest}" "${current_manifest}" \
        || die "database state differs from the source baseline"
fi

rm -rf "${temp_dir}"
trap - EXIT
printf 'Database manifest verification passed\n'
