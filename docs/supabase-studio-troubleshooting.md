# Supabase Studio Troubleshooting (Local Docker)

## Symptoms
- Supabase Studio shows no tables and network console reports `POST http://localhost:3002/api/platform/pg-meta/default/query?key=schemas 500`.
- `run-lints` endpoint returns 400 and Studio container healthcheck stays `unhealthy`.
- `postgres-meta` logs show `getaddrinfo EAI_AGAIN db` and connection timeouts.

## Root Cause
The Studio container builds its Postgres connection string from environment variables. When `POSTGRES_*` vars are not set, it defaults to host `db` and users `supabase_admin/supabase_read_only_user`, which do not exist in this stack. As a result, pg-meta cannot reach Postgres and Studio cannot list schemas.

## Fix
Provide explicit Postgres connection env vars on the Studio service so pg-meta targets the real database:

- `POSTGRES_HOST=postgres`
- `POSTGRES_PORT=5432`
- `POSTGRES_DB=postgres`
- `POSTGRES_USER_READ_WRITE=postgres`
- `POSTGRES_USER_READ_ONLY=postgres`
- `POSTGRES_PASSWORD=<your POSTGRES_PASSWORD>`

These are now set in `docker-compose.yml`.

## Verification Steps
1. Restart Studio: `docker compose up -d studio`.
2. From inside the Studio container, schema query succeeds:
   ```bash
   docker exec lims-studio node -e "fetch('http://$(hostname):3000/api/platform/pg-meta/default/query?key=schemas',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.SUPABASE_SERVICE_KEY},body:JSON.stringify({query:'select schema_name from information_schema.schemata;'})}).then(async r=>{console.log(r.status);console.log(await r.text());})"
   ```
   Expected: HTTP 200 with schema list.
3. Lints endpoint returns 200:
   ```bash
   docker exec lims-studio node -e "fetch('http://$(hostname):3000/api/platform/projects/default/run-lints',{headers:{Authorization:'Bearer '+process.env.SUPABASE_SERVICE_KEY}}).then(async r=>{console.log(r.status);console.log((await r.text()).slice(0,200));})"
   ```

## Note on Healthcheck
Studio now includes a custom healthcheck that pings `http://$HOSTNAME:3000` (root path) to reflect the real bind address. If you tweak ports/hostnames, update the healthcheck to match.
