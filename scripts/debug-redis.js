const redisClient = require('../src/config/redis');

(async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }

        console.log('Connected to Redis');

        const keys = await redisClient.keys('*');
        console.log('All Keys:', keys);

        const prefix = process.env.REDIS_MATCH_PATTERN || 'analytics';
        const matchPattern = `${prefix}:*:updatedAt`;
        console.log(`Scanning for ${matchPattern}...`);

        for await (const key of redisClient.scanIterator({ MATCH: matchPattern, COUNT: 100 })) {
            console.log('Scanned Key:', key);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await redisClient.disconnect();
    }
})();
