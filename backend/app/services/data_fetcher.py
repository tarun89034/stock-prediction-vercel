import yfinance as yf
import pandas as pd
from datetime import date, timedelta
from functools import lru_cache
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class DataFetcher:
    """
    Wrapper around yfinance.
    Rule: yfinance is ONLY for historical data. Never for live/production feeds.
    """

    @staticmethod
    def fetch_historical(
        ticker: str,
        start_date: date,
        end_date: date,
        interval: str = "1d",
    ) -> pd.DataFrame:
        """Fetch OHLCV data. Returns cleaned DataFrame."""
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