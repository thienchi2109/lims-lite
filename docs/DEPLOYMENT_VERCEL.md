# Deploying CDC-LIMS to Vercel

This guide covers deploying the CDC-LIMS application to Vercel with proper configuration for the CoA Public Portal and QR code system.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Steps](#deployment-steps)
- [Environment Variables](#environment-variables)
- [Custom Domain Setup](#custom-domain-setup)
- [QR Code Configuration](#qr-code-configuration)
- [Production Checklist](#production-checklist)

## Prerequisites

- Vercel account (sign up at [vercel.com](https://vercel.com))
- GitHub repository with your CDC-LIMS code
- Production Supabase instance or self-hosted Supabase deployment
- Custom domain (optional but recommended)

## Deployment Steps

### 1. Connect GitHub Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js configuration

### 2. Configure Build Settings

Vercel should auto-detect these settings:

```
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

**No changes needed** - use defaults for Next.js 16.

### 3. Set Environment Variables

In Vercel project settings → **Environment Variables**, add:

#### Required Variables

```bash
# Supabase Configuration (Production)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# JWT Configuration (Generate new secrets for production!)
JWT_SECRET=your_production_jwt_secret_here
JWT_EXPIRY=14400

# Application URL (Set your custom domain or Vercel URL)
NEXT_PUBLIC_APP_URL=https://lims.yourdomain.com
```

#### Security Variables (Must Change!)

```bash
# Generate new secure values:
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 32)
```

#### Optional Variables

```bash
# Database (if self-hosted)
POSTGRES_PASSWORD=your_secure_password

# Analytics (optional)
NEXT_PUBLIC_GA_ID=your_google_analytics_id
```

### 4. Deploy

1. Click **"Deploy"**
2. Vercel will build and deploy your app
3. Your app will be available at `https://your-project.vercel.app`

## Environment Variables

### Development vs Production

| Variable | Development | Production |
|----------|-------------|------------|
| `NEXT_PUBLIC_APP_URL` | (empty - auto-detect) | `https://lims.yourdomain.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | `http://localhost:8000` | `https://your-project.supabase.co` |
| `JWT_SECRET` | Demo key | **New secure secret** |
| `POSTGRES_PASSWORD` | Demo password | **New secure password** |

### NEXT_PUBLIC_APP_URL Behavior

```typescript
// In portal-qr-code.tsx
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
               `${window.location.protocol}//${window.location.host}`
```

**If NOT set:**
- Local dev: `http://localhost:3000/coa/access`
- Vercel preview: `https://lims-lite-abc123.vercel.app/coa/access`
- Vercel production: `https://lims-lite.vercel.app/coa/access`

**If set to `https://lims.yourdomain.com`:**
- All environments: `https://lims.yourdomain.com/coa/access`

**Recommendation:** Set in production for consistent QR codes, leave empty in development.

## Custom Domain Setup

### 1. Add Domain in Vercel

1. Go to **Project Settings** → **Domains**
2. Click **"Add"**
3. Enter your domain: `lims.yourdomain.com`
4. Follow DNS configuration instructions

### 2. DNS Configuration

Add these DNS records at your domain registrar:

**Option A: CNAME (Recommended)**
```
Type: CNAME
Name: lims
Value: cname.vercel-dns.com
```

**Option B: A Record**
```
Type: A
Name: lims
Value: 76.76.21.21
```

### 3. Update Environment Variable

Once domain is verified:

```bash
NEXT_PUBLIC_APP_URL=https://lims.yourdomain.com
```

### 4. Redeploy

Trigger a new deployment for the environment variable to take effect.

## QR Code Configuration

### Automatic QR Code Updates

✅ **Good news:** QR codes automatically use the production URL once `NEXT_PUBLIC_APP_URL` is set!

### After Deployment

1. **Log into manager dashboard**
2. Go to **"Mã QR Cổng Tra Cứu"** page
3. **Regenerate and print new QR codes** with production URL
4. Replace old QR codes at reception desks

### QR Code Distribution

Print and distribute QR codes to:
- ✅ Reception desk displays
- ✅ Sample collection flyers
- ✅ Patient information packets
- ✅ Social media (Facebook page, website)

## Production Checklist

### Security

- [ ] Change `JWT_SECRET` to new secure value
- [ ] Change `POSTGRES_PASSWORD` to new secure password
- [ ] Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` with production key
- [ ] Enable HTTPS only (automatic with Vercel)
- [ ] Set up custom domain (recommended)
- [ ] Review and update Supabase RLS policies

### Configuration

- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Configure CORS in Supabase (allow production domain)
- [ ] Update Supabase redirect URLs
- [ ] Test authentication flow end-to-end

### QR Codes

- [ ] Verify QR code generates production URL
- [ ] Print new QR codes for distribution
- [ ] Update QR codes on existing materials
- [ ] Test QR code scanning from mobile devices

### Testing

- [ ] Test public portal at `/coa/access`
- [ ] Scan QR code and verify redirect
- [ ] Test phone number authentication
- [ ] Download sample CoA report
- [ ] Check audit logs in database
- [ ] Test rate limiting (5 failed attempts)

### Performance

- [ ] Enable Vercel Analytics (optional)
- [ ] Monitor Core Web Vitals
- [ ] Set up error tracking (Sentry recommended)

## Deployment Environments

Vercel automatically creates:

### Production

- **URL:** `https://your-project.vercel.app`
- **Custom:** `https://lims.yourdomain.com`
- **Triggered by:** Push to `main` branch
- **Environment:** Production variables

### Preview

- **URL:** `https://lims-lite-abc123.vercel.app` (unique per PR)
- **Triggered by:** Pull requests and non-main branches
- **Environment:** Preview variables (can be same as production)

### Development

- **URL:** `http://localhost:3000`
- **Environment:** Local `.env` file

## Environment-Specific QR Codes

### Development (localhost)

```
QR Code URL: http://localhost:3000/coa/access
Use: Internal testing only
```

### Staging/Preview (Vercel preview)

```
QR Code URL: https://lims-lite-preview.vercel.app/coa/access
Use: UAT testing with stakeholders
```

### Production (custom domain)

```
QR Code URL: https://lims.yourdomain.com/coa/access
Use: Public distribution to clients
```

## Troubleshooting

### QR Code Shows Wrong URL

**Problem:** QR code points to `localhost` or preview URL in production

**Solution:**
1. Verify `NEXT_PUBLIC_APP_URL` is set correctly
2. Redeploy the application
3. Hard refresh browser cache (Ctrl+Shift+R)
4. Regenerate QR code from `/manager/qr-code` page

### Public Portal Not Accessible

**Problem:** `/coa/access` page returns 404

**Solution:**
1. Verify deployment succeeded
2. Check build logs for errors
3. Ensure `src/app/coa/access/page.tsx` is in repository
4. Try redeploying

### Authentication Fails

**Problem:** Phone number authentication returns errors

**Solution:**
1. Check Supabase connection (verify `NEXT_PUBLIC_SUPABASE_URL`)
2. Verify API keys are correct
3. Check CORS settings in Supabase dashboard
4. Review server logs in Vercel Functions

### Database Connection Issues

**Problem:** Cannot connect to Supabase/PostgreSQL

**Solution:**
1. Verify `NEXT_PUBLIC_SUPABASE_URL` format (must be full URL with https://)
2. Check Supabase project is not paused
3. Verify network access in Supabase settings
4. Test connection with Supabase client directly

## Best Practices

### 1. Use Custom Domain

❌ **Don't:** Use Vercel subdomain for QR codes
```
https://lims-lite.vercel.app/coa/access
```

✅ **Do:** Use custom domain
```
https://lims.yourdomain.com/coa/access
```

**Why:** Custom domain is more professional and unchanging

### 2. Separate Environments

- **Development:** Local with Docker Supabase
- **Staging:** Vercel preview with staging Supabase
- **Production:** Vercel production with production Supabase

### 3. Security

- Never commit `.env` files with production secrets
- Rotate JWT secrets periodically
- Monitor rate limiting logs
- Review audit logs regularly

### 4. Monitoring

Set up:
- Vercel Analytics for performance
- Sentry for error tracking
- Custom dashboard for CoA access metrics
- Alert when rate limit is hit frequently

## Support

For deployment issues:
- Vercel Docs: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Supabase Docs: https://supabase.com/docs

For CDC-LIMS specific issues:
- Check `docs/` folder for additional documentation
- Review migration files in `supabase/migrations/`
- Contact system administrator
