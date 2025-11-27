#!/bin/bash
# Complete database setup script
# Run this to apply all migrations and seed data

echo "==================================="
echo "CDC-LIMS Database Setup"
echo "==================================="

# Step 1: Enable uuid-ossp extension
echo "Step 1: Enabling uuid-ossp extension..."
docker exec lims-postgres psql -U postgres postgres -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Step 2: Create auth schema helpers (simplified)
echo "Step 2: Creating auth.uid() function..."
docker exec lims-postgres psql -U postgres postgres -c "
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS \$\$
    SELECT '00000000-0000-0000-0000-000000000000'::UUID;
\$\$ LANGUAGE SQL STABLE;
"

# Step 3: Apply migrations
echo "Step 3: Applying migration 001 (schema)..."
docker exec lims-postgres psql -U postgres postgres -f /tmp/migrations/001_initial_schema.sql > /dev/null 2>&1

echo "Step 4: Applying migration 002 (audit triggers)..."
docker exec lims-postgres psql -U postgres postgres -f /tmp/migrations/002_audit_triggers.sql > /dev/null 2>&1

echo "Step 5: Applying migration 003 (RLS policies)..."
docker exec lims-postgres psql -U postgres postgres -f /tmp/migrations/003_rls_policies.sql > /dev/null 2>&1

# Step 6: Seed data
echo "Step 6: Seeding database with test users and sample data..."
docker exec lims-postgres psql -U postgres postgres -f /tmp/migrations/006_complete_seed.sql

echo ""
echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo "Test Accounts Created:"
echo "  Analyst: analyst@cdc-lims.local / password123"
echo "  Manager: manager@cdc-lims.local / password123"
echo "==================================="
