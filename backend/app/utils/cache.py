"""
Phase 2: Add Redis caching for backtest results and API calls.
Use Upstash Redis (free tier: 10K commands/day) or local Redis in Docker.
"""
import redis.asyncio as redis
import json
import hashlib
import os

class RedisCache:
    def __init__(self):
        self.redis = redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379"),
            decode_responses=True,
        )

    def _make_key(self, prefix: str, params: dict) -> str:
        """Deterministic cache key from parameters."""
        param_str = json.dumps(params, sort_keys=True)
        hash_val = hashlib.md5(param_str.encode()).hexdigest()
        return f"{prefix}:{hash_val}"

    async def get_backtest(self, params: dict) -> dict | None:
        key = self._make_key("backtest", params)
        data = await self.redis.get(key)
        return json.loads(data) if data else None

    async def set_backtest(self, params: dict, result: dict, ttl: int = 3600):
        key = self._make_key("backtest", params)
        await self.redis.set(key, json.dumps(result), ex=ttl)

    async def get_price(self, ticker: str) -> float | None:
        data = await self.redis.get(f"price:{ticker}")
        return float(data) if data else None

    async def set_price(self, ticker: str, price: float, ttl: int = 30):
        """Cache prices for 30 seconds — not stale, not hammering APIs."""
        await self.redis.set(f"price:{ticker}", str(price), ex=ttl)