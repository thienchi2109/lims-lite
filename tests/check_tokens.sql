-- Check current sessions and refresh tokens
-- Usage:
--   docker exec -i lims-postgres psql -U postgres -d postgres < tests/check_tokens.sql
-- Override seconds in psql before running:
--   \set session_timebox_seconds 60
--   \set refresh_token_expiry_seconds 60

\set session_timebox_seconds 14400
\set refresh_token_expiry_seconds 14400

\echo '=== CURRENT SESSIONS ==='
SELECT 
  s.id as session_id,
  au.email,
  s.created_at,
  s.updated_at,
  s.not_after,
  EXTRACT(EPOCH FROM (NOW() - s.created_at)) as age_seconds,
  ROUND(EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 3600, 2) as age_hours,
  (s.created_at + make_interval(secs => :session_timebox_seconds::int)) as timebox_expires_at,
  ROUND(EXTRACT(EPOCH FROM ((s.created_at + make_interval(secs => :session_timebox_seconds::int)) - NOW())) / 60, 2) as minutes_until_timebox_expiry,
  CASE
    WHEN (s.created_at + make_interval(secs => :session_timebox_seconds::int)) < NOW() THEN '❌ TIMEBOX EXPIRED'
    ELSE '✅ TIMEBOX VALID'
  END as timebox_status
FROM auth.sessions s
JOIN auth.users au ON s.user_id = au.id
ORDER BY s.created_at DESC
LIMIT 5;

\echo ''
\echo '=== REFRESH TOKENS (Active) ==='
SELECT 
  rt.id,
  au.email,
  rt.created_at,
  rt.updated_at,
  rt.revoked,
  EXTRACT(EPOCH FROM (NOW() - rt.updated_at)) as age_seconds,
  ROUND(EXTRACT(EPOCH FROM (NOW() - rt.updated_at)) / 3600, 2) as age_hours,
  -- NOTE: In self-hosted GoTrue this behaves like a sliding inactivity timeout.
  (rt.updated_at + make_interval(secs => :refresh_token_expiry_seconds::int)) as calculated_expiry_from_updated_at,
  ROUND(EXTRACT(EPOCH FROM ((rt.updated_at + make_interval(secs => :refresh_token_expiry_seconds::int)) - NOW())) / 3600, 2) as hours_until_expiry,
  CASE 
    WHEN (rt.updated_at + make_interval(secs => :refresh_token_expiry_seconds::int)) < NOW() THEN '❌ EXPIRED'
    ELSE '✅ VALID'
  END as status
FROM auth.refresh_tokens rt
JOIN auth.users au ON rt.user_id::uuid = au.id
WHERE rt.revoked = false
ORDER BY rt.created_at DESC
LIMIT 5;

\echo ''
\echo '=== REFRESH TOKEN STATISTICS ==='
SELECT 
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE revoked = true) as revoked_tokens,
  COUNT(*) FILTER (WHERE revoked = false) as active_tokens,
  COUNT(*) FILTER (WHERE revoked = false AND (updated_at + make_interval(secs => :refresh_token_expiry_seconds::int)) < NOW()) as expired_tokens
FROM auth.refresh_tokens;

\echo ''
\echo '=== CURRENT TIME INFO ==='
SELECT 
  NOW() as current_time,
  (:session_timebox_seconds::int || ' seconds') as configured_session_timebox_seconds,
  (:refresh_token_expiry_seconds::int || ' seconds') as configured_refresh_token_expiry_seconds;
