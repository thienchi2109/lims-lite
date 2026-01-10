# Bug Fix: CoA Regeneration Blocked by Soft-Deleted Records

**Date:** 2026-01-10T14:06:00+07:00
**Issue:** CoA regeneration creates record but disappears after refresh
**Root Cause:** `generateCoA` and `regenerateCoA` functions didn't filter by `deleted_at IS NULL`

---

## The Problem

### User Experience
1. User tries to regenerate CoA for a sample
2. System appears to succeed (no error message)
3. After refreshing the browser, the CoA disappears
4. Regeneration can be triggered again with same result

### Root Cause

The `generateCoA` and `regenerateCoA` functions checked for existing CoA records but **didn't filter out soft-deleted records**:

```typescript
// BEFORE (Line 193-198) - BUGGY CODE
const { data: existingCoa, error: checkError } = await supabase
    .from('coa_reports')
    .select('id, status, file_path')
    .eq('sample_id', sampleId)
    .eq('version', version)
    .maybeSingle()  // ❌ Missing .is('deleted_at', null)
```

**What happened:**
1. User tries to regenerate CoA
2. Code finds the soft-deleted `status='ready'` record from before
3. Code returns error: "CoA đã được tạo cho mẫu này" (line 206-210)
4. User doesn't see th error because UI might not display it properly
5. No new CoA is created
6. Browser refresh shows no CoA (because old one is soft-deleted)

---

## The Fix

Added `.is('deleted_at', null)` filter to both functions:

### File: `src/app/actions/coa.ts`

#### Fix 1: `generateCoA` function (Line 191-199)

```typescript
// AFTER - FIXED CODE
// Step 9: Check for existing CoA record (excluding soft-deleted)
const version = 1 // TODO Phase 4: Implement versioning logic
const { data: existingCoa, error: checkError } = await supabase
    .from('coa_reports')
    .select('id, status, file_path')
    .eq('sample_id', sampleId)
    .eq('version', version)
    .is('deleted_at', null)  // ✅ Now ignores soft-deleted records
    .maybeSingle()
```

#### Fix 2: `regenerateCoA` function (Line 350-358)

```typescript
// AFTER - FIXED CODE
// Check if CoA exists (excluding soft-deleted)
const version = 1 // TODO Phase 4: Implement versioning logic
const { data: existingCoa, error: checkError } = await supabase
    .from('coa_reports')
    .select('id, status, file_path')
    .eq('sample_id', sampleId)
    .eq('version', version)
    .is('deleted_at', null)  // ✅ Now ignores soft-deleted records
    .maybeSingle()
```

---

## Testing & Verification

### Manual Test Steps

1. **Verify fix in dev environment:**
   ```bash
   # Should already be running
   npm run dev
   ```

2. **Regenerate a CoA:**
   - Login as manager
   - Navigate to a completed sample (e.g., CDC-XN-09012026-0002)
   - Click "Generate CoA" or "Regenerate CoA"
   - Should succeed without errors

3. **Verify persistence:**
   - Refresh the browser
   - CoA should still be visible
   - Download should work

4. **Verify in database:**
   ```bash
   docker exec lims-postgres psql -U postgres -d postgres -c "
   SELECT id, sample_id, status, deleted_at 
   FROM coa_reports 
   WHERE deleted_at IS NULL 
   ORDER BY created_at DESC LIMIT 5;
   "
   ```
   Should show new CoA records with `deleted_at = null`

### Expected Results

✅ **Before Fix:**
- CoA appears briefly but disappears after refresh
- No new records created (finds soft-deleted ones)
- User frustrated by "phantom" CoA

✅ **After Fix:**
- CoA persists after refresh
- New records created successfully Status shows "ready"
- Download works properly

---

## Related Issues

This fix resolves the issue chain:

1. **Storage Corruption** (ENODATA) → Deleted 9 corrupted CoAs
2. **Soft Delete** → Records marked with `deleted_at` timestamp
3. **Regeneration Bug** → Code still found soft-deleted records
4. **This Fix** → Now properly ignores soft-deleted records

---

## Prevention

### Code Review Checklist

When querying `coa_reports` table, always verify:

- [ ] Does this query need to exclude soft-deleted records?
- [ ] If yes, does it include `.is('deleted_at', null)`?
- [ ] Are there similar queries elsewhere that need the same fix?

### Similar Patterns to Check

Search for other queries that might have the same issue:

```bash
# Find all coa_reports queries without deleted_at filter
grep -rn "from('coa_reports')" src/ | grep -v "deleted_at"
```

### Database Migration Reminder

We use **soft deletes** for audit compliance (21 CFR Part 11). Always filter by `deleted_at IS NULL` unless you specifically need deleted records.

---

## Commit Message

```
fix: CoA regeneration blocked by soft-deleted records

Regenerated CoAs were disappearing after browser refresh because
generateCoA() and regenerateCoA() functions didn't filter out
soft-deleted records when checking for existing CoAs.

Added .is('deleted_at', null) filter to both functions to properly
ignore soft-deleted records.

Fixes regeneration after storage corruption cleanup where 9 corrupted
CoA records were soft-deleted.

Related: docs/coa-corruption-cleanup-2026-01-10.md
```

---

## Files Modified

- ✅ `src/app/actions/coa.ts` - Added deleted_at filter to both functions

## Next Steps

1. ✅ **DONE:** Fix applied to codebase
2. ⏳ **USER ACTION:** Test CoA regeneration for one sample
3. ⏳ **VERIFY:** Confirm CoA persists after refresh
4. ⏳ **BATCH:** Regenerate remaining 9 samples
5. ⏳ **VALIDATE:** Test CoA download on public portal
