## 1. Server Data Wiring
- [ ] 1.1 Update `/analyst/accession` page to fetch specialties server-side via `getSpecialties()` and pass to `SampleAccessionForm`.
- [ ] 1.2 Extend `SampleAccessionForm` props to forward specialties into `TestAssignmentGrid`.

## 2. Test Assignment Grid UI/UX
- [ ] 2.1 Add “Nhóm xét nghiệm” dropdown filter to the grid toolbar (default: “Tất cả nhóm xét nghiệm”).
- [ ] 2.2 Extend grid assay row type to include `specialty_id`; build a lookup map from specialties for fast rendering.
- [ ] 2.3 Add a “Nhóm xét nghiệm” column to the middle panel table, rendering a color badge per specialty code matching Manager Assays page styling.
- [ ] 2.4 Ensure already selected tests remain selected across search/method/specialty filter changes.

## 3. Server-side Filtering
- [ ] 3.1 Pass `specialtyId` through `fetchAssayDefinitionsClient` calls in the grid and rely on `getAssayDefinitions` to filter.
- [ ] 3.2 Handle `all`/empty specialty filter values without affecting existing method/search filters.

## 4. Verification
- [ ] 4.1 Run `npm run typecheck` and smoke-test analyst accession assignment with specialty filtering enabled.
