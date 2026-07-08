## 1. Database Contract

- [ ] 1.1 Add a Supabase migration that updates `get_assay_definitions` to return `normal_range` while preserving existing `SECURITY DEFINER`, `search_path`, grants, revokes, and security-impact comments.
- [ ] 1.2 Update `get_assay_definition_by_id` to return `normal_range` with the same RPC security patterns.
- [ ] 1.3 Add or update SQL regression coverage for the assay RPC row shape and manager-only write expectations.

## 2. Backend And Client Data Flow

- [ ] 2.1 Extend assay query result types and mapping in `src/app/actions/assay-queries.ts` so list/detail responses include `normal_range`.
- [ ] 2.2 Extend assay create/update validation and persistence in `src/app/actions/assay-mutations.ts`, normalizing trimmed empty text to `null`.
- [ ] 2.3 Extend `/api/client-actions` assay create/update payload mapping so `normal_range` is appended even when clearing the field with an empty string.
- [ ] 2.4 Extend `src/lib/api-client.ts` assay create/update payload types with `normalRange`.

## 3. Manager UI

- [ ] 3.1 Add `normalRange` to assay dialog form schema, default values, reset, initialization, and submit payload.
- [ ] 3.2 Add a Vietnamese `Khoảng tham chiếu` textarea to the assay definition dialog with the approved placeholder examples.
- [ ] 3.3 Show saved reference range text in assay view/detail mode so managers can verify the value before generating CoAs.
- [ ] 3.4 Ensure local assay table state preserves `normal_range` after create/update callbacks.

## 4. Tests And Verification

- [ ] 4.1 Add focused form/UI tests covering placeholder display, edit initialization, save payload, and blank-to-clear behavior.
- [ ] 4.2 Add focused server action/client bridge tests for create/update persistence, clearing to `null`, and non-manager rejection through the existing guard.
- [ ] 4.3 Verify existing CoA reference-range tests still pass and add coverage only if the generate-time snapshot behavior is not already protected.
- [ ] 4.4 Apply the migration in Docker-backed Postgres and run `SELECT * FROM run_security_tests();`.
- [ ] 4.5 Run scoped test files for assay UI/actions/RPC mapping, then `npm run typecheck` and relevant lint checks.
