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

        const dirtyListKey = process.env.REDIS_DIRTY_LIST_KEY || 'analytics:dirty';
        const testShortCode = 'dirtyTest001';
        const baseKey = `analytics:${testShortCode}`;

        console.log('=== Testing Dirty List Functionality ===\n');

        // Step 1: Clean up previous test data
        console.log('1. Cleaning up previous test data...');
        await redisClient.del(`${baseKey}:clicks`);
        await redisClient.del(`${baseKey}:unique`);
        await redisClient.del(`${baseKey}:updatedAt`);
        await redisClient.del(`${baseKey}:devices`);
        await redisClient.sRem(dirtyListKey, testShortCode);
        await Data.deleteOne({ shortCode: testShortCode });

        // Step 2: Seed test data in Redis
        console.log('2. Seeding test data in Redis...');
        await Promise.all([
            redisClient.set(`${baseKey}:clicks`, '50'),
            redisClient.set(`${baseKey}:unique`, '25'),
            redisClient.set(`${baseKey}:updatedAt`, new Date().toISOString()),
            redisClient.hSet(`${baseKey}:devices`, { 'mobile': '30', 'desktop': '20' })
        ]);

        // Step 3: Add to dirty list
        console.log('3. Adding shortcode to dirty list...');
        await redisClient.sAdd(dirtyListKey, testShortCode);

        const dirtyListSize = await redisClient.sCard(dirtyListKey);
        console.log(`   Dirty list size: ${dirtyListSize}`);

        // Step 4: Run sync job
        console.log('\n4. Running sync job...');
        await syncData();

        // Step 5: Verify MongoDB
        console.log('\n5. Verifying MongoDB...');
        const doc = await Data.findOne({ shortCode: testShortCode });

        if (doc) {
            console.log('   ✅ Document found in MongoDB!');
            console.log(`   Clicks: ${doc.clicks}`);
            console.log(`   Devices: ${JSON.stringify(doc.devices)}`);
        } else {
            console.error('   ❌ Document NOT found in MongoDB');
            return;
        }

        // Step 6: Verify dirty list is empty
        console.log('\n6. Verifying dirty list...');
        const remainingInDirtyList = await redisClient.sIsMember(dirtyListKey, testShortCode);

        if (!remainingInDirtyList) {
            console.log(`   ✅ Shortcode removed from dirty list`);
        } else {
            console.error('   ❌ Shortcode still in dirty list');
            return;
        }

        // Step 7: Run sync again (should skip)
        console.log('\n7. Running sync again (should skip)...');
        await redisClient.sAdd(dirtyListKey, testShortCode); // Re-add to dirty list
        await syncData();

        const stillInDirtyList = await redisClient.sIsMember(dirtyListKey, testShortCode);
        if (!stillInDirtyList) {
            console.log('   ✅ Shortcode correctly skipped and removed from dirty list');
        } else {
            console.error('   ❌ Shortcode still in dirty list after skip');
        }

        console.log('\n=== ✅ All tests PASSED ===');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

runTest();
