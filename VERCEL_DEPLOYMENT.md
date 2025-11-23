# Complete Step-by-Step Guide: Deploy to Vercel (100% Free)

This guide will walk you through deploying your Next.js stock dashboard to Vercel completely free.

---

## Prerequisites Checklist

Before starting, make sure you have:

- ✅ Code pushed to GitHub (your repository: `nse-data-syncer`)
- ✅ A PostgreSQL database with connection string (Neon, Supabase, or any PostgreSQL provider)
- ✅ A GitHub account
- ✅ A Vercel account (we'll create this in Step 1)

---

## Step 1: Create Vercel Account (Free)

1. **Go to Vercel**: Visit [https://vercel.com/signup](https://vercel.com/signup)

2. **Sign Up Options**:
   - **Recommended**: Click "Continue with GitHub" (easiest, connects directly to your GitHub)
   - Or use email/password

3. **Authorize Vercel** (if using GitHub):
   - Click "Authorize Vercel" when prompted
   - This allows Vercel to access your GitHub repositories

4. **Complete Setup**:
   - Follow any onboarding steps
   - You'll land on the Vercel Dashboard

**✅ Vercel Free Tier Includes:**
- Unlimited deployments
- 100GB bandwidth per month
- Automatic HTTPS
- Custom domains (optional)
- No credit card required

---

## Step 2: Push Your Code to GitHub

If you haven't already:

1. **Check if code is pushed**:
   ```bash
   git status
   ```

2. **If you have uncommitted changes**:
   ```bash
   git add .
   git commit -m "Refactor codebase and prepare for deployment"
   git push origin main
   ```

3. **Verify on GitHub**:
   - Go to `https://github.com/gurudayal37/nse-data-syncer`
   - Make sure all your files are there, especially the `web/` folder

---

## Step 3: Import Project to Vercel

1. **Go to Vercel Dashboard**:
   - Visit [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - You should see "Add New..." button

2. **Add New Project**:
   - Click **"Add New..."** → **"Project"**

3. **Import Repository**:
   - You'll see a list of your GitHub repositories
   - Find and click on **`nse-data-syncer`** (or `data-syncer`)
   - Click **"Import"**

---

## Step 4: Configure Project Settings (CRITICAL)

After importing, you'll see the configuration screen. **Pay close attention here:**

### 4.1 Framework Preset
- **Framework Preset**: Should auto-detect as **"Next.js"**
- If not, select "Next.js" from the dropdown

### 4.2 Root Directory (⚠️ MOST IMPORTANT STEP)

**This is crucial!** Your Next.js app is in the `web/` folder, not the root.

1. Find **"Root Directory"** section
2. Click **"Edit"** button
3. Type or select: **`web`**
4. This tells Vercel where your Next.js app is located

### 4.3 Build and Output Settings

**Build Command**: Should be:
```
npm run build
```
or
```
prisma generate && next build
```

**Output Directory**: Leave as default (`.next`)

**Install Command**: Should be:
```
npm install
```

### 4.4 Environment Variables

**This is where you add your database connection:**

1. Scroll to **"Environment Variables"** section
2. Click **"Add"** or the input field
3. **Name**: `DATABASE_URL`
4. **Value**: Paste your PostgreSQL connection string
   - Example: `postgresql://user:password@host/dbname?sslmode=require`
   - Get this from your database provider (Neon, Supabase, etc.)
5. Click **"Add"** to save

**⚠️ Important**: 
- Make sure the connection string is correct
- It should be the same one you use locally in your `.env` file
- Don't include quotes around the value

---

## Step 5: Deploy

1. **Review Settings**:
   - Double-check:
     - ✅ Root Directory: `web`
     - ✅ Framework: Next.js
     - ✅ Environment Variable: `DATABASE_URL` is set

2. **Click "Deploy"**:
   - Big blue button at the bottom
   - Vercel will start building your project

3. **Watch the Build**:
   - You'll see a build log in real-time
   - This takes 2-5 minutes typically
   - Watch for any errors

---

## Step 6: Monitor Build Process

During the build, you'll see:

1. **Installing dependencies** (`npm install`)
2. **Generating Prisma Client** (`prisma generate`)
3. **Building Next.js** (`next build`)
4. **Deploying**

**If you see errors:**
- Check the build logs
- Common issues:
  - Missing `DATABASE_URL` → Add it in Environment Variables
  - Wrong Root Directory → Should be `web`
  - Build command error → Check `package.json` scripts

---

## Step 7: Access Your Live Site

Once deployment completes:

1. **Success Message**: You'll see "Congratulations! Your project has been deployed"

2. **Your Live URL**:
   - Vercel provides a URL like: `https://nse-data-syncer.vercel.app`
   - Or: `https://nse-data-syncer-xyz123.vercel.app`
   - Click the URL to open your site

3. **Test Your Dashboard**:
   - Open the URL in your browser
   - You should see your Stock Dashboard
   - Try clicking on a stock to see the detail page

---

## Step 8: Verify Everything Works

Test these features:

1. **Dashboard Page**:
   - ✅ Stocks list loads
   - ✅ Sorting works (click column headers)
   - ✅ Pagination works (Next/Previous buttons)

2. **Stock Detail Page**:
   - ✅ Click a stock symbol
   - ✅ Chart displays
   - ✅ Performance metrics show
   - ✅ News section displays (if available)

3. **Database Connection**:
   - ✅ Data loads from your database
   - ✅ No connection errors

---

## Step 9: Automatic Deployments (Bonus)

Vercel automatically deploys when you push to GitHub:

1. **Make a change** to your code
2. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Update dashboard"
   git push origin main
   ```

3. **Vercel Auto-Deploys**:
   - Go to Vercel Dashboard
   - You'll see a new deployment starting
   - It will deploy automatically
   - Your live site updates automatically!

---

## Troubleshooting Common Issues

### Issue 1: Build Fails - "Cannot find module"

**Solution**: 
- Check Root Directory is set to `web`
- Verify `package.json` exists in `web/` folder

### Issue 2: Database Connection Error

**Solution**:
- Verify `DATABASE_URL` environment variable is set
- Check connection string is correct (no quotes)
- Ensure database allows connections from Vercel's IPs

### Issue 3: Prisma Client Not Generated

**Solution**:
- Build command should include `prisma generate`
- Check `package.json` has: `"build": "prisma generate && next build"`

### Issue 4: 404 Errors on Routes

**Solution**:
- Make sure Root Directory is `web`
- Verify Next.js routing is correct

### Issue 5: Environment Variables Not Working

**Solution**:
- Go to Project Settings → Environment Variables
- Make sure variable name is exactly `DATABASE_URL`
- Redeploy after adding variables

---

## Step 10: Custom Domain (Optional - Still Free)

If you want a custom domain:

1. **Go to Project Settings** → **Domains**
2. **Add Domain**: Enter your domain name
3. **Follow DNS Instructions**: Vercel will give you DNS records to add
4. **Wait for Propagation**: 24-48 hours typically

**Note**: You need to own a domain (purchase from Namecheap, GoDaddy, etc.)

---

## Summary

✅ **What You've Accomplished:**

1. Created free Vercel account
2. Deployed Next.js app to production
3. Connected to your database
4. Got a live URL (e.g., `https://your-app.vercel.app`)
5. Set up automatic deployments

✅ **Your App is Now:**
- Live on the internet
- Accessible to anyone with the URL
- Automatically updating when you push to GitHub
- Using HTTPS (secure)
- Completely free!

---

## Next Steps (Optional)

1. **Share Your App**: Send the Vercel URL to friends/family
2. **Monitor Usage**: Check Vercel Dashboard for analytics
3. **Set Up Backend**: Configure GitHub Actions for data syncing (see `DEPLOYMENT.md`)

---

## Need Help?

- **Vercel Docs**: [https://vercel.com/docs](https://vercel.com/docs)
- **Vercel Support**: [https://vercel.com/support](https://vercel.com/support)
- **Check Build Logs**: In Vercel Dashboard → Your Project → Deployments → Click on deployment

---

**🎉 Congratulations! Your stock dashboard is now live on the internet!**

