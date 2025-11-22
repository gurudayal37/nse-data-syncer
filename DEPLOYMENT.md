# Deployment Guide

We will deploy your application in two parts using free services:

1.  **Frontend (Web UI):** Deployed on **Vercel**.
2.  **Backend (Data Sync):** Runs on **GitHub Actions**.

---

## Part 1: Deploy Web UI to Vercel

Vercel is the creators of Next.js and offers the best free hosting for it.

### Prerequisites
1.  Push your code to a GitHub repository.
2.  Create a [Vercel account](https://vercel.com/signup).

### Steps
1.  Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub repository (`data-syncer`).
4.  **Configure Project:**
    *   **Framework Preset:** Next.js (should be auto-detected).
    *   **Root Directory:** Click "Edit" and select `web`. **(Crucial Step)**
    *   **Environment Variables:** Add the following:
        *   `DATABASE_URL`: Paste your NeonDB connection string (same as in your `.env` file).
5.  Click **"Deploy"**.

Vercel will build your site and give you a live URL (e.g., `https://your-project.vercel.app`).

---

## Part 2: Configure Backend Sync (GitHub Actions)

We already created the workflow file at `.github/workflows/daily_sync.yml`. This will run your Python script automatically every day at 6:00 PM IST.

### Steps
1.  Go to your GitHub Repository.
2.  Click on **Settings** -> **Secrets and variables** -> **Actions**.
3.  Click **"New repository secret"**.
4.  **Name:** `DATABASE_URL`
5.  **Value:** Paste your NeonDB connection string.
6.  Click **"Add secret"**.

### Verification
1.  Go to the **Actions** tab in your repository.
2.  Select "Daily Stock Sync" from the left sidebar.
3.  Click **"Run workflow"** manually to test it immediately.

---

## Summary
*   **Web UI:** Accessible via your Vercel URL. Updates automatically when you push to GitHub.
*   **Data:** Updates automatically every day via GitHub Actions.
