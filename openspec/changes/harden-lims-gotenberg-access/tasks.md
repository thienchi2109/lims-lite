## 1. Gateway Contract

- [x] 1.1 Add failing unit tests for hard-capped startup policy validation, exact base64url bearer format and digest authentication, route and method restrictions, exact multipart allow-list enforcement, and sanitized metadata-only audit logs
- [x] 1.2 Add failing unit tests for request and response size, header and multipart bounds, rate, concurrency, queue, slow-upload and total timeouts, disconnect cancellation, slot release, upstream errors, and request-ID behavior
- [x] 1.3 Implement the dependency-free Node gateway and hardened container image until the focused gateway tests pass

## 2. Compose Isolation

- [x] 2.1 Add failing configuration tests for two-network segmentation, secret-backed LIMS authentication, absent ports and host networking, absent Tunnel/Tailscale/Funnel routes, non-root and read-only execution, all capabilities dropped, no-new-privileges, and PDF service resource limits
- [x] 2.2 Update Compose, example environment, and Gotenberg hardening until the focused infrastructure tests pass

## 3. Operational Documentation

- [x] 3.1 Add failing documentation contract tests for the threat model, Vietnamese deployment and rollback runbook, Vietnamese future-consumer guide, and explicit Issue #84 handoff
- [x] 3.2 Document secret creation, deployment checks, audit inspection, rollback, Issue #84 Tailscale prerequisites, client examples, error handling, and credential rotation in Vietnamese

## 4. Verification

- [x] 4.1 Run focused gateway and Compose tests plus `docker compose config` without starting containers
- [x] 4.2 Run lint, typecheck, no-explicit-any, and the relevant broader test suite
- [x] 4.3 Complete subagent specification and code-quality review, resolve actionable findings, and rerun affected checks
