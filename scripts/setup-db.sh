#!/bin/bash

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if POSTGRES_PASSWORD is set
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "Error: POSTGRES_PASSWORD is not set in .env"
    echo "Please run ./scripts/setup-codespace.sh first."
    exit 1
fi

echo "Waiting for database to be ready..."
until docker exec lims-postgres pg_isready -U postgres; do
    echo "Postgres is unavailable - sleeping"
    sleep 1
done

echo "Database is ready!"

# CRITICAL FIX: Create the 'auth' schema manually.
# The Supabase GoTrue (Auth) service crashes if the 'auth' schema doesn't exist
# when 'search_path=auth' is used in the connection string.
echo "Ensuring 'auth' schema exists..."
docker exec lims-postgres psql -U postgres -d postgres -c "CREATE SCHEMA IF NOT EXISTS auth;"

echo "Waiting for Supabase Auth service to initialize tables..."
echo "(This ensures the 'auth' container has finished its own migrations)"

# Loop until auth.users exists
MAX_RETRIES=60
COUNT=0
while [ $COUNT -lt $MAX_RETRIES ]; do
    if docker exec lims-postgres psql -U postgres -d postgres -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users';" | grep -q 1; then
        echo "✅ Supabase Auth schema detected!"
        break
    fi
    echo "Waiting for auth.users table... ($COUNT/$MAX_RETRIES)"
    sleep 2
    COUNT=$((COUNT+1))
done

if [ $COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Error: Timed out waiting for Supabase Auth schema."
    echo "Please check if the 'auth' container is running: docker compose ps"
    exit 1
fi

echo "Starting app migrations..."

# Export password for psql
export PGPASSWORD="$POSTGRES_PASSWORD"

# Function to run SQL file
run_sql() {
    local file=$1
    echo "Applying $file..."
    docker exec -i lims-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file"
    
    if [ $? -ne 0 ]; then
        echo "Error applying $file"
        exit 1
    fi
}

# 1. Apply all migrations in order
for file in supabase/migrations/*.sql; do
    [ -e "$file" ] || continue
    run_sql "$file"
done

# 2. Apply the specific seed-data.sql requested
if [ -f "scripts/seed-data.sql" ]; then
    echo "Applying final seed data (scripts/seed-data.sql)..."
    run_sql "scripts/seed-data.sql"
fi

echo "----------------------------------------"
echo "✅ Database setup complete!"
echo "----------------------------------------"
