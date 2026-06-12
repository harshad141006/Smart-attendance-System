import redis.asyncio as redis
import json
import logging
import time
from typing import Optional, Any, List
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis caching service with in-memory fallback"""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.is_fallback: bool = False
        self._cache = {}      # Format: {key: (value, expire_timestamp)}
        self._lists = {}      # Format: {key: [value1, value2, ...]}

    async def connect(self):
        """Connect to Redis, fallback to in-memory cache if connection fails"""
        try:
            self.redis_client = await redis.from_url(settings.redis_url)
            await self.redis_client.ping()
            self.is_fallback = False
            logger.info("Connected to Redis successfully")
        except Exception as e:
            self.is_fallback = True
            logger.warning(f"Failed to connect to Redis: {e}. Falling back to In-Memory cache.")

    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis_client and not self.is_fallback:
            await self.redis_client.close()
            logger.info("Disconnected from Redis")

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if self.is_fallback:
            if key in self._cache:
                value, expire_at = self._cache[key]
                if expire_at is None or expire_at > time.time():
                    return value
                else:
                    del self._cache[key]
            return None

        try:
            value = await self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Failed to get from cache: {e}")
            return None

    async def set(self, key: str, value: Any, expiry: int = None) -> bool:
        """Set value in cache"""
        expiry = expiry or settings.redis_cache_expiry
        if self.is_fallback:
            expire_at = time.time() + expiry if expiry else None
            self._cache[key] = (value, expire_at)
            logger.debug(f"Set in-memory cache key: {key}")
            return True

        try:
            await self.redis_client.set(key, json.dumps(value), ex=expiry)
            logger.debug(f"Set cache key: {key}")
            return True
        except Exception as e:
            logger.error(f"Failed to set cache: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        if self.is_fallback:
            if key in self._cache:
                del self._cache[key]
            if key in self._lists:
                del self._lists[key]
            logger.debug(f"Deleted in-memory cache key: {key}")
            return True

        try:
            await self.redis_client.delete(key)
            logger.debug(f"Deleted cache key: {key}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete from cache: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if self.is_fallback:
            if key in self._cache:
                value, expire_at = self._cache[key]
                if expire_at is None or expire_at > time.time():
                    return True
                else:
                    del self._cache[key]
            return key in self._lists

        try:
            return await self.redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"Failed to check cache key existence: {e}")
            return False

    async def increment(self, key: str, value: int = 1) -> int:
        """Increment value in cache"""
        if self.is_fallback:
            current_val = 0
            if key in self._cache:
                val, expire_at = self._cache[key]
                if expire_at is None or expire_at > time.time():
                    try:
                        current_val = int(val)
                    except (ValueError, TypeError):
                        current_val = 0
            new_val = current_val + value
            self._cache[key] = (new_val, None)
            return new_val

        try:
            return await self.redis_client.incrby(key, value)
        except Exception as e:
            logger.error(f"Failed to increment cache value: {e}")
            return 0

    async def append_to_list(self, key: str, value: Any, max_size: int = 1000) -> bool:
        """Append value to list in cache"""
        if self.is_fallback:
            if key not in self._lists:
                self._lists[key] = []
            self._lists[key].append(value)
            if len(self._lists[key]) > max_size:
                self._lists[key] = self._lists[key][-max_size:]
            return True

        try:
            await self.redis_client.rpush(key, json.dumps(value))
            await self.redis_client.ltrim(key, -max_size, -1)
            return True
        except Exception as e:
            logger.error(f"Failed to append to cache list: {e}")
            return False

    async def get_list(self, key: str) -> List[Any]:
        """Get list from cache"""
        if self.is_fallback:
            return self._lists.get(key, [])

        try:
            values = await self.redis_client.lrange(key, 0, -1)
            return [json.loads(v) for v in values]
        except Exception as e:
            logger.error(f"Failed to get cache list: {e}")
            return []

    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern"""
        if self.is_fallback:
            import fnmatch
            count = 0
            keys_to_del = [k for k in self._cache.keys() if fnmatch.fnmatch(k, pattern)]
            for k in keys_to_del:
                del self._cache[k]
                count += 1
            lists_to_del = [k for k in self._lists.keys() if fnmatch.fnmatch(k, pattern)]
            for k in lists_to_del:
                del self._lists[k]
                count += 1
            return count

        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                return await self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Failed to clear cache pattern: {e}")
            return 0


# Global cache instance
cache = RedisCache()
