-- Enable required PostgreSQL extensions for CDC-LIMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Test that uuid generation works
SELECT uuid_generate_v4() AS test_uuid;
