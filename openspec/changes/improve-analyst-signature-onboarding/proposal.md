## Why

Managers can create an analyst account, but the current user-management flow does not make the analyst signature requirement visible at creation time. Uploading the signature from the manager session is not safe because the existing upload path intentionally stores signatures for the currently authenticated user.

This change keeps the simpler and more compliant workflow: analysts upload their own electronic signature after first login, while managers get clear Vietnamese onboarding/status cues.

## What Changes

- Show analyst signature status in the manager user list instead of showing signature status only for managers.
- Update the create-user flow so managers understand that analyst signatures are collected by the analyst after login, not uploaded by the manager.
- Add a first-login/profile guidance path for analysts who do not yet have an active signature.
- Preserve the existing signature upload ownership rule: a signature upload belongs to the authenticated user only.
- Preserve the existing submit-for-review guard that blocks analysts without an active signature.
- No database ownership rewrite, service-role upload proxy, or manager-upload-on-behalf workflow is introduced.

## Capabilities

### New Capabilities
- `analyst-signature-onboarding`: Analyst signature readiness and onboarding cues across manager user management, analyst profile, and sample submission readiness.

### Modified Capabilities

## Impact

- UI: `/manager/users`, `UserListTable`, `UserForm`, `UserFormSignatureSection`, analyst/profile signature messaging, and any submit-for-review warning surfaces.
- Server/API: no new mutation contract is required; existing `uploadSignature` remains current-user-only.
- Database/RLS: no schema or policy change is expected. The existing RLS/storage policies that limit signature writes to `auth.uid()` remain the intended compliance boundary.
- Compliance/audit: improves 21 CFR Part 11 posture by avoiding manager-uploaded analyst signatures and making analyst self-attestation explicit.
- Localization: all new manager and analyst-facing copy must be Vietnamese.
