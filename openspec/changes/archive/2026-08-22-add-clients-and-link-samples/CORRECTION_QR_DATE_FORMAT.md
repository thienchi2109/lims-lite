# Design Correction: QR Date Format
**Date**: 2025-12-10
**Status**: ✅ CORRECTED

---

## Issue
Original design incorrectly assumed QR payload contained date in `dd/mm/yyyy` format with slashes.

## Actual Format (Confirmed from Real ID Card Scan)
```
Format: id_card_num|health_insurance_num|name|DDMMYYYY|gender|
Example: 086094006827|331757192|NGUYỄN THIỆN CHÍ|21091994|Nam|
                                                  ^^^^^^^^
                                            NO SLASHES - 8 digits only
```

**Key Difference**: Date is `DDMMYYYY` (8 digits, no separators) not `dd/mm/yyyy`

---

## Changes Made

### 1. Updated Documentation
- ✅ `PHASE1_DESIGN_DECISIONS.md` - Corrected QR format examples
- ✅ `PHASE1_DESIGN_DECISIONS.md` - Updated field mapping table
- ✅ `PHASE1_DESIGN_DECISIONS.md` - Updated parsing algorithm with string slicing logic
- ✅ `PHASE1_DESIGN_DECISIONS.md` - Added detailed date conversion specification with code example
- ✅ `specs/client-management/spec.md` - Updated requirement and scenario

### 2. Created Reference Implementation
- ✅ `qr-parser-reference.ts` - Complete TypeScript parser with:
  - String slicing: `day = str.slice(0,2)`, `month = str.slice(2,4)`, `year = str.slice(4,8)`
  - ISO date conversion: `YYYY-MM-DD`
  - Comprehensive validation (length, digits-only, valid date, reasonable year range)
  - Edge case handling (Feb 31st, date adjustment detection)
  - 5 test cases

---

## Parsing Logic (Finalized)

### Input
```
"21091994"
```

### Steps
1. **Validate length**: Must be exactly 8 characters
2. **Validate format**: Must be all digits (`/^\d{8}$/`)
3. **Extract components**:
   ```typescript
   day   = "21091994".slice(0, 2)  // "21"
   month = "21091994".slice(2, 4)  // "09"
   year  = "21091994".slice(4, 8)  // "1994"
   ```
4. **Build ISO date**: `${year}-${month}-${day}` = `"1994-09-21"`
5. **Create Date object**: `new Date("1994-09-21")`
6. **Validate**:
   - Date is valid (not NaN)
   - Parsed date matches input (catch silent adjustments like Feb 31 → Mar 3)
   - Year in range 1900-2100

### Output
```typescript
Date("1994-09-21T00:00:00.000Z")
```

---

## Impact Assessment

### ✅ No Schema Changes Required
The database schema remains the same:
- `clients.date_of_birth` is still `DATE` type
- No changes to constraints, indexes, or RLS policies

### ✅ Only Parsing Logic Affected
Changes are isolated to QR parsing code (Phase 3: Backend Integration)
- Server action that parses QR payload
- Zod schema for QR input validation
- Frontend QR scanner component

### ✅ Migration Unaffected
Backfill strategy remains the same - uses placeholder DOBs in `DATE` format

---

## Test Cases Defined

| # | Input | Expected | Validates |
|---|-------|----------|-----------|
| 1 | `21091994` | `Date(1994-09-21)` | Valid date parsing |
| 2 | `31021994` | Error | Invalid date (Feb 31st) |
| 3 | `2109199` | Error | Wrong length (7 digits) |
| 4 | `210919ab` | Error | Non-digit characters |
| 5 | `01011899` | Error | Year out of range (<1900) |

All test cases implemented in `qr-parser-reference.ts`

---

## Sign-off

✅ **Design Updated**: All documentation reflects DDMMYYYY format
✅ **Reference Code**: Parser implementation validates the approach
✅ **No Breaking Changes**: Database schema unchanged
✅ **Ready for Phase 2**: Can proceed with migration (no date format dependencies)

**Next Action**: Proceed to Phase 2 (Database Migration) when ready
