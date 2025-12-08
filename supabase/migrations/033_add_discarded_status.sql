-- Migration 033: Add discarded status to sample_status enum
-- Description: Adds 'discarded' to the sample_status enum type.

SET search_path TO public;

-- Add 'discarded' to sample_status enum if it doesn't exist
ALTER TYPE sample_status ADD VALUE IF NOT EXISTS 'discarded';

COMMENT ON TYPE sample_status IS 
'Sample workflow statuses: received, assigned, in_progress, review, discarded, completed';
