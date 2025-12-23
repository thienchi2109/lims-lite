-- Migration 092: Add unique constraint on clients.phone
-- Security Impact: Low
-- Changes: Prevents duplicate client records with same phone number
--
-- This uses a partial unique index to:
-- 1. Enforce uniqueness for real phone numbers (10+ digits, not all zeros)
-- 2. Allow placeholder/test data (0000000000) to remain as-is

SET search_path TO public;

-- Create partial unique index that ignores placeholder phones
-- This allows test data with 0000000000 while preventing duplicates for real phones
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_phone
ON clients (phone)
WHERE phone IS NOT NULL
  AND phone != ''
  AND phone != '0000000000'
  AND length(phone) >= 10;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_clients_unique_phone IS
'Enforces unique phone numbers for real clients. Excludes placeholder data (0000000000).';
