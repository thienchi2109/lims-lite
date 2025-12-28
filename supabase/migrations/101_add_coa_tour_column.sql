-- Migration: Add CoA tour tracking column
-- Purpose: Track completion of CoA generation walkthrough per user

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tour_coa_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN users.tour_coa_completed_at IS
  'Timestamp when user completed the CoA generation walkthrough';

-- Update partial index to include new tour column
DROP INDEX IF EXISTS idx_users_tour_status;

CREATE INDEX IF NOT EXISTS idx_users_tour_status
  ON users (id)
  WHERE tour_accession_completed_at IS NULL
     OR tour_results_completed_at IS NULL
     OR tour_approval_completed_at IS NULL
     OR tour_coa_completed_at IS NULL;
