-- Migration 045: Add lab_specialties and link assays
-- Security Impact: Medium
-- Changes: Create lab_specialties lookup with RLS and audit trigger; seed specialties; add specialty_id FK/index to assay_definitions

SET search_path TO public;

-- ============================================================================
-- LAB SPECIALTIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lab_specialties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
) TABLESPACE pg_default;

COMMENT ON TABLE public.lab_specialties IS 'Laboratory specialties/departments for assay categorization';
COMMENT ON COLUMN public.lab_specialties.display_order IS 'Ordering hint for UI lists';

CREATE TRIGGER update_lab_specialties_updated_at
    BEFORE UPDATE ON public.lab_specialties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES FOR LAB SPECIALTIES
-- ============================================================================

ALTER TABLE public.lab_specialties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read lab specialties" ON public.lab_specialties;
CREATE POLICY "Authenticated users can read lab specialties"
ON public.lab_specialties FOR SELECT
USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Managers can manage lab specialties" ON public.lab_specialties;
CREATE POLICY "Managers can manage lab specialties"
ON public.lab_specialties FOR ALL
USING (get_user_role() = 'manager');

-- ============================================================================
-- SEED STANDARD SPECIALTIES
-- ============================================================================

INSERT INTO public.lab_specialties (code, name, description, display_order)
VALUES
    ('HEM', 'Huyết học', 'Chuyên khoa huyết học', 10),
    ('BIO', 'Sinh hóa', 'Chuyên khoa sinh hóa', 20),
    ('IMM', 'Miễn dịch', 'Chuyên khoa miễn dịch', 30),
    ('MIC', 'Vi sinh', 'Chuyên khoa vi sinh', 40),
    ('MOL', 'Sinh học phân tử', 'Chuyên khoa sinh học phân tử', 50),
    ('PAT', 'Giải phẫu bệnh', 'Chuyên khoa giải phẫu bệnh', 60)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- ASSAY DEFINITIONS: ADD SPECIALTY LINK
-- ============================================================================

ALTER TABLE public.assay_definitions
    ADD COLUMN IF NOT EXISTS specialty_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'assay_definitions_specialty_id_fkey'
    ) THEN
        ALTER TABLE public.assay_definitions
            ADD CONSTRAINT assay_definitions_specialty_id_fkey
            FOREIGN KEY (specialty_id) REFERENCES public.lab_specialties(id) ON DELETE RESTRICT;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_assay_definitions_specialty_id
    ON public.assay_definitions USING btree (specialty_id);

COMMENT ON COLUMN public.assay_definitions.specialty_id IS 'Optional specialty classification for the assay';
