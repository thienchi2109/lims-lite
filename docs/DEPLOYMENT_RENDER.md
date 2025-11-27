# Deploying LIMS-Lite to Render with Docker

This guide walks you through deploying your LIMS-Lite application on Render using Docker.

## Prerequisites

- Render account ([sign up here](https://dashboard.render.com/register))
- Git repository pushed to GitHub/GitLab/Bitbucket
- Supabase project (for database and auth services)

## Files Created

✅ **Dockerfile** - Multi-stage Docker build optimized for Next.js production
✅ **.dockerignore** - Excludes unnecessary files from build context
✅ **next.config.ts** - Updated with `output: 'standalone'` for Docker

## Deployment Steps

### 1. Push Your Code to Git

Make sure all recent changes are committed and pushed:

```bash
git add Dockerfile .dockerignore next.config.ts
git commit -m "feat: Add Docker configuration for Render deployment"
git push origin main
```

### 2. Create a New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your Git repository
4. Select your `lims-lite` repository

### 3. Configure the Service

#### Basic Settings:
- **Name**: `lims-lite` (or your preferred name)
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave blank (Dockerfile is in root)

#### Build Settings:
- **Runtime**: Select **Docker** from the dropdown
- **Dockerfile Path**: `Dockerfile` (default, since it's in the root)
- **Docker Command**: Leave blank (uses CMD from Dockerfile)

#### Instance Type:
- **Free** tier for testing
- **Starter** ($7/month) or higher for production

### 4. Set Environment Variables

Click **"Advanced"** and add these environment variables:

> [!IMPORTANT]
> You must configure these variables for your app to work properly.

#### Required Variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Your Supabase service role key (keep secret!) |

#### Optional Variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Sets Node environment |
| `PORT` | `3000` | Port (Render auto-assigns if not set) |

#### Where to Find Supabase Keys:

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 5. Deploy!

Click **"Deploy Web Service"**

Render will:
1. Clone your repository
2. Build the Docker image using your Dockerfile
3. Deploy the container
4. Provide you with a URL like `https://lims-lite.onrender.com`

The first build takes 3-5 minutes. You can watch the logs in real-time.

### 6. Configure Supabase Redirect URLs

After deployment, add your Render URL to Supabase allowed redirect URLs:

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   ```
   https://your-app-name.onrender.com/api/auth/callback
   ```
3. Add to **Site URL** (if using as primary):
   ```
   https://your-app-name.onrender.com
   ```

## Local Docker Testing (Optional)

Test your Docker setup locally before deploying:

```bash
# Build the image
docker build -t lims-lite .

# Run the container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  lims-lite
```

Visit `http://localhost:3000` to test.

## Render-Specific Features

### Auto-Deploy
By default, Render automatically deploys when you push to your main branch.

### Custom Domain
1. Go to **Settings** → **Custom Domain**
2. Add your domain (e.g., `lims.yourcompany.com`)
3. Update your DNS records as instructed
4. Render provides free SSL/TLS certificates

### Health Checks
Render automatically monitors your service. Next.js provides a health endpoint at `/api/health` (you may need to create this).

### Logs
View real-time logs in the Render dashboard under the **Logs** tab.

### Scaling
Upgrade your instance type or enable auto-scaling in **Settings**.

## Troubleshooting

### Build Fails
- Check the build logs in Render dashboard
- Verify Dockerfile syntax
- Ensure all dependencies are in `package.json`

### App Doesn't Start
- Check environment variables are set correctly
- Review container logs in Render dashboard
- Verify Supabase connection settings

### Database Connection Issues
- Ensure Supabase project is running
- Check that environment variables match your Supabase project
- Verify network connectivity (Supabase allows connections from all IPs by default)

### Port Binding Issues
- Render automatically assigns a port via `$PORT` environment variable
- The Dockerfile exposes port 3000, which should work by default

## Cost Optimization

- **Free Tier**: Services spin down after 15 minutes of inactivity (may cause slow first load)
- **Starter Plan** ($7/month): Always running, no spin-down, better performance
- Use **PostgreSQL** on Render for database if needed (separate from Supabase)

## Next Steps

- [ ] Set up custom domain
- [ ] Enable auto-deploy from GitHub
- [ ] Configure health check endpoints
- [ ] Set up monitoring and alerts
- [ ] Consider adding a `render.yaml` for Infrastructure as Code

## Resources

- [Render Docker Documentation](https://render.com/docs/docker)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Render Custom Domains](https://render.com/docs/custom-domains)
