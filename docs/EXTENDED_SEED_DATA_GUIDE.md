# Extended Seed Data - Installation Guide

## ✅ Created Migration File

I've created a comprehensive seed data migration file:
**`supabase/migrations/021_extended_seed_data.sql`**

This migration adds:

### 📊 New Data Summary

#### 1. **25 New Laboratory Methods**
- Water Quality Methods (EPA standards)
  - TDS, Turbidity, Alkalinity, Cyanide, Phosphorus
- Microbiology Methods (Standard Methods)
  - Total Coliforms, E. coli, Enterococcus, HPC
- Heavy Metals Methods (ICP/AAS)
  - ICP-AES, ICP-MS, Mercury, GF-AAS
- Organic Compounds Methods
  - VOCs (GC/MS), SVOCs, PCBs
- Chemical & Nutrients
  - COD, TKN, Nitrate/Nitrite
- Physical Parameters
  - Conductivity, Temperature, TSS
- Disinfection Byproducts
  - DBPs, HAA5

#### 2. **30 New Assay Definitions**
With proper validation rules including:
- **Water Quality**: TDS, Turbidity, Alkalinity, Cyanide, Total Phosphorus
- **Microbiology**: Total Coliforms, E. coli, Enterococcus, HPC
- **Heavy Metals**: Arsenic, Lead, Cadmium, Chromium, Mercury, Copper, Zinc
- **Organic Compounds**: Benzene, Toluene, Xylenes, PCBs
- **Nutrients**: COD, TKN, Nitrate-N, Nitrite-N
- **Physical**: Conductivity, Temperature, TSS
- **DBPs**: TTHMs, HAA5, Bromate

Each assay has:
- Proper validation rules (min, max, decimals, required)
- Appropriate units (mg/L, µg/L, CFU/100mL, etc.)
- Linked to appropriate testing methods

#### 3. **30 New Sample Records**
- Diverse sample types: Drinking Water, Wastewater, Surface Water, Groundwater, Industrial Effluent, Stormwater
- Multiple locations: Site A-E, Plant 1-2, Well 3, River Intake
- Various statuses: received, assigned, in_progress
- Sample IDs: LAB-2025-1001 through LAB-2025-1030

#### 4. **Proper Constraints & Relationships**
- ✅ Many-to-Many relationships via `assay_methods` junction table
- ✅ Only one default method per assay (enforced by unique partial index)
- ✅ Foreign key constraints maintained
- ✅ Some assays have multiple testing methods (primary + alternatives)
- ✅ Random test assignments for samples with 'assigned' status

## 🔧 How to Apply the Migration

### ⚠️ Docker Desktop Issue Detected

Docker Desktop appears to be experiencing issues. Please follow these steps:

### Step 1: Restart Docker Desktop

1. Open **Docker Desktop** application
2. Click the **Docker icon** in system tray
3. Select **Quit Docker Desktop**
4. Wait 10 seconds
5. **Start Docker Desktop** again
6. Wait for Docker to fully initialize (green status)

### Step 2: Apply the Migration

Once Docker is running, use the provided script:

```powershell
# Run from project root
.\apply-extended-seed.ps1
```

**OR** manually apply the migration:

```powershell
# Start containers if needed
docker-compose up -d

# Wait for PostgreSQL
Start-Sleep -Seconds 15

# Apply migration
Get-Content .\supabase\migrations\021_extended_seed_data.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

### Step 3: Verify the Data

```powershell
# Check data counts
docker exec lims-postgres psql -U postgres -d postgres -c "
SELECT 'Methods' as entity, COUNT(*) as count FROM public.methods WHERE deleted_at IS NULL
UNION ALL
SELECT 'Assays', COUNT(*) FROM public.assay_definitions WHERE deleted_at IS NULL
UNION ALL
SELECT 'Samples', COUNT(*) FROM public.samples WHERE deleted_at IS NULL
UNION ALL
SELECT 'Assay-Method Links', COUNT(*) FROM public.assay_methods;
"
```

Expected output:
```
      entity       | count
-------------------+-------
 Methods           |   27+
 Assays            |   35+
 Samples           |   50+
 Assay-Method Links|   40+
```

## 📋 Key Features of This Seed Data

### Realistic Laboratory Data
- Based on actual EPA and Standard Methods
- Proper procedure references (EPA-xxx.x-year, SM-xxxx-year)
- Realistic validation ranges for each parameter

### Proper Validation Rules
Each assay includes JSON validation rules:
```json
{
  "type": "numeric",
  "min": 0,
  "max": 1000,
  "decimals": 2,
  "required": true
}
```

### Method Flexibility
Some assays can be tested by multiple methods:
- **Arsenic**: Can use ICP-AES (default) OR ICP-MS (alternative)
- **Benzene**: Can use EPA 524.2 (default) OR EPA 8260 (alternative)
- Enforced: Only ONE method marked as default per assay

### Sample Diversity
- 6 different sample types
- 9 different locations
- 3 different statuses
- Staggered received times (realistic workflow)

## 🎯 After Migration

1. **Refresh your browser** at http://localhost:3000
2. **Login** as manager or analyst
3. **Explore new data:**
   - Manager > Assay Management: See 30+ assays with methods
   - Manager > Sample Management: See 50+ samples
   - Analyst > Samples: See expanded sample list
   - Try assigning new tests to samples

## 🛠️ Troubleshooting

### If migration fails:
```powershell
# Check container status
docker ps

# Check logs
docker-compose logs lims-postgres

# Restart if needed
docker-compose restart lims-postgres
```

### If data doesn't appear:
```powershell
# Verify migrations ran
docker exec lims-postgres psql -U postgres -d postgres -c "\dt"

# Check for errors
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM public.methods;"
```

## 📝 Migration File Details

**Location**: `supabase/migrations/021_extended_seed_data.sql`
**Size**: ~25 KB
**Safe to run**: Yes, uses `ON CONFLICT DO NOTHING` to prevent duplicates
**Idempotent**: Can be run multiple times safely

---

**Created**: December 6, 2025
**Status**: Ready to apply (waiting for Docker restart)
