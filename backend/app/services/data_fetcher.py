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
        """Get the latest available price with change data. Returns dict with price, change, changePct, prevClose."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="5d")
            if hist.empty:
                raise ValueError(f"Cannot get current price for {ticker}")
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
        except Exception as e:
            logger.error(f"Failed to get price for {ticker}: {e}")
            raise ValueError(f"Cannot get current price for {ticker}: {e}")

    @staticmethod
    def get_sparkline(ticker: str, days: int = 30) -> list[float]:
        """Return the last `days` daily closing prices for sparkline charts."""
        try:
            stock = yf.Ticker(ticker)
            # Fetch extra days to account for weekends/holidays
            hist = stock.history(period=f"{days + 15}d")
            if hist.empty:
                return []
            closes = hist["Close"].dropna().tolist()
            # Return only the last `days` data points
            return [round(float(v), 2) for v in closes[-days:]]
        except Exception as e:
            logger.warning(f"Sparkline fetch failed for {ticker}: {e}")
            return []

    @staticmethod
    def validate_ticker(ticker: str) -> bool:
        """Check if a ticker symbol is valid by fetching recent history."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="5d")
            return not hist.empty and len(hist) > 0
        except Exception:
            return False