from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
from pathlib import Path

# Resolve the .env file: check backend/.env first, then project root .env
_backend_dir = Path(__file__).resolve().parent.parent  # backend/
_env_candidates = [
    _backend_dir / ".env",
    _backend_dir.parent / ".env",  # project root
]
_env_file = next((p for p in _env_candidates if p.exists()), ".env")

class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./stock_platform.db"
    # Switch to PostgreSQL when ready:
    # database_url: str = "postgresql+asyncpg://user:pass@localhost/stockdb"

    default_slippage_pct: float = 0.1   # 0.1% slippage
    default_commission_pct: float = 0.1  # 0.1% commission
    max_backtest_years: int = 10
    cache_ttl_seconds: int = 3600  # 1 hour

    # Finnhub API
    finnhub_api_key: Optional[str] = None

    # TwelveData API (backup data source)
    twelvedata_api_key: Optional[str] = None

    class Config:
        env_file = str(_env_file)

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()