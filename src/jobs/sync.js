const redisClient = require('../config/redis');
const Data = require('../models/Data');

const syncData = async () => {
    console.log('Starting Sync Job...');
    try {
        // Configuration
        const useDirtyList = process.env.USE_DIRTY_LIST !== 'false'; // Default: true
        const dirtyListKey = process.env.REDIS_DIRTY_LIST_KEY || 'analytics:dirty';
        let prefix = process.env.REDIS_MATCH_PATTERN || 'analytics';
        prefix = prefix.replace(/\*$/, ''); // Remove trailing wildcard

        let shortCodesToSync = [];

        if (useDirtyList) {
            // Mode 1: Use dirty list (change queue)
            console.log(`Using dirty list mode. Reading from "${dirtyListKey}"`);
            shortCodesToSync = await redisClient.sMembers(dirtyListKey);
            console.log(`Found ${shortCodesToSync.length} shortcodes in dirty list`);
        } else {
            // Mode 2: Full scan (backward compatibility)
            console.log('Using full scan mode');
            const matchPattern = `${prefix}:*:updatedAt`;
            console.log(`Scanning for keys matching: "${matchPattern}"`);

            for await (const scanResult of redisClient.scanIterator({ MATCH: matchPattern, COUNT: 100 })) {
                const keys = Array.isArray(scanResult) ? scanResult : [scanResult];

                for (const key of keys) {
                    const keyStr = String(key);
                    const parts = keyStr.split(':');
                    if (parts.length === 3) {
                        shortCodesToSync.push(parts[1]);
                    }
                }
            }
            console.log(`Found ${shortCodesToSync.length} shortcodes via scan`);
        }

        let totalSynced = 0;

        // Process each shortcode
        for (const shortCode of shortCodesToSync) {
            console.log(`Processing shortCode: ${shortCode}`);

            try {
                // Optimization: Check if update is needed
                const redisUpdatedAtStr = await redisClient.get(`${prefix}:${shortCode}:updatedAt`);

                if (!redisUpdatedAtStr) {
                    console.warn(`No updatedAt found for ${shortCode}, skipping`);
                    // Remove from dirty list if using it
                    if (useDirtyList) {
                        await redisClient.sRem(dirtyListKey, shortCode);
                    }
                    continue;
                }

                const redisUpdatedAt = new Date(redisUpdatedAtStr);

                // Check MongoDB for existing document
                const existingDoc = await Data.findOne({ shortCode }).select('updatedAt');

                if (existingDoc && existingDoc.updatedAt >= redisUpdatedAt) {
                    console.log(`Skipping ${shortCode} - MongoDB is up to date.`);
                    // Remove from dirty list since it's already synced
                    if (useDirtyList) {
                        await redisClient.sRem(dirtyListKey, shortCode);
                    }
                    continue;
                }

                // Fetch all related data in parallel
                const baseKey = `${prefix}:${shortCode}`;

                const [
                    clicks,
                    unique,
                    devices,
                    timeline,
                    recent,
                    cities,
                    countries,
                    regions,
                    referrers
                ] = await Promise.all([
                    redisClient.get(`${baseKey}:clicks`),
                    redisClient.get(`${baseKey}:unique`),
                    redisClient.hGetAll(`${baseKey}:devices`),
                    redisClient.hGetAll(`${baseKey}:timeline`),
                    redisClient.lRange(`${baseKey}:recent`, 0, -1),
                    redisClient.zRangeWithScores(`${baseKey}:cities`, 0, -1),
                    redisClient.zRangeWithScores(`${baseKey}:countries`, 0, -1),
                    redisClient.zRangeWithScores(`${baseKey}:regions`, 0, -1),
                    redisClient.zRangeWithScores(`${baseKey}:referrers`, 0, -1)
                ]);

                // Data Transformation
                const transformSortedSet = (list) => {
                    const obj = {};
                    if (Array.isArray(list)) {
                        list.forEach(item => {
                            obj[item.value] = item.score;
                        });
                    }
                    return obj;
                };

                const analyticsData = {
                    shortCode,
                    clicks: parseInt(clicks || '0', 10),
                    unique: parseInt(unique || '0', 10),
                    updatedAt: redisUpdatedAt,
                    lastSyncedAt: new Date(),
                    devices: devices || {},
                    timeline: timeline || {},
                    recent: recent || [],
                    cities: transformSortedSet(cities),
                    countries: transformSortedSet(countries),
                    regions: transformSortedSet(regions),
                    referrers: transformSortedSet(referrers)
                };

                // Update MongoDB
                await Data.findOneAndUpdate(
                    { shortCode: shortCode },
                    { $set: analyticsData },
                    { upsert: true, new: true }
                );

                totalSynced++;
                console.log(`✅ Synced ${shortCode} successfully`);

                // Remove from dirty list after successful sync
                if (useDirtyList) {
                    await redisClient.sRem(dirtyListKey, shortCode);
                }

            } catch (innerError) {
                console.error(`Failed to process shortCode ${shortCode}:`, innerError);
                // Keep in dirty list for retry on next run
            }
        }

        console.log(`Synced ${totalSynced} items successfully.`);

    } catch (error) {
        console.error('Error during sync:', error);
    }
};

module.exports = syncData;
