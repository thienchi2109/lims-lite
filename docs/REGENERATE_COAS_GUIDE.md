# Quick Reference: How to Regenerate CoAs

## Samples Needing Regeneration (10 total)

```
1. CDC-XN-09012026-0002
2. CDC-XN-09012026-0001
3. CDC-XN-05012026-0003
4. CDC-XN-23122025-0003
5. CDC-XN-22122025-0003
6. CDC-XN-23122025-0001
7. LAB-2025-1024
8. LAB-2025-1002
9. LAB-2025-1018
10. (1 additional completed sample)
```

## Quick Regeneration Steps

### Method 1: Via Manager Dashboard (Recommended)

1. **Login as Manager**
   - Go to http://localhost:3000
   - Login with manager credentials

2. **Navigate to Samples**
   - Go to **Manager Dashboard**
   - Click **Samples** or **Approvals**

3. **Filter Completed Samples**
   - Status filter: **Completed**
   - These will show samples without CoAs

4. **Regenerate Each CoA**
   - Click on sample
   - Look for **"Generate CoA"** or **"Regenerate CoA"** button
   - Click to trigger regeneration

### Method 2: Check Which Samples Need CoA

Run this query to get the exact list:

```bash
docker exec lims-postgres psql -U postgres -d postgres -c "
SELECT 
    s.sample_id as display_id,
    s.status,
    s.updated_at
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
"
```

### Method 3: Verify CoA Regeneration Success

After regenerating, check if CoA was created:

```bash
# Should show 10 after you regenerate all
docker exec lims-postgres psql -U postgres -d postgres -c "
SELECT COUNT(*) FROM coa_reports 
WHERE status = 'ready' AND deleted_at IS NULL;
"
```

### Method 4: Test CoA Download

1. Go to http://localhost:3000/coa/access
2. Enter the client's phone number
3. Verify you can see and download the CoA
4. Should open in new tab successfully

## Verification Checklist

After regenerating all CoAs:

- [ ] All 10 samples have `status = 'ready'` in `coa_reports` table
- [ ] Files exist in storage: `docker exec lims-storage ls -lah /var/lib/storage/stub/coa-reports/`
- [ ] CoA download works without 500 error
- [ ] CoA displays correctly in browser
- [ ] No ENODATA errors in storage logs

## Troubleshooting

### If regeneration fails:

1. **Check sample status:**
   ```sql
   SELECT id, sample_id, status FROM samples WHERE sample_id = 'CDC-XN-09012026-0002';
   ```
   - Must be `status = 'completed'`

2. **Check results exist:**
   ```sql
   SELECT COUNT(*) FROM results WHERE sample_id = '<sample_id>';
   ```
   - Must have at least 1 result

3. **Check storage service:**
   ```bash
   docker ps --filter "name=lims-storage"
   ```
   - Should show "Up" status

4. **Check storage logs:**
   ```bash
   docker compose logs storage --tail 50
   ```
   - Look for errors

### If CoA download still fails:

- Check browser console for errors
- Check download route logs: `npm run dev` output
- Verify JWT token is valid
- Check storage bucket permissions

---

**Quick Help:**
- Original issue: Storage corruption (ENODATA error)
- Fix applied: Deleted 9 corrupted CoA records
- Your task: Regenerate CoAs for 10 completed samples
- Expected time: ~2-5 minutes per sample (if manual)

**Need help?** Check the detailed doc: `docs/coa-corruption-cleanup-2026-01-10.md`
