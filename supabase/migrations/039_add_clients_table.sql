-- Migration 039: Add clients table with audit/RLS/constraints
-- Security Impact: LOW - Authenticated users can read, analysts can create, managers can modify
-- Description: Creates clients table to store client identity for 21 CFR Part 11 compliance
-- Changes: New table with full RLS policies, audit triggers, and validation constraints

SET search_path TO public;

-- ============================================================================
-- 1. CREATE CLIENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clients (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Required Identity Fields
    id_card_num TEXT NOT NULL,
    name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL,
    phone TEXT NOT NULL,
    
    -- Optional Fields
    address TEXT,
    health_insurance_num TEXT,
    expiry_date DATE,
    
    -- Audit Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT clients_gender_check CHECK (gender IN ('Nam', 'Nữ', 'Khác')),
    CONSTRAINT clients_phone_format_check CHECK (phone ~ '^(0|\+84)[0-9]{9,10}$'),
    CONSTRAINT clients_unique_identity UNIQUE (name, date_of_birth)
);

-- Add table comment
COMMENT ON TABLE public.clients IS 'Stores client identity information for lab samples. Linked to samples via client_id FK.';

-- Add column comments
COMMENT ON COLUMN public.clients.id_card_num IS 'Vietnamese ID card number (CCCD/CMND) - stored but not unique (cards can be reissued)';
COMMENT ON COLUMN public.clients.name IS 'Full name as shown on ID card';
COMMENT ON COLUMN public.clients.date_of_birth IS 'Date of birth from ID card or QR scan';
COMMENT ON COLUMN public.clients.gender IS 'Gender - must be Nam/Nữ/Khác';
COMMENT ON COLUMN public.clients.phone IS 'Phone number - required for CoA access (passcode = last 6 digits)';
COMMENT ON COLUMN public.clients.health_insurance_num IS 'Health insurance number (optional)';
COMMENT ON COLUMN public.clients.expiry_date IS 'ID card expiry date (optional)';

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_clients_name_dob ON public.clients(name, date_of_birth);
CREATE INDEX IF NOT EXISTS idx_clients_id_card_num ON public.clients(id_card_num);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);

-- ============================================================================
-- 3. ADD TRIGGERS (updated_at + audit)
-- ============================================================================

-- Updated_at trigger (auto-update timestamp on changes)
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger (track all changes for 21 CFR Part 11 compliance)
CREATE TRIGGER audit_clients_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE RLS POLICIES
-- ============================================================================

-- Drop existing policies if any (idempotent migration pattern)
DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.clients;
DROP POLICY IF EXISTS "Analysts can create clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can update clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can delete clients" ON public.clients;

-- SELECT: All authenticated users can read clients
-- Rationale: Analysts need to see client list for sample intake
CREATE POLICY "Authenticated users can read clients"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL);

COMMENT ON POLICY "Authenticated users can read clients" ON public.clients
IS 'Allow all authenticated users to read clients for sample intake workflow';

-- INSERT: Analysts and managers can create clients
-- Rationale: Analysts create clients during QR intake workflow
CREATE POLICY "Analysts can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (get_user_role() IN ('analyst', 'manager'));

COMMENT ON POLICY "Analysts can create clients" ON public.clients
IS 'Allow analysts to create client records during QR intake';

-- UPDATE: Only managers can update clients
-- Rationale: Prevent accidental edits by analysts after creation
CREATE POLICY "Managers can update clients"
  ON public.clients FOR UPDATE
  USING (get_user_role() = 'manager')
  WITH CHECK (get_user_role() = 'manager');

COMMENT ON POLICY "Managers can update clients" ON public.clients
IS 'Only managers can edit existing client records';

-- DELETE: Only managers can delete clients
-- Rationale: Deletion should be restricted (prefer soft delete in future)
CREATE POLICY "Managers can delete clients"
  ON public.clients FOR DELETE
  USING (get_user_role() = 'manager');

COMMENT ON POLICY "Managers can delete clients" ON public.clients
IS 'Only managers can delete client records (soft delete preferred)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Apply migration: Get-Content supabase\migrations\039_add_clients_table.sql | docker exec -i lims-postgres psql -U postgres -d postgres
-- 2. Verify table: docker exec lims-postgres psql -U postgres -d postgres -c "\d clients"
-- 3. Check policies: docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM pg_policies WHERE tablename = 'clients';"
