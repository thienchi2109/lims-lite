-- Migration: Add service role access for user_signatures
-- Purpose: Allow service role to access signatures for CoA generation
--
-- Context: When generating CoA, analysts need to embed the manager's signature.
-- The service role needs explicit GRANT permission to access the table,
-- even though it has BYPASSRLS privilege.

-- Grant SELECT permission to service_role
GRANT SELECT ON user_signatures TO service_role;

-- Add comment for documentation
COMMENT ON TABLE user_signatures IS
  'Manager e-signatures for CoA generation. Service role has SELECT access for cross-user signature retrieval.';
