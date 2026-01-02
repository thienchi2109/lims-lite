-- Migration: Add IQC tour tracking columns
-- Purpose: Track completion of IQC walkthrough tours for Analyst and Manager

ALTER TABLE users
ADD COLUMN IF NOT EXISTS tour_iqc_analyst_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tour_iqc_manager_completed_at TIMESTAMPTZ;

-- Comments for documentation
COMMENT ON COLUMN users.tour_iqc_analyst_completed_at IS 'When user completed the IQC analyst walkthrough tour';
COMMENT ON COLUMN users.tour_iqc_manager_completed_at IS 'When user completed the IQC manager walkthrough tour';
