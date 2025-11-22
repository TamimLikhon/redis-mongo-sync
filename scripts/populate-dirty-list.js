const redisClient = require('../src/config/redis');
require('dotenv').config();

const populateDirtyList = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }

        const dirtyListKey = process.env.REDIS_DIRTY_LIST_KEY || 'analytics:dirty';
        let prefix = process.env.REDIS_MATCH_PATTERN || 'analytics';
        prefix = prefix.replace(/\*$/, '');

        console.log('Populating dirty list with existing shortcodes...\n');

        const matchPattern = `${prefix}:*:updatedAt`;
        console.log(`Scanning for keys matching: "${matchPattern}"`);

        const shortCodes = [];

        for await (const scanResult of redisClient.scanIterator({ MATCH: matchPattern, COUNT: 100 })) {
            const keys = Array.isArray(scanResult) ? scanResult : [scanResult];

            for (const key of keys) {
                const keyStr = String(key);
                const parts = keyStr.split(':');
                if (parts.length === 3) {
                    shortCodes.push(parts[1]);
                }
            }
        }

        console.log(`Found ${shortCodes.length} shortcodes\n`);

        if (shortCodes.length > 0) {
            await redisClient.sAdd(dirtyListKey, shortCodes);
            console.log(`✅ Added ${shortCodes.length} shortcodes to dirty list: ${dirtyListKey}`);

            const finalSize = await redisClient.sCard(dirtyListKey);
            console.log(`Dirty list now contains ${finalSize} items\n`);
        } else {
            console.log('No shortcodes found to add.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await redisClient.disconnect();
        process.exit(0);
    }
};

populateDirtyList();
