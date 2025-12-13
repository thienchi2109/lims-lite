#!/bin/bash

# Define the target .env file
ENV_FILE=".env"

echo "Configuring environment for GitHub Codespaces..."

# 1. Base Configuration (copied from your env.md)
cat <<EOF > $ENV_FILE
# =============================================================================
# CDC-LIMS Environment Configuration (Auto-generated for Codespace)
# =============================================================================

# Database
POSTGRES_PASSWORD=3defe2084a9cc94b236423d40f41e59d301f37a9d8f218cbefcf83b348b19943

# JWT
JWT_SECRET=3d9867ac0994596c3be58fa3f9bb771b54ea39807d874d1351e0ec95010b3d82
JWT_EXPIRY=14400
GOTRUE_REFRESH_TOKEN_EXPIRY=14400

# Auth
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ADDITIONAL_REDIRECT_URLS=

# PostgREST
PGRST_DB_SCHEMAS=public,storage,graphql_public

# Keys
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
EOF

# 2. Dynamic URL Configuration
if [ -n "$CODESPACE_NAME" ]; then
    echo "Detected Codespace: $CODESPACE_NAME"
    
    # Construct the GitHub Codespaces URLs
    APP_URL="https://${CODESPACE_NAME}-3000.app.github.dev"
    API_URL="https://${CODESPACE_NAME}-8000.app.github.dev"
    
    echo "Setting SITE_URL to $APP_URL"
    echo "Setting API_EXTERNAL_URL to $API_URL"

    # Append dynamic URLs to .env
    echo "" >> $ENV_FILE
    echo "# Dynamic Codespace URLs" >> $ENV_FILE
    echo "SITE_URL=$APP_URL" >> $ENV_FILE
    echo "API_EXTERNAL_URL=$API_URL" >> $ENV_FILE
    echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL" >> $ENV_FILE
    
    # Also create .env.local for Next.js explicitly
    cp $ENV_FILE .env.local
    
    echo "Environment configuration complete."
else
    echo "Not running in a Codespace (CODESPACE_NAME not set)."
    echo "Falling back to localhost defaults."
    
    echo "" >> $ENV_FILE
    echo "# Localhost Defaults" >> $ENV_FILE
    echo "SITE_URL=http://localhost:3000" >> $ENV_FILE
    echo "API_EXTERNAL_URL=http://localhost:8000" >> $ENV_FILE
    echo "NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000" >> $ENV_FILE
    
    cp $ENV_FILE .env.local
fi
