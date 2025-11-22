const redisClient = require('../src/config/redis');
const connectDB = require('../src/config/db');
const Data = require('../src/models/Data');
const syncData = require('../src/jobs/sync');
const mongoose = require('mongoose');

require('dotenv').config();

const runTest = async () => {
    try {
        await connectDB();

        // Ensure Redis is connected
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }

        const shortCode = 'testComplexSync';
        const baseKey = `analytics:${shortCode}`;

        console.log('Seeding Redis with complex data...');

        // Clean up previous test data
        await redisClient.del(`${baseKey}:clicks`);
        await redisClient.del(`${baseKey}:unique`);
        await redisClient.del(`${baseKey}:updatedAt`);
        await redisClient.del(`${baseKey}:devices`);
        await redisClient.del(`${baseKey}:timeline`);
        await redisClient.del(`${baseKey}:recent`);
        await redisClient.del(`${baseKey}:cities`);
        await redisClient.del(`${baseKey}:countries`);
        await redisClient.del(`${baseKey}:regions`);
        await redisClient.del(`${baseKey}:referrers`);

        // Seed Data
        await Promise.all([
            redisClient.set(`${baseKey}:clicks`, '100'),
            redisClient.set(`${baseKey}:unique`, '50'),
            redisClient.set(`${baseKey}:updatedAt`, new Date().toISOString()),
            redisClient.hSet(`${baseKey}:devices`, { 'desktop': '80', 'mobile': '20' }),
            redisClient.hSet(`${baseKey}:timeline`, { '2023-10-01': '10', '2023-10-02': '20' }),
            redisClient.rPush(`${baseKey}:recent`, ['{"ip":"1.1.1.1"}', '{"ip":"2.2.2.2"}']),
            redisClient.zAdd(`${baseKey}:cities`, [{ score: 10, value: 'New York' }, { score: 5, value: 'London' }]),
            redisClient.zAdd(`${baseKey}:countries`, [{ score: 50, value: 'US' }, { score: 30, value: 'UK' }]),
            redisClient.zAdd(`${baseKey}:regions`, [{ score: 20, value: 'NY' }, { score: 10, value: 'CA' }]),
            redisClient.zAdd(`${baseKey}:referrers`, [{ score: 40, value: 'google.com' }, { score: 10, value: 'direct' }])
        ]);

        console.log('Data seeded. Running sync job...');

        await syncData();

        console.log('Sync job finished. Verifying MongoDB...');

        const doc = await Data.findOne({ shortCode });

        if (doc) {
            console.log('✅ Document found in MongoDB!');
            console.log('Clicks:', doc.clicks);
            console.log('Devices:', doc.devices);
            console.log('Countries:', doc.countries);

            if (doc.clicks === 100 && doc.devices.desktop === '80' && doc.countries.US === 50) {
                console.log('✅ Data verification PASSED');
            } else {
                console.error('❌ Data verification FAILED: Data mismatch');
                console.log(JSON.stringify(doc, null, 2));
            }
        } else {
            console.error('❌ Document NOT found in MongoDB');
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        // await redisClient.disconnect(); // Keep open if needed or close
        process.exit(0);
    }
};

runTest();
