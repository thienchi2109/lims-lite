# Deploying Self-Hosted Supabase to the Cloud

This guide covers deploying your self-hosted Supabase stack (from `docker-compose.yml`) to cloud providers so your Render-deployed Next.js app can access it from anywhere.

## Your Current Stack

Based on your `docker-compose.yml`, you're running:
- **PostgreSQL** (database)
- **GoTrue** (authentication service)
- **PostgREST** (REST API)
- **Storage API** (file storage)
- **Kong** (API gateway)
- **Studio** (admin dashboard)

## Cloud Provider Options

| Provider | Ease of Use | Cost | Best For |
|----------|-------------|------|----------|
| **Railway** | ⭐⭐⭐⭐⭐ Easiest | $$ | Quick deployment, docker-compose support |
| **Render** | ⭐⭐⭐⭐ Easy | $$ | Individual service control |
| **DigitalOcean** | ⭐⭐⭐ Moderate | $ | Cost-effective, full control |
| **Fly.io** | ⭐⭐⭐⭐ Easy | $ | Global edge deployment |

---

## Option 1: Railway (Recommended for Easiest Setup)

Railway has excellent docker-compose support and can deploy your entire stack with minimal configuration.

### Step 1: Prepare Your Repository

Create a simplified `railway-docker-compose.yml` (Railway doesn't support all docker-compose features):

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data

  auth:
    image: supabase/gotrue:v2.143.0
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: ${API_EXTERNAL_URL}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/postgres?search_path=auth
      GOTRUE_SITE_URL: ${SITE_URL}
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_JWT_EXP: 3600
      GOTRUE_EXTERNAL_EMAIL_ENABLED: true
      GOTRUE_MAILER_AUTOCONFIRM: true

  rest:
    image: postgrest/postgrest:v12.0.2
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      PGRST_DB_URI: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/postgres
      PGRST_DB_SCHEMAS: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}

  storage:
    image: supabase/storage-api:v0.46.4
    restart: unless-stopped
    depends_on:
      - postgres
      - rest
    environment:
      ANON_KEY: ${ANON_KEY}
      SERVICE_KEY: ${SERVICE_ROLE_KEY}
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/postgres
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: stub
      GLOBAL_S3_BUCKET: stub
    volumes:
      - storage-data:/var/lib/storage

  kong:
    image: kong:2.8.1
    restart: unless-stopped
    depends_on:
      - auth
      - rest
      - storage
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl
    volumes:
      - ./supabase/kong.yml:/var/lib/kong/kong.yml:ro

volumes:
  postgres-data:
  storage-data:
```

### Step 2: Deploy on Railway

1. **Create Railway Account**: [railway.app](https://railway.app)

2. **Create New Project**:
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli
   
   # Login
   railway login
   
   # Initialize project
   railway init
   ```

3. **Deploy**:
   ```bash
   railway up
   ```

4. **Set Environment Variables** in Railway dashboard:
   - `POSTGRES_PASSWORD` - Strong password
   - `JWT_SECRET` - 32+ character secret
   - `ANON_KEY` - Your Supabase anon key
   - `SERVICE_ROLE_KEY` - Your service role key
   - `API_EXTERNAL_URL` - Will be `https://your-project.up.railway.app`
   - `SITE_URL` - Your Next.js app URL on Render

5. **Get Kong Public URL**: Railway will assign a public URL to Kong (e.g., `https://kong-production-abc123.up.railway.app:8000`)

6. **Update Your Next.js App** environment variables on Render:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-kong-url.railway.app:8000
   ```

### Step 3: Run Database Migrations

Connect to your Railway PostgreSQL and run your migrations:

```bash
# Get database connection string from Railway
railway connect postgres

# Or use the Railway CLI to run migrations
railway run psql -f supabase/migrations/001_initial_schema.sql
```

---

## Option 2: Render (Individual Services)

Deploy each Supabase service separately on Render for more granular control.

### Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **PostgreSQL**
3. Configure:
   - **Name**: `lims-postgres`
   - **Region**: Same as your Next.js app
   - **Plan**: Free or Starter
4. Save the **Internal Database URL** and **External Database URL**

### Step 2: Deploy Kong API Gateway

1. **New +** → **Web Service**
2. **Deploy an Image**: `kong:2.8.1`
3. Settings:
   - **Name**: `lims-kong`
   - **Region**: Same as database
   - **Environment Variables**:
     ```
     KONG_DATABASE=off
     KONG_DECLARATIVE_CONFIG=/var/lib/kong/kong.yml
     KONG_DNS_ORDER=LAST,A,CNAME
     KONG_PLUGINS=request-transformer,cors,key-auth,acl
     ```
4. **Disk**:
   - Mount path: `/var/lib/kong`
   - Upload your `supabase/kong.yml`

### Step 3: Deploy GoTrue (Auth Service)

1. **New +** → **Web Service**
2. **Deploy an Image**: `supabase/gotrue:v2.143.0`
3. Settings:
   - **Name**: `lims-auth`
   - **Environment Variables**:
     ```
     GOTRUE_API_HOST=0.0.0.0
     GOTRUE_API_PORT=9999
     API_EXTERNAL_URL=https://your-kong-url.onrender.com
     GOTRUE_DB_DRIVER=postgres
     GOTRUE_DB_DATABASE_URL=<your_postgres_internal_url>?search_path=auth
     GOTRUE_SITE_URL=https://your-nextjs-app.onrender.com
     GOTRUE_JWT_SECRET=<your_jwt_secret>
     GOTRUE_JWT_EXP=3600
     GOTRUE_EXTERNAL_EMAIL_ENABLED=true
     GOTRUE_MAILER_AUTOCONFIRM=true
     ```

### Step 4: Deploy PostgREST (REST API)

1. **New +** → **Web Service**
2. **Deploy an Image**: `postgrest/postgrest:v12.0.2`
3. Settings:
   - **Name**: `lims-rest`
   - **Environment Variables**:
     ```
     PGRST_DB_URI=<your_postgres_internal_url>
     PGRST_DB_SCHEMAS=public,storage,graphql_public
     PGRST_DB_ANON_ROLE=anon
     PGRST_JWT_SECRET=<your_jwt_secret>
     ```

### Step 5: Deploy Storage API

1. **New +** → **Web Service**
2. **Deploy an Image**: `supabase/storage-api:v0.46.4`
3. Settings:
   - **Name**: `lims-storage`
   - **Environment Variables**:
     ```
     ANON_KEY=<your_anon_key>
     SERVICE_KEY=<your_service_role_key>
     POSTGREST_URL=http://lims-rest:3000
     PGRST_JWT_SECRET=<your_jwt_secret>
     DATABASE_URL=<your_postgres_internal_url>
     FILE_SIZE_LIMIT=52428800
     STORAGE_BACKEND=file
     FILE_STORAGE_BACKEND_PATH=/var/lib/storage
     ```
4. **Disk**: Persistent disk mounted at `/var/lib/storage`

### Step 6: Update Kong Configuration

Update your `supabase/kong.yml` to use Render's internal service URLs:
- `http://lims-auth:9999`
- `http://lims-rest:3000`
- `http://lims-storage:5000`

### Step 7: Connect Your Next.js App

Update Render environment variables for your Next.js app:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-kong-service.onrender.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
```

---

## Option 3: DigitalOcean (VPS/Droplet)

Most cost-effective for production workloads. Full control with SSH access.

### Step 1: Create a Droplet

1. Go to [DigitalOcean](https://www.digitalocean.com/)
2. **Create** → **Droplets**
3. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: Basic ($6/month minimum for Docker)
   - **Region**: Closest to users
   - **SSH Key**: Add your public key

### Step 2: Install Docker

SSH into your droplet:

```bash
ssh root@your_droplet_ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt-get install docker-compose-plugin
```

### Step 3: Deploy Your Stack

```bash
# Clone your repository
git clone https://github.com/your-username/lims-lite.git
cd lims-lite

# Create .env file
nano .env
```

Add your environment variables:
```env
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_min_32_chars
ANON_KEY=your_anon_key
SERVICE_ROLE_KEY=your_service_role_key
API_EXTERNAL_URL=http://your_droplet_ip:8000
SITE_URL=https://your-nextjs-app.onrender.com
```

```bash
# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 4: Run Database Migrations

```bash
# Access PostgreSQL container
docker exec -it lims-postgres psql -U postgres

# Or run migration files
docker exec -i lims-postgres psql -U postgres < supabase/migrations/001_initial_schema.sql
```

### Step 5: Configure Firewall

```bash
# Allow necessary ports
ufw allow ssh
ufw allow 8000/tcp    # Kong API
ufw enable

# Optionally allow individual services for debugging
ufw allow 5432/tcp    # PostgreSQL
ufw allow 9999/tcp    # Auth
```

### Step 6: Set Up Domain (Optional but Recommended)

1. Point your domain to droplet IP
2. Install Nginx as reverse proxy:
   ```bash
   apt install nginx certbot python3-certbot-nginx
   ```

3. Configure Nginx:
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

4. Get SSL certificate:
   ```bash
   certbot --nginx -d api.yourdomain.com
   ```

### Step 7: Update Your Next.js App

```
NEXT_PUBLIC_SUPABASE_URL=https://api.yourdomain.com
# or http://your_droplet_ip:8000
```

---

## Option 4: Fly.io (Global Edge Deployment)

Great for low-latency global deployment.

### Step 1: Install Fly CLI

```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Login
fly auth login
```

### Step 2: Create fly.toml

```toml
app = "lims-supabase"

[build]
  image = "kong:2.8.1"

[[services]]
  internal_port = 8000
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

### Step 3: Deploy Services

```bash
# Deploy Kong
fly launch --image kong:2.8.1 --name lims-kong

# Deploy PostgreSQL
fly postgres create --name lims-postgres

# Deploy other services similarly
fly launch --image supabase/gotrue:v2.143.0 --name lims-auth
fly launch --image postgrest/postgrest:v12.0.2 --name lims-rest
fly launch --image supabase/storage-api:v0.46.4 --name lims-storage
```

---

## Post-Deployment Checklist

### 1. Verify Services Are Running

Test each endpoint:
```bash
# Health check
curl https://your-api-url/health

# Auth endpoint
curl https://your-api-url/auth/v1/health

# REST API
curl https://your-api-url/rest/v1/
```

### 2. Run Database Migrations

Make sure all tables, RLS policies, and functions are created:
```bash
# Run all migrations in order
psql -f supabase/migrations/001_initial_schema.sql
psql -f supabase/migrations/002_rls_policies.sql
# ... etc
```

### 3. Test Authentication

Create a test user and verify login works from your Next.js app.

### 4. Update Environment Variables

In your Next.js app on Render, update:
- `NEXT_PUBLIC_SUPABASE_URL` → Your cloud Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Your anon key
- `SUPABASE_SERVICE_ROLE_KEY` → Your service role key

### 5. Test End-to-End

- Login to your app
- Create a sample
- Assign tests
- Verify data is persisted

---

## Security Best Practices

> [!IMPORTANT]
> Secure your cloud deployment properly!

### Essential Security Steps:

1. **Use Strong Secrets**:
   ```bash
   # Generate secure JWT secret (32+ chars)
   openssl rand -base64 32
   ```

2. **Enable SSL/TLS**: Always use HTTPS in production

3. **Restrict Database Access**: 
   - Use internal URLs for service-to-service communication
   - Only expose Kong publicly
   - Set up firewall rules

4. **Set Up RLS Policies**: Ensure Row Level Security is enabled

5. **Regular Backups**:
   - Railway: Automatic backups included
   - Render: Configure backup schedules
   - DigitalOcean: Use snapshots or DigitalOcean Spaces

---

## Cost Comparison (Monthly)

| Provider | Minimal Setup | Production Setup |
|----------|---------------|------------------|
| **Railway** | $5 (free tier available) | $20-40 |
| **Render** | $0 (free tier) | $25-50 |
| **DigitalOcean** | $6 (single droplet) | $12-24 |
| **Fly.io** | $0 (free tier) | $10-30 |

---

## Troubleshooting

### Services Can't Connect to Database

**Problem**: Connection refused or timeout errors

**Solution**:
- Use internal/private URLs for service-to-service communication
- Check that database is in same region/network
- Verify connection strings have correct format

### Kong Returns 503 Errors

**Problem**: Kong can't reach upstream services

**Solution**:
- Update `kong.yml` with correct service URLs
- Check that auth/rest/storage services are running
- Verify network connectivity between services

### Migrations Fail

**Problem**: Tables already exist or permissions denied

**Solution**:
```bash
# Drop all tables and start fresh (DEV ONLY!)
psql -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Then re-run migrations
```

### Storage Files Not Persisting

**Problem**: Uploaded files disappear after restart

**Solution**:
- Configure persistent volumes/disks
- Railway: Volumes auto-persisted
- Render: Add persistent disk to storage service
- DigitalOcean: Named volumes in docker-compose

---

## Next Steps

- [ ] Choose a cloud provider
- [ ] Deploy your Supabase stack
- [ ] Run database migrations
- [ ] Update Next.js app environment variables
- [ ] Test end-to-end functionality
- [ ] Set up monitoring and alerts
- [ ] Configure automated backups
- [ ] Set up custom domain with SSL

## Resources

- [Railway Documentation](https://docs.railway.app/)
- [Render Docker Guide](https://render.com/docs/docker)
- [DigitalOcean Docker Tutorial](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-22-04)
- [Fly.io Documentation](https://fly.io/docs/)
- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)
