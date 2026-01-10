# CoA Corruption Cleanup - Completed ✅

**Date:** 2026-01-10T13:49:00+07:00
**Issue:** Storage corruption causing 500 errors on CoA downloads
**Action Taken:** Deleted corrupted CoA records (soft delete)

## Summary

### CoA Records Deleted: **9 records**

| Sample ID Display | File Path | Created At |
|------------------|-----------|------------|
| CDC-XN-09012026-0002 | 47f91a0e-6fdd-4f15-be53-6d704fb95dc7/1-2026-01-09T03:03:20.884Z.html | 2026-01-09 02:56:15 |
| CDC-XN-09012026-0001 | 73ee31da-29c4-47dc-b455-3963665588a3/1-2026-01-09T03:03:39.257Z.html | 2026-01-09 02:52:52 |
| CDC-XN-05012026-0003 | 5ea70127-bd1f-461a-9fb6-b322586ffed4/1-2026-01-08T02:00:40.959Z.html | 2026-01-08 01:59:57 |
| CDC-XN-23122025-0003 | 89f6022b-926b-4bb3-8955-32d8c996f22a/1-2025-12-23T13:43:34.738Z.html | 2025-12-23 13:40:13 |
| CDC-XN-22122025-0003 | a2059f55-db89-470d-ad54-40929961f3ce/1-2025-12-23T12:57:39.757Z.html | 2025-12-23 12:32:42 |
| CDC-XN-23122025-0001 | 5ea91563-cab6-445b-b5bc-82f8d2ec2749/1-2025-12-23T06:43:39.080Z.html | 2025-12-23 02:22:05 |
| LAB-2025-1024 | 447038a0-29e3-41ef-98be-477eb3b76c1d/1-2025-12-23T01:39:16.626Z.html | 2025-12-22 09:40:49 |
| LAB-2025-1002 | a1fa2af5-3130-482e-a057-3a73c986a7c2/1-2025-12-23T12:39:41.791Z.html | 2025-12-15 14:03:08 |
| LAB-2025-1018 | ae56fe2b-aeac-4ed1-8e16-8983372d6757/1-2025-12-23T01:39:19.479Z.html | 2025-12-14 10:01:48 |

### Total Completed Samples: **10 samples**

**Status:** All completed samples now need CoA regeneration (9 had corrupted CoAs, 1 may have never had one generated)

## Root Cause

**Storage Corruption: ENODATA - Extended attribute does not exist**

The Supabase Storage service lost file metadata (extended attributes) for CoA files. Database records showed files as "ready", but physical files were missing or corrupted in the storage volume.

**Why it happened:**
- Docker volume filesystem inconsistency
- Possible storage container restart during file operations
- File metadata corruption

## How to Regenerate CoAs

### Option 1: Via Manager Dashboard (UI)

1. Navigate to **Manager Dashboard** → **Samples**
2. Filter by status: **Completed**
3. For each sample without a CoA:
   - Click the sample
   - Click **"Regenerate CoA"** button (if implemented)
   - Or use the **Approval/Actions** menu

### Option 2: Via API (Bulk Regeneration)

If you have the `/api/admin/regenerate-coa` endpoint:

```bash
# Single sample
curl -X POST http://localhost:3000/api/admin/regenerate-coa \
  -H "Content-Type: application/json" \
  -d '{"sample_id": "47f91a0e-6fdd-4f15-be53-6d704fb95dc7"}'

# Or use the authenticated session from browser
```

### Option 3: Database Query + Manual Trigger

Get list of samples needing regeneration:

```sql
SELECT 
    s.id,
    s.sample_id as display_id,
    s.status
FROM samples s
WHERE s.status = 'completed'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM coa_reports cr 
    WHERE cr.sample_id = s.id 
      AND cr.status = 'ready' 
      AND cr.deleted_at IS NULL
  )
ORDER BY s.updated_at DESC;
```

Then trigger regeneration for each sample ID.

## Prevention Measures (TODO)

1. **Add Storage Health Check:**
   - Verify file exists before marking CoA as "ready"
   - Add metadata validation

2. **Auto-Healing in Download Route:**
   - Detect ENODATA errors
   - Automatically trigger regeneration
   - Log corruption events

3. **Scheduled Integrity Check:**
   - Nightly job to verify all "ready" CoAs have valid files
   - Alert on corruption detection

4. **Storage Monitoring:**
   - Add metrics for storage errors
   - Monitor extended attribute errors
   - Alert on volume issues

## Files Modified

- `supabase/migrations/temp_delete_corrupted_coas.sql` - Deletion script (temporary)

## Next Steps

1. ✅ **DONE:** Delete corrupted CoA records
2. ⏳ **YOUR ACTION:** Regenerate CoAs for the 10 completed samples
3. ⏳ **VERIFY:** Test CoA download on `/coa/access` page
4. ⏳ **OPTIONAL:** Implement auto-healing and prevention measures

---

**Notes:**
- The deleted CoA records are soft-deleted (marked with `deleted_at` timestamp)
- Original file paths and metadata are preserved in the database
- Storage files may still exist but are corrupted (extended attributes missing)
- You can safely regenerate without data loss (results are still in the database)
