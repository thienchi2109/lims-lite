-- Migration: Add Westgard QC Tables
-- Description: Creates 6 QC tables with RLS policies, triggers, and indexes for Westgard Multirule QC system
-- Compliant with: ISO 15189, 21 CFR Part 11

-- ============================================================================
-- ENUMS
-- ============================================================================

-- QC session mode (manager-configurable per assay)
CREATE TYPE qc_session_mode AS ENUM ('daily', 'batch', 'shift');

-- QC status for sessions and results
CREATE TYPE qc_status AS ENUM ('pending', 'pass', 'warning', 'blocked', 'resolved');

-- QC result status
CREATE TYPE qc_result_status AS ENUM ('pass', 'warning', 'reject');

-- Westgard rule names
CREATE TYPE westgard_rule AS ENUM ('1-2s', '1-3s', '2-2s', 'R-4s', '4-1s', '10-x');

-- QC level (Low/Normal/High)
CREATE TYPE qc_level AS ENUM ('low', 'normal', 'high');

-- ============================================================================
-- TABLE 1: qc_materials - QC Material/Lot Tracking
-- ============================================================================

CREATE TABLE qc_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  lot_number TEXT NOT NULL UNIQUE,
  level qc_level NOT NULL,
  manufacturer TEXT,
  expiration_date DATE NOT NULL,
  concentration_value NUMERIC,
  concentration_unit TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for qc_materials
CREATE INDEX idx_qc_materials_lot_number ON qc_materials(lot_number);
CREATE INDEX idx_qc_materials_expiration ON qc_materials(expiration_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_qc_materials_deleted_at ON qc_materials(deleted_at);

-- ============================================================================
-- TABLE 2: qc_definitions - Control Limits per Assay/Material
-- ============================================================================

CREATE TABLE qc_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assay_id UUID NOT NULL REFERENCES assay_definitions(id),
  material_id UUID NOT NULL REFERENCES qc_materials(id),
  mean NUMERIC NOT NULL,
  sd NUMERIC NOT NULL CHECK (sd > 0),
  data_points_count INTEGER NOT NULL CHECK (data_points_count >= 1),
  collection_start_date DATE,
  collection_end_date DATE,
  active_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  electronic_signature TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index to ensure only one active definition per assay/material
CREATE UNIQUE INDEX idx_qc_definitions_unique_active 
  ON qc_definitions(assay_id, material_id) 
  WHERE is_active = true;

-- Indexes for qc_definitions
CREATE INDEX idx_qc_definitions_assay ON qc_definitions(assay_id);
CREATE INDEX idx_qc_definitions_material ON qc_definitions(material_id);
CREATE INDEX idx_qc_definitions_active ON qc_definitions(assay_id, material_id) WHERE is_active = true;

-- ============================================================================
-- TABLE 3: qc_sessions - Session-Based QC Linking
-- ============================================================================

CREATE TABLE qc_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assay_id UUID NOT NULL REFERENCES assay_definitions(id),
  session_mode qc_session_mode NOT NULL DEFAULT 'daily',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  qc_status qc_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for qc_sessions
CREATE INDEX idx_qc_sessions_assay ON qc_sessions(assay_id);
CREATE INDEX idx_qc_sessions_status ON qc_sessions(qc_status);
CREATE INDEX idx_qc_sessions_assay_status ON qc_sessions(assay_id, qc_status);
CREATE INDEX idx_qc_sessions_active ON qc_sessions(assay_id, ended_at) WHERE ended_at IS NULL;

-- ============================================================================
-- TABLE 4: qc_results - Daily QC Measurements
-- ============================================================================

CREATE TABLE qc_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  definition_id UUID NOT NULL REFERENCES qc_definitions(id),
  session_id UUID REFERENCES qc_sessions(id),
  value NUMERIC NOT NULL,
  z_score NUMERIC, -- Auto-calculated by trigger
  status qc_result_status NOT NULL DEFAULT 'pass',
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entered_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for qc_results
CREATE INDEX idx_qc_results_definition ON qc_results(definition_id);
CREATE INDEX idx_qc_results_session ON qc_results(session_id);
CREATE INDEX idx_qc_results_measured_at ON qc_results(measured_at);
CREATE INDEX idx_qc_results_status ON qc_results(status);
CREATE INDEX idx_qc_results_definition_measured ON qc_results(definition_id, measured_at DESC);

-- ============================================================================
-- TABLE 5: qc_violations - Rule Violations & Corrective Actions
-- ============================================================================

CREATE TABLE qc_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  result_id UUID NOT NULL REFERENCES qc_results(id),
  session_id UUID REFERENCES qc_sessions(id),
  rule_violated westgard_rule NOT NULL,
  status qc_result_status NOT NULL DEFAULT 'reject',
  z_score NUMERIC NOT NULL,
  corrective_action TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  electronic_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for qc_violations
CREATE INDEX idx_qc_violations_result ON qc_violations(result_id);
CREATE INDEX idx_qc_violations_session ON qc_violations(session_id);
CREATE INDEX idx_qc_violations_unresolved ON qc_violations(session_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_qc_violations_rule ON qc_violations(rule_violated);

-- ============================================================================
-- TABLE 6: qc_tea_standards - Total Allowable Error Standards
-- ============================================================================

CREATE TABLE qc_tea_standards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assay_id UUID NOT NULL REFERENCES assay_definitions(id),
  tea_percent NUMERIC NOT NULL CHECK (tea_percent > 0),
  source TEXT, -- e.g., 'CLIA', 'CAP', 'RiliBAK', 'custom'
  peer_group_mean NUMERIC,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qc_tea_standards_unique_assay UNIQUE (assay_id)
);

-- Index for qc_tea_standards
CREATE INDEX idx_qc_tea_standards_assay ON qc_tea_standards(assay_id);

-- ============================================================================
-- ALTER results TABLE: Add qc_session_id Column
-- ============================================================================

-- Add qc_session_id to results table (nullable, NO BACKFILL - NULL = pre-QC era)
ALTER TABLE results ADD COLUMN qc_session_id UUID REFERENCES qc_sessions(id);

-- Index for efficient QC session lookups
CREATE INDEX idx_results_qc_session ON results(qc_session_id) WHERE qc_session_id IS NOT NULL;

-- ============================================================================
-- TRIGGER: Auto-calculate Z-score on qc_results INSERT/UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_z_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mean NUMERIC;
  v_sd NUMERIC;
BEGIN
  -- Get mean and SD from the associated definition
  SELECT mean, sd INTO v_mean, v_sd
  FROM qc_definitions
  WHERE id = NEW.definition_id;

  -- Calculate Z-score: (value - mean) / sd
  IF v_sd IS NOT NULL AND v_sd > 0 THEN
    NEW.z_score := ROUND((NEW.value - v_mean) / v_sd, 4);
  ELSE
    NEW.z_score := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_z_score_trigger
BEFORE INSERT OR UPDATE OF value, definition_id ON qc_results
FOR EACH ROW EXECUTE FUNCTION calculate_z_score();

-- ============================================================================
-- HELPER FUNCTION: Get Active QC Session for an Assay
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_qc_session(p_assay_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM qc_sessions
  WHERE assay_id = p_assay_id
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
$$;

-- ============================================================================
-- HELPER FUNCTION: Check if Results Can Be Approved (QC Status Check)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_qc_approval_status(p_result_ids UUID[])
RETURNS TABLE (
  result_id UUID,
  can_approve BOOLEAN,
  qc_status qc_status,
  blocking_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS result_id,
    CASE
      -- NULL qc_session_id = pre-QC era, allow approval
      WHEN r.qc_session_id IS NULL THEN true
      -- Session passed or resolved, allow approval
      WHEN s.qc_status IN ('pass', 'resolved') THEN true
      -- Session pending (no QC done yet), block with warning
      WHEN s.qc_status = 'pending' THEN false
      -- Session blocked or warning, check if resolved
      ELSE false
    END AS can_approve,
    COALESCE(s.qc_status, 'pass'::qc_status) AS qc_status,
    CASE
      WHEN r.qc_session_id IS NULL THEN NULL
      WHEN s.qc_status = 'pending' THEN 'Chưa thực hiện QC cho phiên này'
      WHEN s.qc_status = 'blocked' THEN 'QC mất kiểm soát. Cần hành động khắc phục.'
      WHEN s.qc_status = 'warning' THEN 'QC có cảnh báo. Xem xét trước khi phê duyệt.'
      ELSE NULL
    END AS blocking_reason
  FROM unnest(p_result_ids) AS rid(id)
  JOIN results r ON r.id = rid.id
  LEFT JOIN qc_sessions s ON s.id = r.qc_session_id;
END;
$$;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER update_qc_materials_updated_at
BEFORE UPDATE ON qc_materials
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qc_definitions_updated_at
BEFORE UPDATE ON qc_definitions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qc_sessions_updated_at
BEFORE UPDATE ON qc_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qc_results_updated_at
BEFORE UPDATE ON qc_results
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qc_violations_updated_at
BEFORE UPDATE ON qc_violations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qc_tea_standards_updated_at
BEFORE UPDATE ON qc_tea_standards
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUDIT LOG TRIGGERS
-- ============================================================================

CREATE TRIGGER audit_qc_materials_trigger
AFTER INSERT OR UPDATE OR DELETE ON qc_materials
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_qc_definitions_trigger
AFTER INSERT OR UPDATE OR DELETE ON qc_definitions
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_qc_sessions_trigger
AFTER INSERT OR UPDATE OR DELETE ON qc_sessions
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_qc_results_trigger
AFTER INSERT OR UPDATE OR DELETE ON qc_results
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_qc_violations_trigger
AFTER INSERT OR UPDATE OR DELETE ON qc_violations
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_qc_tea_standards_trigger
AFTER INSERT OR UPDATE OR DELETE ON qc_tea_standards
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- ============================================================================
-- ENABLE RLS ON ALL QC TABLES
-- ============================================================================

ALTER TABLE qc_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_tea_standards ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: qc_materials
-- ============================================================================

-- All authenticated users can read active QC materials
DROP POLICY IF EXISTS "Users can read qc_materials" ON qc_materials;
CREATE POLICY "Users can read qc_materials" ON qc_materials
  FOR SELECT
  USING (
    (SELECT auth.role()) = 'authenticated'
    AND (deleted_at IS NULL OR get_user_role() = 'manager')
  );

-- Only managers can insert QC materials
DROP POLICY IF EXISTS "Managers can insert qc_materials" ON qc_materials;
CREATE POLICY "Managers can insert qc_materials" ON qc_materials
  FOR INSERT
  WITH CHECK (get_user_role() = 'manager');

-- Only managers can update QC materials
DROP POLICY IF EXISTS "Managers can update qc_materials" ON qc_materials;
CREATE POLICY "Managers can update qc_materials" ON qc_materials
  FOR UPDATE
  USING (get_user_role() = 'manager');

-- Only managers can delete QC materials (soft delete)
DROP POLICY IF EXISTS "Managers can delete qc_materials" ON qc_materials;
CREATE POLICY "Managers can delete qc_materials" ON qc_materials
  FOR DELETE
  USING (get_user_role() = 'manager');

-- ============================================================================
-- RLS POLICIES: qc_definitions
-- ============================================================================

-- All authenticated users can read QC definitions
DROP POLICY IF EXISTS "Users can read qc_definitions" ON qc_definitions;
CREATE POLICY "Users can read qc_definitions" ON qc_definitions
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- Only managers can insert QC definitions
DROP POLICY IF EXISTS "Managers can insert qc_definitions" ON qc_definitions;
CREATE POLICY "Managers can insert qc_definitions" ON qc_definitions
  FOR INSERT
  WITH CHECK (get_user_role() = 'manager');

-- Only managers can update QC definitions
DROP POLICY IF EXISTS "Managers can update qc_definitions" ON qc_definitions;
CREATE POLICY "Managers can update qc_definitions" ON qc_definitions
  FOR UPDATE
  USING (get_user_role() = 'manager');

-- Only managers can delete QC definitions
DROP POLICY IF EXISTS "Managers can delete qc_definitions" ON qc_definitions;
CREATE POLICY "Managers can delete qc_definitions" ON qc_definitions
  FOR DELETE
  USING (get_user_role() = 'manager');

-- ============================================================================
-- RLS POLICIES: qc_sessions
-- ============================================================================

-- All authenticated users can read QC sessions
DROP POLICY IF EXISTS "Users can read qc_sessions" ON qc_sessions;
CREATE POLICY "Users can read qc_sessions" ON qc_sessions
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- Only managers can create QC sessions
DROP POLICY IF EXISTS "Managers can insert qc_sessions" ON qc_sessions;
CREATE POLICY "Managers can insert qc_sessions" ON qc_sessions
  FOR INSERT
  WITH CHECK (get_user_role() = 'manager');

-- Only managers can update QC sessions
DROP POLICY IF EXISTS "Managers can update qc_sessions" ON qc_sessions;
CREATE POLICY "Managers can update qc_sessions" ON qc_sessions
  FOR UPDATE
  USING (get_user_role() = 'manager');

-- Only managers can delete QC sessions
DROP POLICY IF EXISTS "Managers can delete qc_sessions" ON qc_sessions;
CREATE POLICY "Managers can delete qc_sessions" ON qc_sessions
  FOR DELETE
  USING (get_user_role() = 'manager');

-- ============================================================================
-- RLS POLICIES: qc_results
-- ============================================================================

-- All authenticated users can read QC results
DROP POLICY IF EXISTS "Users can read qc_results" ON qc_results;
CREATE POLICY "Users can read qc_results" ON qc_results
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- Analysts and managers can insert QC results
DROP POLICY IF EXISTS "Analysts and managers can insert qc_results" ON qc_results;
CREATE POLICY "Analysts and managers can insert qc_results" ON qc_results
  FOR INSERT
  WITH CHECK (
    get_user_role() IN ('analyst', 'manager')
  );

-- Only managers can update QC results
DROP POLICY IF EXISTS "Managers can update qc_results" ON qc_results;
CREATE POLICY "Managers can update qc_results" ON qc_results
  FOR UPDATE
  USING (get_user_role() = 'manager');

-- Only managers can delete QC results
DROP POLICY IF EXISTS "Managers can delete qc_results" ON qc_results;
CREATE POLICY "Managers can delete qc_results" ON qc_results
  FOR DELETE
  USING (get_user_role() = 'manager');

-- ============================================================================
-- RLS POLICIES: qc_violations
-- ============================================================================

-- All authenticated users can read QC violations
DROP POLICY IF EXISTS "Users can read qc_violations" ON qc_violations;
CREATE POLICY "Users can read qc_violations" ON qc_violations
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- System (via triggers) and managers can insert violations
-- Note: Violations are typically created by server actions, not directly by users
DROP POLICY IF EXISTS "System can insert qc_violations" ON qc_violations;
CREATE POLICY "System can insert qc_violations" ON qc_violations
  FOR INSERT
  WITH CHECK (
    get_user_role() IN ('analyst', 'manager')
  );

-- Only managers can update (resolve) violations
DROP POLICY IF EXISTS "Managers can update qc_violations" ON qc_violations;
CREATE POLICY "Managers can update qc_violations" ON qc_violations
  FOR UPDATE
  USING (get_user_role() = 'manager');

-- Only managers can delete violations
DROP POLICY IF EXISTS "Managers can delete qc_violations" ON qc_violations;
CREATE POLICY "Managers can delete qc_violations" ON qc_violations
  FOR DELETE
  USING (get_user_role() = 'manager');

-- ============================================================================
-- RLS POLICIES: qc_tea_standards
-- ============================================================================

-- All authenticated users can read TEa standards
DROP POLICY IF EXISTS "Users can read qc_tea_standards" ON qc_tea_standards;
CREATE POLICY "Users can read qc_tea_standards" ON qc_tea_standards
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- Only managers can insert TEa standards
DROP POLICY IF EXISTS "Managers can insert qc_tea_standards" ON qc_tea_standards;
CREATE POLICY "Managers can insert qc_tea_standards" ON qc_tea_standards
  FOR INSERT
  WITH CHECK (get_user_role() = 'manager');

-- Only managers can update TEa standards
DROP POLICY IF EXISTS "Managers can update qc_tea_standards" ON qc_tea_standards;
CREATE POLICY "Managers can update qc_tea_standards" ON qc_tea_standards
  FOR UPDATE
  USING (get_user_role() = 'manager');

-- Only managers can delete TEa standards
DROP POLICY IF EXISTS "Managers can delete qc_tea_standards" ON qc_tea_standards;
CREATE POLICY "Managers can delete qc_tea_standards" ON qc_tea_standards
  FOR DELETE
  USING (get_user_role() = 'manager');

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION calculate_z_score() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_qc_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_qc_approval_status(UUID[]) TO authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE qc_materials IS 'QC material/lot tracking with soft delete support';
COMMENT ON TABLE qc_definitions IS 'Control limits (Mean, SD) per assay/material combination';
COMMENT ON TABLE qc_sessions IS 'Session-based QC linking for patient result blocking';
COMMENT ON TABLE qc_results IS 'Daily QC measurements with auto-calculated Z-scores';
COMMENT ON TABLE qc_violations IS 'Westgard rule violations requiring corrective action';
COMMENT ON TABLE qc_tea_standards IS 'Total Allowable Error standards for Six Sigma calculations';
COMMENT ON COLUMN results.qc_session_id IS 'Links patient results to QC session. NULL = pre-QC era (approval allowed)';
COMMENT ON FUNCTION get_active_qc_session IS 'Returns the active (un-ended) QC session for an assay';
COMMENT ON FUNCTION check_qc_approval_status IS 'Checks if results can be approved based on QC session status';
