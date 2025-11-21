# Deploying to Render

This project is designed to run as a **Cron Job** on Render.

## Prerequisites
- A GitHub/GitLab repository containing this code.
- A MongoDB Atlas connection string (or other MongoDB provider).
- A Redis instance (e.g., Redis Cloud, Render Redis).

## Steps

1.  **Push to GitHub**: Push this code to a new repository.
2.  **Create New Cron Job**:
    - Go to your Render Dashboard.
    - Click **New +** -> **Cron Job**.
    - Connect your repository.
3.  **Configure Settings**:
    - **Name**: `redis-mongo-sync`
    - **Environment**: `Node`
    - **Schedule**: `0 * * * *` (Runs every hour, or choose your own schedule).
    - **Command**: `npm run cron`
4.  **Environment Variables**:
    Add the following environment variables in the "Advanced" section:
    - `MONGO_URI`: Your MongoDB connection string.
    - `REDIS_URL`: Your Redis connection string (must match the one used by your other app).
    - `REDIS_MATCH_PATTERN`: The key pattern to sync (e.g., `app_data:*` or `*`).

## Integration with Other App
Since you have another app writing to Redis:
1.  Ensure both apps use the **same Redis connection string**.
2.  Ensure both apps agree on the **key pattern**.
    - This sync job looks for keys matching `app_data:*`.
    - Your other app should save data using keys like `app_data:user_123`.
    - *If your keys are different, update `src/jobs/sync.js` line 5 (`const pattern = '...';`).*
