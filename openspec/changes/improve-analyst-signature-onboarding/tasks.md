## 1. RED: Lock Expected Behavior With Tests

- [x] 1.1 Add focused user-management UI tests proving analyst rows show active/missing signature readiness and doctor rows do not show a signature requirement.
- [x] 1.2 Add a create-user form test proving the analyst role shows Vietnamese self-service signature guidance and does not call `uploadSignatureClient`.
- [x] 1.3 Add or update analyst profile/submit readiness tests proving missing-signature guidance points analysts to the profile signature upload surface.

## 2. Manager User-Management UI

- [x] 2.1 Update signature readiness derivation so roles that can own signatures (`manager`, `analyst`) show active/missing status from `user_signatures`.
- [x] 2.2 Update table labels/tooltips/accessibility text in Vietnamese for analyst signature readiness.
- [x] 2.3 Update the create-user signature section so selecting `analyst` shows guidance instead of a file upload field.

## 3. Analyst Guidance Surfaces

- [x] 3.1 Add profile-page guidance for analysts without an active signature, while keeping the existing signature upload component as the action path.
- [x] 3.2 Improve missing-signature submit feedback so analysts understand they must upload a signature from `Hồ sơ`.
- [x] 3.3 Confirm the upload action remains current-user-only and no manager target-user upload path is introduced.

## 4. Verification

- [x] 4.1 Run focused tests covering user management and analyst signature guidance.
- [x] 4.2 Run `npm run typecheck`.
- [x] 4.3 Run `npm run lint` if touched files are covered by lint configuration and the repo baseline permits it.
- [x] 4.4 If implementation unexpectedly changes SQL/RLS/storage policy, run the migration security checklist and `SELECT * FROM run_security_tests();` (not applicable: no SQL/RLS/storage change).
