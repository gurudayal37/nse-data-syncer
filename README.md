# NSE Stock Data Syncer

A Python application to sync daily OHLCV data for NSE stocks from Yahoo Finance to a PostgreSQL database.

## Features
- Fetches data for ~750 NSE symbols.
- Incremental sync (only fetches missing data).
- Handles `.NS` suffix for Yahoo Finance.
- Deployed via GitHub Actions for daily updates.

## Setup

### Local Development

1.  **Clone the repository**:
    ```bash
    git clone <repo-url>
    cd data-syncer
    ```

2.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Set Environment Variables**:
    You need to set the `DATABASE_URL` environment variable.
    ```bash
    export DATABASE_URL='postgresql://user:password@host/dbname?sslmode=require'
    ```

4.  **Run Sync**:
    ```bash
    python -m app.main
    ```
    - Options:
        - `--limit N`: Process only first N symbols.
        - `--dry-run`: Fetch data but don't write to DB.
        - `--symbols SYM1,SYM2`: Process specific symbols only.

### Creating a GitHub Repository (Free)

1.  **Log in to GitHub**: Go to [github.com](https://github.com) and log in.
2.  **Create New Repo**: Click the **+** icon in the top-right corner and select **New repository**.
3.  **Repository Details**:
    - **Repository name**: `nse-data-syncer` (or any name you like).
    - **Public/Private**: Choose **Public** (free for everyone) or **Private** (free for individuals).
    - **Initialize**: Do **NOT** check "Add a README", ".gitignore", or "license" (we already have these locally).
4.  **Create**: Click **Create repository**.
5.  **Copy URL**: Copy the HTTPS URL provided (e.g., `https://github.com/username/nse-data-syncer.git`).

### GitHub Actions Deployment

1.  **Push code to GitHub**.
2.  **Add Secret**:
    - Go to Settings > Secrets and variables > Actions.
    - Add a New repository secret named `DATABASE_URL`.
    - Paste your connection string.
3.  **Run Workflow**:
    - Go to the "Actions" tab.
    - Select "Daily Stock Data Sync".
    - Click "Run workflow" to test manually.
    - It will also run automatically every day at 18:00 IST.
