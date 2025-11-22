const redisClient = require('../config/redis');
const Data = require('../models/Data');

const syncData = async () => {
    console.log('Starting Sync Job...');
    try {
        // Use scanIterator for safer and cleaner iteration
        const pattern = process.env.REDIS_MATCH_PATTERN || '*';
        console.log(`Using Redis Scan Pattern: "${pattern}"`);
        let totalSynced = 0;

        // Using scanIterator
        // Note: In some redis versions/clients, COUNT might need to be a string or omitted if causing issues.
        // We explicitly cast key to string to avoid "arguments[1]" type errors if key is somehow not a string.
        for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
            console.log(`Found key: ${key}`);
            try {
                const value = await redisClient.get(String(key));

                if (value) {
                    // Parse the JSON value
                    const data = JSON.parse(value);

                    // Extract shortCode from key pattern "user:shortcode"
                    const shortCode = key.split(':')[1];

                    if (!shortCode) {
                        console.warn(`Skipping key ${key} - could not extract shortCode`);
                        continue;
                    }

                    // Merge shortCode and lastSyncedAt into the data
                    const updateData = {
                        ...data,
                        shortCode: shortCode,
                        lastSyncedAt: new Date()
                    };

                    // Update or Insert into MongoDB using shortCode as the unique key
                    await Data.findOneAndUpdate(
                        { shortCode: shortCode },
                        { $set: updateData },
                        { upsert: true, new: true }
                    );

                    totalSynced++;
                    console.log(`✅ Synced ${shortCode} successfully`);
                }
            } catch (innerError) {
                console.error(`Failed to process key ${key}:`, innerError);
            }
        }

        console.log(`Synced ${totalSynced} items successfully.`);

    } catch (error) {
        console.error('Error during sync:', error);
    }
};

module.exports = syncData;
