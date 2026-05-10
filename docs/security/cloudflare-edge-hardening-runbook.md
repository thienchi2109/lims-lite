# Cloudflare Edge Hardening Runbook (Issue #42)

This runbook defines the required Cloudflare edge controls for public Supabase API paths:

- `/auth/v1`
- `/rest/v1`
- `/storage/v1`
- `/realtime/v1`

> Scope: this repository already applies origin-side controls (loopback-only internal ports and Nginx rate limits).  
> This runbook covers edge controls that must be applied in Cloudflare by an owner with zone permissions.

## 1) Access Policy (admin-only surfaces)

If any admin routes are exposed publicly, require Cloudflare Access:

- `/studio/*`
- `/meta/*`
- any future admin/ops endpoints

Policy baseline:

1. Action: **Allow**
2. Include: approved emails/groups only
3. Default: **Deny**

## 2) WAF Managed Rules

For the production hostname:

1. Enable Cloudflare Managed Ruleset.
2. Enable OWASP core managed rules.
3. Keep action in `block` for high-confidence attack classes.

## 3) Rate Limiting Rules (edge)

Create the following rate-limit rules in Cloudflare:

1. **Auth token endpoint**
   - Match: `http.request.uri.path eq "/auth/v1/token"`
   - Threshold: 10 requests / minute per IP
   - Action: Block (or Managed Challenge, depending on UX tolerance)

2. **Signup endpoint**
   - Match: `http.request.uri.path eq "/auth/v1/signup"`
   - Threshold: 5 requests / minute per IP
   - Action: Block

3. **Global Supabase API safety net**
   - Match: `http.request.uri.path matches "^/(auth|rest|storage|realtime)/v1"`
   - Threshold: 120 requests / minute per IP
   - Action: Block

## 4) Abuse Alerting

Configure Cloudflare notifications (or SIEM alerts) for:

1. Spike in 429 rate-limit events
2. Spike in 401/403 on `/auth/v1/token`
3. Sudden increase of requests on `/auth/v1/signup`

Recommended minimum thresholds (tune to production traffic):

- 429 > 100 events / 5 minutes
- 401 or 403 > 200 events / 5 minutes on `/auth/v1/token`
- Signup attempts > 30 / 5 minutes from same ASN or country anomaly

## 5) Deployment Secret Controls

This stack is fail-closed for critical secrets in Compose (`${VAR:?required}`).

Operational requirements:

1. Keep secrets only in deployment secret manager (never Git).
2. Rotate `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, and `POSTGRES_PASSWORD` together.
3. Recreate impacted services after rotation so no process keeps stale values.
4. Treat existing auth sessions as invalid after JWT secret rotation.

## 6) Verification Checklist

After applying Cloudflare rules:

1. Unknown origins are blocked by CORS as expected.
2. Brute-force simulation on `/auth/v1/token` gets edge 429/challenge.
3. Burst traffic to `/rest/v1` hits configured rate-limit.
4. Alert pipeline receives at least one test signal.
5. Normal user login and API usage remain functional.

## 7) Ownership Note

Cloudflare rule application requires zone-level credentials that are intentionally not stored in this repository.  
Repository changes provide policy baseline and origin-side controls; edge enforcement must be applied by infrastructure owners.
