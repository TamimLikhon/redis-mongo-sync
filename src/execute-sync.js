const connectDB = require('./config/db');
const redisClient = require('./config/redis');
const syncData = require('./jobs/sync');
require('dotenv').config();

const run = async () => {
    try {
        console.log('Initializing Cron Job execution...');

        // 1. Connect to MongoDB
        await connectDB();

        // 2. Ensure Redis is connected
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }

        // 3. Run the Sync Logic
        await syncData();

        console.log('Sync execution finished.');
        process.exit(0);
    } catch (error) {
        console.error('Cron Job Failed:', error);
        process.exit(1);
    }
};

run();
