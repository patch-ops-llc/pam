# Railway Deployment Guide - PAM (PatchOps Agency Manager)

## Overview

This project has been refactored from Replit to Railway. The key changes:

- **Removed**: Replit Vite plugins, Replit sidecar (object storage), Replit connectors (SendGrid)
- **Added**: Dockerfile, `railway.toml`, standard GCS service account auth, direct SendGrid API key
- **Updated**: Google OAuth callback (uses `APP_URL` only), email service, object storage client

---

## 1. Prerequisites

- A [Railway](https://railway.app) account
- A GitHub account
- [Git](https://git-scm.com/) installed locally
- Your existing Neon PostgreSQL database URL (or provision one on Railway)
- Google Cloud service account JSON key for GCS
- SendGrid API key
- *(Optional)* [Railway CLI](https://docs.railway.app/guides/cli) installed (`npm i -g @railway/cli`)

---

## 2. Push to GitHub & Connect to Railway

### Step 1: Create a GitHub repo

```bash
# Navigate into the project
cd PAM

# Initialize git (if not already)
git init

# Add all files
git add .
git commit -m "Refactor for Railway deployment"

# Create a new repo on GitHub (via gh CLI or the GitHub UI)
gh repo create patchops-pam --private --source=. --push
# Or manually:
#   git remote add origin https://github.com/YOUR_USERNAME/patchops-pam.git
#   git push -u origin main
```

### Step 2: Connect GitHub to Railway

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub Repo"**
4. Authorize Railway to access your GitHub account (if first time)
5. Select your **patchops-pam** repository
6. Railway will auto-detect the `Dockerfile` and `railway.toml` and begin the first build

> Every push to your default branch will now trigger an automatic deployment on Railway.

---

## 3. Environment Variables

Set all variables in the Railway dashboard (**Service > Variables**) or via CLI:

```bash
# Required
railway variables set DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
railway variables set SESSION_SECRET="$(openssl rand -hex 32)"
railway variables set APP_URL="https://work.patchops.io"
railway variables set NODE_ENV="production"

# SendGrid (email)
railway variables set SENDGRID_API_KEY="SG.xxxxxxxxxxxx"
railway variables set SENDGRID_FROM_EMAIL="noreply@yourdomain.com"

# Google OAuth
railway variables set GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
railway variables set GOOGLE_CLIENT_SECRET="your-client-secret"

# Anthropic AI
railway variables set ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxx"

# Google Cloud Storage
# Paste the FULL JSON key as a single-line string
railway variables set GCS_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
railway variables set PUBLIC_OBJECT_SEARCH_PATHS="/your-bucket/public"
railway variables set PRIVATE_OBJECT_DIR="/your-bucket/private"

# UAT domains
railway variables set UAT_CUSTOM_DOMAIN="https://testhub.us"
railway variables set VITE_UAT_CUSTOM_DOMAIN="https://testhub.us"
```

> **Tip**: For `GCS_SERVICE_ACCOUNT_KEY`, copy the full JSON content from your GCP service account key file and paste it as the value. Railway handles multi-line/JSON values well in the dashboard UI.

See `.env.example` for a complete reference of all variables.

---

## 4. Database Migration

### Option A: Keep your existing Neon database (recommended)

If you're already using Neon PostgreSQL on Replit, just copy the same `DATABASE_URL` to Railway. No data migration needed — the app will connect to the same database.

```bash
# Verify connectivity after setting DATABASE_URL
railway run npx drizzle-kit push
```

### Option B: Migrate to a Railway-managed PostgreSQL

1. **Add PostgreSQL plugin** in the Railway dashboard (click "+ New" > "Database" > "PostgreSQL")

2. **Export data from your Neon database**:
   ```bash
   # From your local machine with the OLD DATABASE_URL
   DATABASE_URL="postgresql://old-neon-url" npx tsx scripts/export-database.ts
   ```
   This creates JSON files in `database_exports/YYYY-MM-DD/`.

3. **Push schema to new Railway database**:
   ```bash
   # Set the new Railway PostgreSQL URL
   DATABASE_URL="postgresql://new-railway-url" npx drizzle-kit push
   ```

4. **Import data into new database**:
   ```bash
   DATABASE_URL="postgresql://new-railway-url" npx tsx scripts/import-database.ts
   ```

### Option C: Fresh start with schema only

```bash
# Push the Drizzle schema to create all tables
railway run npx drizzle-kit push
```

### Running future migrations

When you modify `shared/schema.ts`:

```bash
# Generate a migration file
npm run db:generate

# Apply migrations
railway run npm run db:push
```

---

## 5. Google OAuth Setup

Update your Google Cloud Console OAuth credentials:

1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. **Add** the Railway domain to Authorized redirect URIs:
   ```
   https://work.patchops.io/auth/google/callback
   ```
4. If you're using a Railway-generated domain during testing, also add:
   ```
   https://your-app.up.railway.app/auth/google/callback
   ```

---

## 6. Custom Domain

1. In Railway dashboard, go to your service > **Settings** > **Networking**
2. Click **"Generate Domain"** to get a `*.up.railway.app` URL
3. To use your custom domain (`work.patchops.io`):
   - Click **"Add Custom Domain"**
   - Enter `work.patchops.io`
   - Add the CNAME record Railway provides to your DNS
   - Railway auto-provisions SSL

---

## 7. Deploy

### Automatic deploys (via GitHub)

Once your repo is connected (Step 2), every push to your default branch triggers a deploy automatically:

```bash
git add .
git commit -m "your change"
git push
```

Railway will build the Dockerfile, run the healthcheck, and swap traffic to the new container.

### Manual deploy (via CLI, optional)

If you prefer a one-off deploy without pushing to GitHub:

```bash
railway login
railway link
railway up
```

### Monitoring

```bash
# View logs (CLI)
railway logs

# Or in the Railway dashboard: click your service > "Deployments" > click a deploy > "Logs"
```

You can also view build logs, runtime logs, and deployment history directly in the Railway dashboard.

---

## 8. SendGrid Migration

The app previously used Replit's SendGrid connector (fetching credentials via the Replit sidecar). Now it reads credentials directly from environment variables.

**What changed:**
- `SENDGRID_API_KEY` — your SendGrid API key (from https://app.sendgrid.com/settings/api_keys)
- `SENDGRID_FROM_EMAIL` — your verified sender email in SendGrid

If you were using the same SendGrid account on Replit, copy the API key from your SendGrid dashboard.

---

## 9. Object Storage Migration

The app previously used Replit's object storage sidecar (`http://127.0.0.1:1106`). Now it uses standard Google Cloud Storage authentication.

**What changed:**
- Set `GCS_SERVICE_ACCOUNT_KEY` to your GCS service account JSON key contents
- Or set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your key file

If you're using the same GCS bucket from Replit, your files are already there — just provide proper credentials.

---

## 10. Rollback

If you need to rollback a deployment:

**Option A — Railway dashboard**: Go to your service > **Deployments** > click the three-dot menu on a previous successful deploy > **"Rollback"**

**Option B — Git revert**: Since deploys are tied to GitHub pushes, you can also revert in git:
```bash
git revert HEAD
git push
```

**Option C — CLI**:
```bash
railway rollback
```

---

## 11. Local Development

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env
# Edit .env with your values

# Run locally
npm run dev
```

The app runs on `http://localhost:5000` by default.

---

## Architecture Summary

```
┌─────────────────────────────────────────┐
│              Railway Service             │
│                                          │
│  ┌──────────┐     ┌──────────────────┐  │
│  │  Vite    │     │   Express API    │  │
│  │  (build) │────▶│   (dist/index.js)│  │
│  └──────────┘     └───────┬──────────┘  │
│                           │              │
└───────────────────────────┼──────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
    ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
    │  Neon/PG    │  │   GCS      │  │  SendGrid   │
    │  Database   │  │  Storage   │  │  Email API  │
    └─────────────┘  └────────────┘  └─────────────┘
```
