#!/bin/bash

# Define the target .env file
ENV_FILE=".env"

echo "Configuring environment for GitHub Codespaces..."

# 1. Base Configuration - Uses environment variables or prompts for secrets
# NOTE: Secrets should be set via GitHub Codespace Secrets, NOT hardcoded!

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: POSTGRES_PASSWORD not set."
    echo "Please configure GitHub Codespace Secrets or export the variable."
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "ERROR: JWT_SECRET not set."
    echo "Please configure GitHub Codespace Secrets or export the variable."
    exit 1
fi

cat <<EOF > $ENV_FILE
# =============================================================================
# CDC-LIMS Environment Configuration (Auto-generated for Codespace)
# =============================================================================

# Database
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=14400
GOTRUE_REFRESH_TOKEN_EXPIRY=14400

# Auth
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ADDITIONAL_REDIRECT_URLS=

# PostgREST
PGRST_DB_SCHEMAS=public,storage,graphql_public

# Keys - These will be generated based on JWT_SECRET
# For development, use supabase demo keys
ANON_KEY=${ANON_KEY:-"YOUR_ANON_KEY_HERE"}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY:-"YOUR_SERVICE_ROLE_KEY_HERE"}

NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY:-"YOUR_ANON_KEY_HERE"}
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
