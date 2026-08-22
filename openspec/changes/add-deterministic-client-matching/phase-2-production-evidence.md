# Phase 2 Production Evidence

Date: 2026-08-22

- Additive lifecycle workflow landed through PR #119 at `b8e6280`.
- Runtime rollback fixture corrections landed through PR #120 at `d6108f9`.
- Migration 217 added the explicit deny-all adjudication policy through PR #121
  at `a710bf1`; `run_security_tests()` then passed 35/35.
- Manager browser smoke passed through the real OTP route and rendered the
  Vietnamese lifecycle workspace. Analyst access to `/manager/clients` was
  redirected to `/analyst`.
- Migration 218 failed its baseline before changing production because it
  referenced future-phase columns. It is immutable at checksum
  `114c3d16ec0cc81e8bc2fc0877011b522429ca8740fa32989d01b79d4d8bee3c`.
- Migration 219 superseded 218 using the verified live catalog and applied at
  checksum `bbc988b4b521fa86f12c3521a4e263410c6269e2f8c6717fba1183c18f9b0738`.
- Authenticated callers retain UPDATE only for `id_card_num`, `name`,
  `date_of_birth`, `gender`, `phone`, `address`, `health_insurance_num`, and
  `expiry_date`. Hard DELETE, TRUNCATE, broad UPDATE, canonical identity fields,
  and lifecycle fields are blocked.
- Post-guard rollback SQL suites passed and ended in `ROLLBACK`;
  `run_security_tests()` passed 35/35; focused UI/lifecycle tests passed 24/24;
  typecheck and no-explicit-any passed; lint had zero errors with existing
  warnings; production health and manager/analyst browser smoke passed.

Residual risk: lifecycle collision discovery is O(n^2). This is acceptable for
the current production population of 63 clients, but it is not the long-term
scaling design.

Phase 3 was not started.
