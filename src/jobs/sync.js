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
            // console.log(`Found key: ${key}`); 
            try {
                const value = await redisClient.get(String(key));

                if (value) {
                    // Update or Insert into MongoDB
                    await Data.findOneAndUpdate(
                        { key: key },
                        { value: JSON.parse(value), syncedAt: new Date() },
                        { upsert: true, new: true }
                    );

                    totalSynced++;
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
