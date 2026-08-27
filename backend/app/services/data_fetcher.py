import yfinance as yf
import pandas as pd
from datetime import date, timedelta, datetime
from typing import Optional
import logging
import time
import hashlib
import httpx
import threading

logger = logging.getLogger(__name__)

# ─── TwelveData fallback helpers ───
from app.config import settings as _settings

_TWELVEDATA_BASE = "https://api.twelvedata.com"

def _td_api_key() -> Optional[str]:
    """Lazy-load TwelveData API key from settings (avoids circular import)."""
    try:
        from app.config import settings
        return settings.twelvedata_api_key
    except Exception:
        return None


# Index tickers that don't carry the yfinance "^" prefix (mainland China).
_NON_CARET_INDICES = frozenset({"000300.SS", "000001.SS", "399001.SZ"})


def _is_index(ticker: str) -> bool:
    """True for market-index symbols. TwelveData's free tier doesn't cover
    indices, so callers skip the fallback rather than spend a rate-limited
    call on a request that can only fail."""
    return ticker.startswith("^") or ticker in _NON_CARET_INDICES


def _td_quote(ticker: str) -> Optional[dict]:
    """Fetch a quote from TwelveData. Returns raw JSON dict or None.
    Uses rate limiter and cache (5 min TTL). Skips indices."""
    if _is_index(ticker):
        return None

    api_key = _td_api_key()
    if not api_key:
        return None

    cache_key = f"td:quote:{ticker}"
    cached = _td_cache.get(cache_key)
    if cached and (time.time() - cached["ts"]) < 300:  # 5 min TTL for quotes
        return cached["data"]

    if not _td_rate_limiter.acquire(timeout=5.0):
        logger.warning(f"TwelveData quote rate limit exceeded for {ticker}")
        return None

    try:
        # Strip yfinance-style suffixes — TwelveData uses its own exchange param
        # For US tickers (no suffix) this works directly.
        symbol = ticker.split(".")[0] if "." in ticker else ticker
        # Remove ^ prefix for index tickers — TwelveData doesn't use it
        symbol = symbol.lstrip("^")
        resp = httpx.get(
            f"{_TWELVEDATA_BASE}/quote",
            params={"symbol": symbol, "apikey": api_key},
            timeout=10,
        )
        data = resp.json()
        if data.get("status") == "error" or "code" in data:
            logger.debug(f"TwelveData quote failed for {ticker}: {data.get('message', '')}")
            _td_cache[cache_key] = {"data": None, "ts": time.time()}
            return None
        
        _td_cache[cache_key] = {"data": data, "ts": time.time()}
        return data
    except Exception as e:
        logger.debug(f"TwelveData quote exception for {ticker}: {e}")
        return None


def _td_time_series(ticker: str, outputsize: int = 30, interval: str = "1day",
                    start_date: str = "", end_date: str = "") -> Optional[list[dict]]:
    """Fetch time series from TwelveData. Returns list of OHLCV dicts or None.
    Skips indices."""
    if _is_index(ticker):
        return None

    api_key = _td_api_key()
    if not api_key:
        return None
    try:
        symbol = ticker.split(".")[0] if "." in ticker else ticker
        symbol = symbol.lstrip("^")
        params: dict = {"symbol": symbol, "interval": interval, "apikey": api_key}
        if start_date and end_date:
            params["start_date"] = start_date
            params["end_date"] = end_date
            # TwelveData max outputsize is 5000
            params["outputsize"] = min(outputsize, 5000)
        else:
            params["outputsize"] = min(outputsize, 5000)
        resp = httpx.get(
            f"{_TWELVEDATA_BASE}/time_series",
            params=params,
            timeout=15,
        )
        data = resp.json()
        if data.get("status") == "error" or "code" in data:
            logger.debug(f"TwelveData time_series failed for {ticker}: {data.get('message', '')}")
            return None
        values = data.get("values")
        if not values:
            return None
        return values
    except Exception as e:
        logger.debug(f"TwelveData time_series exception for {ticker}: {e}")
        return None

# ─── TwelveData rate limiter (token bucket) ───
class _TwelveDataRateLimiter:
    """Simple token-bucket rate limiter for TwelveData free tier (8 calls/min).
    Thread-safe. Blocks if rate limit would be exceeded."""

    def __init__(self, max_calls: int = 7, period_seconds: float = 60.0):
        # Use 7 instead of 8 to leave a small margin
        self._max_calls = max_calls
        self._period = period_seconds
        self._timestamps: list[float] = []
        self._lock = threading.Lock()

    def acquire(self, timeout: float = 90.0) -> bool:
        """Wait until a call slot is available. Returns True if acquired, False on timeout."""
        deadline = time.time() + timeout
        while True:
            with self._lock:
                now = time.time()
                # Purge timestamps older than the window
                self._timestamps = [t for t in self._timestamps if now - t < self._period]
                if len(self._timestamps) < self._max_calls:
                    self._timestamps.append(now)
                    return True
                # Calculate wait time until oldest timestamp expires
                wait = self._timestamps[0] + self._period - now
            if time.time() + wait > deadline:
                logger.warning("TwelveData rate limiter timeout — skipping call")
                return False
            logger.debug(f"TwelveData rate limiter: waiting {wait:.1f}s for slot")
            time.sleep(min(wait + 0.1, 5.0))  # sleep in small increments

_td_rate_limiter = _TwelveDataRateLimiter()

# ─── TwelveData response cache ───
_td_cache: dict[str, dict] = {}
TD_CACHE_TTL = 600  # 10 minutes — longer than yfinance cache since TD calls are precious

# ─── In-memory cache for historical data ───
_data_cache: dict[str, dict] = {}
CACHE_TTL = _settings.cache_ttl_seconds  # CACHE_TTL_SECONDS, default 5 minutes

# ─── Global market benchmark mapping ───
# Maps ticker suffix/exchange to the appropriate regional benchmark index
BENCHMARK_MAP = {
    # US markets (default)
    "": "SPY",
    # Indian markets
    ".NS": "^NSEI",      # NSE India -> NIFTY 50
    ".BO": "^BSESN",     # BSE India -> SENSEX
    # European markets
    ".L": "^FTSE",        # London -> FTSE 100
    ".PA": "^FCHI",       # Paris -> CAC 40
    ".DE": "^GDAXI",      # Frankfurt -> DAX
    ".AS": "^AEX",        # Amsterdam -> AEX
    ".MI": "FTSEMIB.MI",  # Milan -> FTSE MIB
    ".MC": "^IBEX",       # Madrid -> IBEX 35
    ".SW": "^SSMI",       # Swiss Exchange -> SMI
    ".ST": "^OMX",        # Stockholm -> OMX Stockholm 30
    ".CO": "^OMXC25",     # Copenhagen -> OMX Copenhagen 25
    ".HE": "^OMXH25",     # Helsinki -> OMX Helsinki 25
    ".OL": "^OSEAX",      # Oslo -> Oslo All Share
    # Asia-Pacific markets
    ".T": "^N225",        # Tokyo -> Nikkei 225
    ".HK": "^HSI",        # Hong Kong -> Hang Seng
    ".SS": "000300.SS",   # Shanghai -> CSI 300
    ".SZ": "000300.SS",   # Shenzhen -> CSI 300
    ".KS": "^KS11",       # Korea -> KOSPI
    ".TW": "^TWII",       # Taiwan -> TAIEX
    ".SI": "^STI",        # Singapore -> STI
    ".AX": "^AXJO",       # Australia -> ASX 200
    ".NZ": "^NZ50",       # New Zealand -> NZX 50
    ".KL": "^KLSE",       # Malaysia -> KLSE Composite
    ".BK": "^SET.BK",     # Thailand -> SET
    ".JK": "^JKSE",       # Indonesia -> Jakarta Composite
    # Americas
    ".TO": "^GSPTSE",     # Toronto -> S&P/TSX
    ".SA": "^BVSP",       # Brazil -> Bovespa
    ".MX": "^MXX",        # Mexico -> IPC
    # Africa
    ".JO": "^J203.JO",     # Johannesburg -> JSE All Share
}

# Index tickers map to their own regional benchmark
INDEX_BENCHMARK_MAP = {
    "^GSPC": "SPY",       # S&P 500 -> SPY ETF
    "^NSEI": "^NSEI",     # NIFTY 50
    "^BSESN": "^BSESN",  # SENSEX
    "^FTSE": "^FTSE",     # FTSE 100
    "^STOXX": "^STOXX",   # STOXX Europe 600
    "^AXJO": "^AXJO",     # ASX 200
    "^N225": "^N225",     # Nikkei 225
    "^HSI": "^HSI",       # Hang Seng
    "^KS11": "^KS11",     # KOSPI
    "000300.SS": "000300.SS",  # CSI 300
    "^J203.JO": "^J203.JO", # JSE All Share
    "^GDAXI": "^GDAXI",  # DAX
    "^FCHI": "^FCHI",     # CAC 40
    "^GSPTSE": "^GSPTSE", # TSX
    "^BVSP": "^BVSP",     # Bovespa
    "^TWII": "^TWII",     # TAIEX
    "^STI": "^STI",       # STI
}


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
        """Fetch OHLCV data. Returns cleaned DataFrame. Uses TTL cache.
        Tries yfinance first, falls back to TwelveData."""
        key = _cache_key(ticker, start_date, end_date, interval)

        # Check cache
        cached = _data_cache.get(key)
        if cached and (time.time() - cached["ts"]) < CACHE_TTL:
            logger.info(f"Cache hit for {ticker} ({len(cached['df'])} rows)")
            return cached["df"].copy()

        df = pd.DataFrame()

        # 1. Try yfinance
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(
                start=start_date.isoformat(),
                end=end_date.isoformat(),
                interval=interval,
            )
        except Exception as e:
            logger.warning(f"yfinance fetch failed for {ticker}: {e}")

        # 2. Fallback: TwelveData time series (rate-limited & cached).
        # Checked before acquiring a limiter slot -- TwelveData has no index
        # coverage, so an index request would spend call budget to fail.
        if df.empty and _is_index(ticker):
            logger.info(f"yfinance returned empty for index {ticker}, no TwelveData coverage")
        elif df.empty:
            logger.info(f"yfinance returned empty for {ticker}, trying TwelveData fallback")
            # Map yfinance interval to TwelveData interval
            td_interval_map = {
                "1d": "1day", "1wk": "1week", "1mo": "1month",
                "1h": "1h", "5m": "5min", "15m": "15min", "30m": "30min",
                "60m": "1h", "90m": "1h",
            }
            td_interval = td_interval_map.get(interval, "1day")
            # Estimate output size from date range
            delta_days = (end_date - start_date).days
            outputsize = min(delta_days + 30, 5000)  # extra buffer

            # Check TwelveData-specific cache first (longer TTL)
            td_cache_key = f"td:{ticker}:{start_date}:{end_date}:{td_interval}"
            td_cached = _td_cache.get(td_cache_key)
            if td_cached and (time.time() - td_cached["ts"]) < TD_CACHE_TTL:
                logger.info(f"TwelveData cache hit for {ticker}")
                values = td_cached["values"]
            else:
                # Acquire rate limiter slot before calling TwelveData
                if not _td_rate_limiter.acquire(timeout=90):
                    logger.warning(f"TwelveData rate limit exceeded, skipping fallback for {ticker}")
                    values = None
                else:
                    values = _td_time_series(
                        ticker,
                        outputsize=outputsize,
                        interval=td_interval,
                        start_date=start_date.isoformat(),
                        end_date=end_date.isoformat(),
                    )
                    # Cache the raw response even if None (avoids repeated failed calls)
                    _td_cache[td_cache_key] = {"values": values, "ts": time.time()}
                    # Evict old TD cache entries
                    if len(_td_cache) > 30:
                        oldest = min(_td_cache, key=lambda k: _td_cache[k]["ts"])
                        del _td_cache[oldest]
            if values:
                try:
                    rows = []
                    for v in values:
                        rows.append({
                            "date": pd.Timestamp(v["datetime"]),
                            "open": float(v["open"]),
                            "high": float(v["high"]),
                            "low": float(v["low"]),
                            "close": float(v["close"]),
                            "volume": int(v.get("volume", 0)),
                        })
                    df = pd.DataFrame(rows)
                    df.set_index("date", inplace=True)
                    df.sort_index(inplace=True)
                    df.index.name = "date"
                except (KeyError, ValueError, TypeError) as e:
                    logger.warning(f"TwelveData historical parse error for {ticker}: {e}")
                    df = pd.DataFrame()

        if df.empty:
            raise ValueError(f"No data returned for {ticker}")

        # Clean columns (yfinance returns Title Case, TwelveData already lowercase)
        if "Open" in df.columns:
            df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
            df.columns = ["open", "high", "low", "close", "volume"]
        elif "open" in df.columns:
            df = df[["open", "high", "low", "close", "volume"]].copy()
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

    @staticmethod
    def get_benchmark_for_ticker(ticker: str) -> str:
        """Determine the appropriate regional benchmark for a given ticker.
        
        Logic:
        1. If the ticker is itself an index (starts with ^ or is in INDEX_BENCHMARK_MAP), 
           use SPY as a universal fallback benchmark for comparison.
        2. Otherwise, extract the exchange suffix (.NS, .L, .T, etc.) and map to
           the regional benchmark index.
        3. If no suffix match, default to SPY (US market).
        """
        # Check if it's a known index ticker
        if ticker in INDEX_BENCHMARK_MAP:
            # For indices, use SPY as a cross-market benchmark for alpha/beta
            return "SPY"
        
        # Extract exchange suffix (e.g., ".NS" from "RELIANCE.NS")
        for suffix in sorted(BENCHMARK_MAP.keys(), key=len, reverse=True):
            if suffix and ticker.upper().endswith(suffix):
                return BENCHMARK_MAP[suffix]
        
        # Default to SPY for US tickers (no suffix)
        return "SPY"

    @staticmethod
    def fetch_benchmark(
        start_date: date,
        end_date: date,
        benchmark: str = "SPY",
        ticker: str = "",
    ) -> pd.Series:
        """Fetch benchmark returns for Alpha/Beta calculation.
        
        If a ticker is provided and no explicit benchmark is given,
        automatically selects the appropriate regional benchmark.
        """
        if ticker and benchmark == "SPY":
            benchmark = DataFetcher.get_benchmark_for_ticker(ticker)
        
        try:
            df = DataFetcher.fetch_historical(benchmark, start_date, end_date)
            return df["close"].pct_change().dropna()
        except Exception as e:
            logger.warning(f"Failed to fetch benchmark {benchmark}, falling back to SPY: {e}")
            if benchmark != "SPY":
                df = DataFetcher.fetch_historical("SPY", start_date, end_date)
                return df["close"].pct_change().dropna()
            raise

    @staticmethod
    def get_current_price(ticker: str) -> dict:
        """Get the latest available price with change data.
        Tries yfinance first, falls back to TwelveData (cached & rate-limited).
        Returns dict with price, change, changePct, prevClose."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="5d")
            if not hist.empty and len(hist) >= 1:
                price = float(hist["Close"].iloc[-1])
                prev_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
                change = round(price - prev_close, 2)
                change_pct = round((change / prev_close) * 100, 2) if prev_close != 0 else 0.0
                return {
                    "price": price,
                    "change": change,
                    "changePct": change_pct,
                    "prevClose": prev_close,
                }
        except Exception:
            pass

        # 2. Fallback: TwelveData quote (cached & rate-limited)
        logger.info(f"yfinance price failed for {ticker}, trying TwelveData fallback")
        td = _td_quote(ticker)
        if td and td.get("close"):
            try:
                price = float(td["close"])
                prev_close = float(td.get("previous_close", price))
                change = float(td.get("change", 0))
                change_pct = float(td.get("percent_change", 0))
                return {
                    "price": price,
                    "change": round(change, 2),
                    "changePct": round(change_pct, 2),
                    "prevClose": prev_close,
                }
            except (ValueError, TypeError) as e:
                logger.warning(f"TwelveData price parse error for {ticker}: {e}")

        raise ValueError(f"Cannot get current price for {ticker}")

    @staticmethod
    def get_sparkline(ticker: str, days: int = 30) -> list[float]:
        """Return the last `days` daily closing prices for sparkline charts.
        Tries yfinance first, falls back to TwelveData (rate-limited & cached)."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=f"{days + 15}d")
            if not hist.empty:
                closes = hist["Close"].dropna().tolist()
                if closes:
                    return [round(float(v), 2) for v in closes[-days:]]
        except Exception:
            pass

        # 2. Fallback: TwelveData time series
        if not _is_index(ticker):
            logger.info(f"yfinance sparkline failed for {ticker}, trying TwelveData fallback")
            td_cache_key = f"td:sparkline:{ticker}:{days}"
            cached = _td_cache.get(td_cache_key)
            if cached and (time.time() - cached["ts"]) < TD_CACHE_TTL:
                values = cached["values"]
            elif _td_rate_limiter.acquire(timeout=5.0):
                values = _td_time_series(ticker, outputsize=days + 5, interval="1day")
                _td_cache[td_cache_key] = {"values": values, "ts": time.time()}
            else:
                values = None

            if values:
                try:
                    # TwelveData returns newest first, reverse for chronological order
                    closes = [round(float(v["close"]), 2) for v in reversed(values)]
                    return closes[-days:]
                except (KeyError, ValueError, TypeError) as e:
                    logger.warning(f"TwelveData sparkline parse error for {ticker}: {e}")

        return []

    @staticmethod
    def validate_ticker(ticker: str) -> bool:
        """Check if a ticker symbol is valid.
        Tries yfinance first, falls back to TwelveData (cached & rate-limited)."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="5d")
            if not hist.empty and len(hist) > 0:
                return True
        except Exception:
            pass

        # 2. Fallback: TwelveData quote
        logger.info(f"yfinance failed for {ticker}, trying TwelveData fallback")
        td = _td_quote(ticker)
        if td and td.get("close") and td.get("name"):
            return True

        return False