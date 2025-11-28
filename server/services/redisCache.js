const redis = require('redis');

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis: Too many reconnection attempts');
              return new Error('Too many reconnection attempts');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✓ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected) return false;

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern) {
    if (!this.isConnected) return false;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis invalidatePattern error:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Cache middleware for Express routes
  cacheMiddleware(duration = 3600) {
    return async (req, res, next) => {
      if (!this.isConnected) {
        return next();
      }

      const key = `cache:${req.originalUrl || req.url}`;

      try {
        const cached = await this.get(key);
        if (cached) {
          return res.json(cached);
        }

        // Override res.json to cache the response
        const originalJson = res.json.bind(res);
        res.json = (data) => {
          this.set(key, data, duration).catch(err =>
            console.error('Failed to cache response:', err)
          );
          return originalJson(data);
        };

        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  }
}

// Create singleton instance
const cache = new RedisCache();

module.exports = cache;
