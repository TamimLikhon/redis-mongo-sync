const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || process.env.REDIS_URI
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

(async () => {
    await redisClient.connect();
})();

module.exports = redisClient;
