import yfinance as yf
import pandas as pd
from datetime import date, timedelta
from typing import Optional
import logging
import time
import hashlib

logger = logging.getLogger(__name__)

# ─── In-memory cache for historical data ───
_data_cache: dict[str, dict] = {}
CACHE_TTL = 300  # 5 minutes


def _cache_key(ticker: str, start: date, end: date, interval: str) -> str:
    """Generate a deterministic cache key."""
    raw = f"{ticker}:{start}:{end}:{interval}"
    return hashlib.md5(raw.encode()).hexdigest()


class DataFetcher:
    """
    Wrapper around yfinance.
    Rule: yfinance is ONLY for historical data. Never for live/production feeds.
    Includes in-memory TTL cache to avoid redundant fetches.
    """

    @staticmethod
    def fetch_historical(
        ticker: str,
        start_date: date,
        end_date: date,
        interval: str = "1d",
    ) -> pd.DataFrame:
        """Fetch OHLCV data. Returns cleaned DataFrame. Uses TTL cache."""
        key = _cache_key(ticker, start_date, end_date, interval)

        # Check cache
        cached = _data_cache.get(key)
        if cached and (time.time() - cached["ts"]) < CACHE_TTL:
            logger.info(f"Cache hit for {ticker} ({len(cached['df'])} rows)")
            return cached["df"].copy()

        try:
            stock = yf.Ticker(ticker)
            df = stock.history(
                start=start_date.isoformat(),
                end=end_date.isoformat(),
                interval=interval,
            )
            if df.empty:
                raise ValueError(f"No data returned for {ticker}")

            # Clean columns
            df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
            df.columns = ["open", "high", "low", "close", "volume"]
            df.index.name = "date"
            df.dropna(inplace=True)

            # Store in cache
            _data_cache[key] = {"df": df.copy(), "ts": time.time()}

            # Evict old entries (keep max 50)
            if len(_data_cache) > 50:
                oldest_key = min(_data_cache, key=lambda k: _data_cache[k]["ts"])
                del _data_cache[oldest_key]

            logger.info(f"Fetched {len(df)} rows for {ticker}")
            return df

        except Exception as e:
            logger.error(f"Failed to fetch data for {ticker}: {e}")
            raise

    @staticmethod
    def fetch_benchmark(
        start_date: date,
        end_date: date,
        benchmark: str = "SPY",
    ) -> pd.Series:
        """Fetch benchmark returns for Alpha/Beta calculation."""
        df = DataFetcher.fetch_historical(benchmark, start_date, end_date)
        return df["close"].pct_change().dropna()

    @staticmethod
    def get_current_price(ticker: str) -> float:
        """Get the latest available price. Uses history() which is more reliable than info."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="5d")
            if hist.empty:
                raise ValueError(f"Cannot get current price for {ticker}")
            return float(hist["Close"].iloc[-1])
        except Exception as e:
            logger.error(f"Failed to get price for {ticker}: {e}")
            raise ValueError(f"Cannot get current price for {ticker}: {e}")

    @staticmethod
    def validate_ticker(ticker: str) -> bool:
        """Check if a ticker symbol is valid by fetching recent history."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="5d")
            return not hist.empty and len(hist) > 0
        except Exception:
            return False