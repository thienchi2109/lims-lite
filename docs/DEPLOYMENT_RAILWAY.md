# Deploying Supabase on Railway

This guide provides step-by-step instructions to deploy your self-hosted Supabase stack to [Railway](https://railway.app/).

## Prerequisites

- A [Railway](https://railway.app/) account
- [Railway CLI](https://docs.railway.app/guides/cli) installed (optional, but recommended)
- Your project files:
  - `railway-docker-compose.yml`
  - `supabase/kong.yml`

## Step 1: Prepare Your Project

Ensure your `railway-docker-compose.yml` is in the root of your project. This file is already configured to work with Railway's requirements.

## Step 2: Create a New Project on Railway

1.  Log in to your [Railway Dashboard](https://railway.app/dashboard).
2.  Click **New Project**.
3.  Select **Deploy from GitHub repo**.
4.  Select your repository (`lims-lite`).
5.  **IMPORTANT**: Railway will try to auto-detect the project type. We need to tell it to use our specific docker-compose file.

## Step 3: Configure the Service

1.  Click on the newly created service card in the Railway canvas.
2.  Go to **Settings**.
3.  Scroll down to **Service** section.
4.  Find **Docker Compose File** setting.
5.  Enter `railway-docker-compose.yml`.
6.  Railway should detect the services defined in the file (`postgres`, `auth`, `rest`, `storage`, `kong`).

## Step 4: Set Environment Variables

You need to set the following environment variables in the **Variables** tab of your Railway project. You can set these in the "Shared" variables section so they apply to all services, or set them specifically where needed.

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `POSTGRES_PASSWORD` | Secure password for the database | `your-secure-password-here` |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) | `your-super-secret-jwt-token-32-chars` |
| `ANON_KEY` | Your Supabase Anon Key | (Generate one or use existing) |
| `SERVICE_ROLE_KEY` | Your Supabase Service Role Key | (Generate one or use existing) |
| `API_EXTERNAL_URL` | URL of your Kong service | `https://your-project.up.railway.app` |
| `SITE_URL` | URL of your frontend app | `https://your-app.onrender.com` |
| `ADDITIONAL_REDIRECT_URLS` | Redirect URLs for auth | `https://your-app.onrender.com/**` |

> **Note**: You won't know your `API_EXTERNAL_URL` until *after* the first deployment attempts to start. You can deploy first, get the domain, update the variable, and redeploy.

### Security requirements for production variables

- Do not use demo/fallback credentials for `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, or `POSTGRES_PASSWORD`.
- Store all secrets in Railway Variables (never in Git).
- Rotate related auth/database secrets together during a maintenance window.

#### Rotation checklist

1. Generate new values for `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, and `POSTGRES_PASSWORD`.
2. Update Railway Variables for affected services.
3. Redeploy all Supabase services so no process keeps stale secrets.
4. Verify `/auth/v1/token` login works and old tokens are rejected.
5. Keep an incident note with rotation time, operator, and verification result.

## Step 5: Expose the Kong Service

The `kong` service acts as the API Gateway (the single entry point) for Supabase.

1.  In the Railway canvas, click on the `kong` service.
2.  Go to **Settings**.
3.  Under **Networking**, click **Generate Domain**.
4.  This will create a URL like `kong-production-xxxx.up.railway.app`.
5.  **Copy this URL** and update the `API_EXTERNAL_URL` variable in your variables settings.

## Step 6: Verify Deployment

Once the deployment finishes (all services are green):

1.  Check the logs of the `kong` service to ensure it started correctly.
2.  Visit your Kong URL: `https://your-kong-url.up.railway.app`. You should see a 404 from Kong (which is normal for the root path) or a specific response depending on configuration.
3.  Test the health endpoint: `https://your-kong-url.up.railway.app/rest/v1/` (should return Supabase API documentation or info).

### Cloudflare hardening for public API paths

If Railway service is internet-facing, add Cloudflare protections for:
- `/auth/v1`
- `/rest/v1`
- `/storage/v1`
- `/realtime/v1`

Minimum policy set:
1. WAF managed rules enabled.
2. Rate limiting on `/auth/v1/token` and `/auth/v1/signup`.
3. Alerting for high 401/403/429 rates.
4. Access control for any admin-only routes if exposed.

## Step 7: Run Migrations

You need to set up the database schema.

1.  Install the Railway CLI if you haven't: `npm i -g @railway/cli`
2.  Login: `railway login`
3.  Link your project: `railway link`
4.  Run the migrations using `psql`:

```bash
railway run psql -h postgres -U postgres -f supabase/migrations/00000000000000_initial_schema.sql
```

*Note: You may need to adjust the migration filename based on what's in your `supabase/migrations` folder.*

## Step 8: Connect Your Next.js App

Update your Next.js application configuration (e.g., on Render) to point to your new Railway Supabase instance.

- `NEXT_PUBLIC_SUPABASE_URL`: `https://your-kong-url.up.railway.app`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The `ANON_KEY` you set in Step 4.
