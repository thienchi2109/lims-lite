# SQL Migration Patterns

Common SQL patterns for database migrations in CDC-LIMS.

## Creating a New Migration

```bash
# Naming convention: XXX_description.sql
# Example: 026_add_user_preferences.sql
touch supabase/migrations/026_add_user_preferences.sql
```

## Apply Migration

```bash
# Windows (PowerShell)
Get-Content supabase\migrations\026_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Linux/macOS
cat supabase/migrations/026_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# If migration adds/modifies RPC functions, restart PostgREST
docker compose restart rest
```

## Verify Migration

```bash
# Check table structure
docker exec lims-postgres psql -U postgres -d postgres -c "\d table_name"

# Check policies
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM pg_policies WHERE tablename = 'table_name';"
```

## Common Patterns

### Adding a Column
```sql
ALTER TABLE samples
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
```

### Creating an Index
```sql
CREATE INDEX IF NOT EXISTS idx_samples_priority
ON samples(priority) WHERE deleted_at IS NULL;
```

### Adding RLS Policy
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;

CREATE POLICY "policy_name"
ON table_name FOR operation
USING (condition)
WITH CHECK (
    get_user_role() IN ('analyst', 'manager')
    AND other_conditions
);
```

### Creating RPC Function
```sql
CREATE OR REPLACE FUNCTION function_name(params)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
SET search_path = public
AS $$
BEGIN
    -- Function body
END;
$$;

GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```

### Table with RLS
```sql
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    preferences JSONB DEFAULT '{}'
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
ON user_preferences FOR SELECT
USING (user_id = auth.uid());
```

## Best Practices

1. **Use idempotent SQL**: `IF NOT EXISTS`, `IF EXISTS`, `DROP ... IF EXISTS`
2. **Always enable RLS**: `ALTER TABLE new_table ENABLE ROW LEVEL SECURITY`
3. **Include role checks**: `get_user_role() IN ('analyst', 'manager')`
4. **Never use Studio for schema changes**: Use versioned migration files only

## See Also

- [MIGRATION_SECURITY_CHECKLIST.md](MIGRATION_SECURITY_CHECKLIST.md) - Security verification steps
- [SEARCH_SETUP.md](SEARCH_SETUP.md) - Full-text search patterns
- [DATABASE_SETUP.md](DATABASE_SETUP.md) - Initial database setup
