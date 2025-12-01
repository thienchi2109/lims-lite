-- Check current sessions and refresh tokens

\echo '=== CURRENT SESSIONS ==='
SELECT 
  s.id as session_id,
  au.email,
  s.created_at,
  s.updated_at,
  s.not_after,
  EXTRACT(EPOCH FROM (NOW() - s.created_at)) as age_seconds,
  ROUND(EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 3600, 2) as age_hours
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
  -- Calculate when it should expire (14400 seconds = 4 hours)
  (rt.updated_at + INTERVAL '14400 seconds') as calculated_expiry,
  ROUND(EXTRACT(EPOCH FROM ((rt.updated_at + INTERVAL '14400 seconds') - NOW())) / 3600, 2) as hours_until_expiry,
  CASE 
    WHEN (rt.updated_at + INTERVAL '14400 seconds') < NOW() THEN '❌ EXPIRED'
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
  COUNT(*) FILTER (WHERE revoked = false AND (updated_at + INTERVAL '14400 seconds') < NOW()) as expired_tokens
FROM auth.refresh_tokens;

\echo ''
\echo '=== CURRENT TIME INFO ==='
SELECT 
  NOW() as current_time,
  '14400 seconds (4 hours)' as refresh_token_expiry_setting;
