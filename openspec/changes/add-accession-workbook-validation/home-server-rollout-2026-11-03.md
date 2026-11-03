# Home-server application rollout — 2026-11-03

User authorized deployment to test the existing functionality. This rollout updates template generation; the complete import workflow is not implemented.

## Source, build and recovery

- Host `khoa-xn-cdc@100.93.19.42`, checkout `/opt/lims-lite`; SSH BatchMode and `sudo -n docker` only. No Docker operation ran in the source workspace.
- Clean home checkout fast-forwarded from `9d9f193` to reviewed source `00d538957ee601ebe8cb21a8e1927395435b39c8`.
- Previous running image preserved as `lims-lite-app:task9-rollback-9d9f193`: `sha256:cfbce35a146782c2174a72b6c1325507dcc22e3bb388268f54fac3835ba70f38`.
- `sudo -n docker compose -p lims-lite config --quiet`: PASS.
- `sudo -n docker compose -p lims-lite build app`: exit **0**, compile/TypeScript and **39/39** generated pages PASS. Home artifacts: `/tmp/lims-task9-build-00d5389.log` and `.exit`.
- New image: `sha256:8d62927c14dd8715ca35569de7010635f15dd7498476e4d9e12b75e799c871e6`.

## Activation and checks

- `sudo -n docker compose -p lims-lite up -d --no-deps --no-build --force-recreate app` activated the built image; app started **2026-11-03T02:48:08.352353926Z** and became **healthy**.
- Existing nginx configuration tested with `sudo -n docker exec lims-nginx nginx -t`, then reloaded with `nginx -s reload` to resolve the new app address. Nginx container was not recreated.
- Runtime Node **v20.20.2**, UID **1001**, build ID `KMVTvE1LUYzTtttC-m26E`. Existing signing ID `task8-v1`, one configured key, active key shape valid; no key material printed or configuration changed.
- Public checks after reload: `/` **200**, `/coa/access` **200**, `/auth/v1/health` **200**, anonymous `/api/accession/template` **401**, JSON, `Cache-Control: private, no-store`.
- Post-start app log scan: **0** error/fatal/unhandled/exception lines at the check. All **23** unrelated running containers retained their exact IDs and start timestamps, including PostgreSQL, Storage, Tunnel, workers and Plane services.
- Home checkout remained clean at the built source revision. No migration, database query/write, secret rotation, volume operation or cleanup was performed. No rollback was needed; previous rollback assets remain intact.

## User test and proof limits

- On `/analyst/accession`, a legitimate analyst session can test **Tải template Excel**, then inspect the downloaded eight-sheet workbook. Download a fresh workbook: older `t="str"` files do not meet the new parser's shared/inline-string contract.
- The new generator source uses shared strings. Successful authenticated download/workbook contents and deployed no-retention are **NOT VERIFIED** by the anonymous smoke; the user retains the manual check.
- TASK-9 parser has no upload/preview/confirm HTTP or UI entrypoint. TASK-10–13 are still required for an end-to-end import test; parser source tests do not prove deployed import capability.
- TASK-8 **4.4/4.6 remain DEFERRED**. TASK-7 retains production resource policy/capacity, app/proxy upload, database atomicity, idempotency and recovery acceptance.
- Evidence timestamp: **2026-11-03 02:49 UTC**. Later documentation commits are not the source revision of this image.
