## Why

The LIMS needs a read-only business role for doctors who review completed sample outcomes without participating in lab operations. This must be enforced at the database, API, routing, and UI layers so the role cannot discover in-progress work or perform analyst/manager actions.

## What Changes

- Add a `doctor` user role while keeping confidential/HIV access modeled through `users.can_access_confidential`.
- Restrict doctor access to `/samples` only; doctor users are redirected there after login and blocked from analyst, manager, profile, search, and operational pages.
- Show doctors only completed, non-deleted samples; confidential completed samples are visible only when `can_access_confidential = true`.
- Provide a read-only Samples experience for doctors: sample metadata and ready CoA preview only, with no edit, delete, result-entry, result-table, IQC, assignment, search, profile, or settings actions.
- Permit doctors to view ready CoA documents for completed samples while preserving existing analyst/manager CoA behavior and confidentiality guards.
- Add regression and security tests covering doctor route/API/RLS restrictions.

## Capabilities

### New Capabilities
- `doctor-access-control`: Defines the doctor role boundary across login, routing, API action authorization, RLS, and confidentiality handling.

### Modified Capabilities
- `sample-management`: Extends the unified Samples workspace with a doctor-specific completed-only, read-only view.
- `coa-preview`: Allows doctors to preview ready CoA documents for completed samples they are authorized to see.
- `search-capability`: Excludes doctors from global search UI and search APIs because search would exceed the Samples-only access boundary.

## Impact

- Database: new `user_role` enum value, RLS policy changes for `samples`, `coa_reports`, and `storage.objects`, plus `run_security_tests()` coverage.
- Server/auth: login redirects, middleware role routing, dashboard session typing, client action allow/deny handling, and CoA staff-view authorization.
- UI: Vietnamese role labels, user management role selection/list display, Samples read-only doctor mode, doctor-safe header/dropdown, and doctor CoA-only panel.
- Compliance/security: no hard deletes, no permission bypass, no new doctor write paths, and confidential/HIV access remains controlled by `can_access_confidential`.
