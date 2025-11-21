const redisClient = require('../src/config/redis');
const connectDB = require('../src/config/db');
const Data = require('../src/models/Data');
const syncData = require('../src/jobs/sync');

const runTest = async () => {
    try {
        // 1. Connect to DBs
        await connectDB();
        // Redis client connects automatically in the config file, but we wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!redisClient.isOpen) {
            await redisClient.connect();
        }

        console.log('--- Starting Test ---');

        // 2. Seed Redis Data
        const testKey = 'user';
        const testValue = JSON.stringify({ name: 'Tamim', action: 'Login', timestamp: Date.now() });

        await redisClient.set(testKey, testValue);
        console.log(`[Redis] Set key: ${testKey}`);

        // 3. Verify Redis Data exists
        const valueInRedis = await redisClient.get(testKey);
        console.log(`[Redis] Read key: ${testKey} => ${valueInRedis}`);

        // 4. Run Sync Job
        console.log('--- Running Sync Job ---');
        await syncData();

        // 5. Verify MongoDB Data
        const doc = await Data.findOne({ key: testKey });
        if (doc) {
            console.log('[MongoDB] Found document:', doc);
            console.log('TEST PASSED: Data synced from Redis to MongoDB.');
        } else {
            console.error('[MongoDB] Document not found!');
            console.log('TEST FAILED.');
        }

        // Cleanup (Optional)
        // await redisClient.del(testKey);
        // await Data.deleteOne({ key: testKey });

        process.exit(0);
    } catch (error) {
        console.error('TEST ERROR:', error);
        process.exit(1);
    }
};

runTest();
