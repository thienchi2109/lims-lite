-- Migration: Add tour tracking columns for walkthrough onboarding
-- Purpose: Track completion of interactive walkthroughs per user
-- Tours: accession (sample intake), results (entry/submit), approval (manager workflow)

-- Add tour completion tracking columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tour_accession_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tour_results_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tour_approval_completed_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN users.tour_accession_completed_at IS 'Timestamp when user completed the sample accession walkthrough';
COMMENT ON COLUMN users.tour_results_completed_at IS 'Timestamp when user completed the results submission walkthrough';
COMMENT ON COLUMN users.tour_approval_completed_at IS 'Timestamp when user completed the manager approval walkthrough';

-- Create index for efficient tour status queries (users who haven't completed tours)
CREATE INDEX IF NOT EXISTS idx_users_tour_status
  ON users (id)
  WHERE tour_accession_completed_at IS NULL
     OR tour_results_completed_at IS NULL
     OR tour_approval_completed_at IS NULL;
