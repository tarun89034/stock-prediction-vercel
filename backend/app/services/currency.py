"""
Currency conversion service using the Open Exchange Rates API.
https://open.er-api.com — free, no API key required, updated daily.
Fallback: https://api.frankfurter.app (ECB data, fewer currencies).
"""

import httpx
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Supported currencies with symbols and names
SUPPORTED_CURRENCIES = {
    "USD": {"symbol": "$", "name": "US Dollar"},
    "INR": {"symbol": "\u20b9", "name": "Indian Rupee"},
    "EUR": {"symbol": "\u20ac", "name": "Euro"},
    "GBP": {"symbol": "\u00a3", "name": "British Pound"},
    "JPY": {"symbol": "\u00a5", "name": "Japanese Yen"},
    "CAD": {"symbol": "C$", "name": "Canadian Dollar"},
    "AUD": {"symbol": "A$", "name": "Australian Dollar"},
    "CHF": {"symbol": "CHF", "name": "Swiss Franc"},
    "CNY": {"symbol": "\u00a5", "name": "Chinese Yuan"},
    "SGD": {"symbol": "S$", "name": "Singapore Dollar"},
    "HKD": {"symbol": "HK$", "name": "Hong Kong Dollar"},
    "KRW": {"symbol": "\u20a9", "name": "South Korean Won"},
    "BRL": {"symbol": "R$", "name": "Brazilian Real"},
    "MXN": {"symbol": "$", "name": "Mexican Peso"},
    "ZAR": {"symbol": "R", "name": "South African Rand"},
    "SEK": {"symbol": "kr", "name": "Swedish Krona"},
    "NZD": {"symbol": "NZ$", "name": "New Zealand Dollar"},
}

# In-memory cache for exchange rates
# key = "USD" -> {"rates": {"INR": 83.5, ...}, "timestamp": 1234567890}
_rate_cache: dict[str, dict] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour (rates update once daily)

OPEN_ER_API_BASE = "https://open.er-api.com/v6/latest"
FRANKFURTER_BASE = "https://api.frankfurter.app"


class CurrencyService:
    """Fetches exchange rates and converts amounts between currencies."""

    @staticmethod
    def get_supported_currencies() -> dict:
        """Return all supported currencies with symbols and names."""
        return SUPPORTED_CURRENCIES

    @staticmethod
    def _get_cached_rates(base: str) -> Optional[dict[str, float]]:
        """Get cached rates for a base currency, or None if stale/missing."""
        cached = _rate_cache.get(base.upper())
        if cached and (time.time() - cached["timestamp"]) < CACHE_TTL_SECONDS:
            return cached["rates"]
        return None

    @staticmethod
    def _set_cached_rates(base: str, rates: dict[str, float]) -> None:
        """Cache all rates for a base currency."""
        _rate_cache[base.upper()] = {"rates": rates, "timestamp": time.time()}

    @staticmethod
    def _fetch_rates_from_api(base_currency: str) -> dict[str, float]:
        """
        Fetch all exchange rates for a base currency.
        Primary: open.er-api.com (supports INR, CNY, and 150+ currencies)
        Fallback: frankfurter.app (ECB data, ~30 currencies, no INR)
        """
        base = base_currency.upper()

        # Try primary API: open.er-api.com
        try:
            url = f"{OPEN_ER_API_BASE}/{base}"
            with httpx.Client(timeout=10.0) as client:
                response = client.get(url)
                response.raise_for_status()
                data = response.json()

            if data.get("result") == "success":
                rates = data["rates"]
                logger.info(f"Fetched {len(rates)} rates from open.er-api.com (base={base})")
                return rates

        except Exception as e:
            logger.warning(f"Primary API (open.er-api.com) failed for {base}: {e}")

        # Fallback: frankfurter.app
        try:
            targets = [c for c in SUPPORTED_CURRENCIES if c != base]
            to_param = ",".join(targets)
            url = f"{FRANKFURTER_BASE}/latest?from={base}&to={to_param}"
            with httpx.Client(timeout=10.0) as client:
                response = client.get(url)
                response.raise_for_status()
                data = response.json()

            rates = data.get("rates", {})
            # Add self-rate
            rates[base] = 1.0
            logger.info(f"Fetched {len(rates)} rates from frankfurter.app (base={base})")
            return rates

        except Exception as e:
            logger.error(f"Fallback API (frankfurter.app) also failed for {base}: {e}")
            raise ValueError(f"Could not fetch exchange rates for {base}")

    @staticmethod
    def _ensure_rates(base_currency: str) -> dict[str, float]:
        """Get rates from cache or fetch from API."""
        base = base_currency.upper()
        cached = CurrencyService._get_cached_rates(base)
        if cached is not None:
            return cached

        rates = CurrencyService._fetch_rates_from_api(base)
        CurrencyService._set_cached_rates(base, rates)
        return rates

    @staticmethod
    def get_exchange_rate(from_currency: str, to_currency: str) -> float:
        """
        Get the exchange rate from one currency to another.
        Returns the rate as a float (e.g., 83.5 for USD->INR).
        """
        from_c = from_currency.upper()
        to_c = to_currency.upper()

        if from_c == to_c:
            return 1.0

        rates = CurrencyService._ensure_rates(from_c)
        rate = rates.get(to_c)
        if rate is None:
            raise ValueError(f"Currency {to_c} is not available")
        return rate

    @staticmethod
    def get_all_rates(base_currency: str = "USD") -> dict[str, float]:
        """
        Get exchange rates from base currency to all supported currencies.
        Returns a dict like {"INR": 83.5, "EUR": 0.92, ...}.
        """
        base = base_currency.upper()
        all_rates = CurrencyService._ensure_rates(base)

        # Filter to only supported currencies
        return {
            code: all_rates[code]
            for code in SUPPORTED_CURRENCIES
            if code != base and code in all_rates
        }

    @staticmethod
    def convert(amount: float, from_currency: str, to_currency: str) -> dict:
        """
        Convert an amount from one currency to another.
        Returns dict with converted amount and metadata.
        """
        rate = CurrencyService.get_exchange_rate(from_currency, to_currency)
        converted = amount * rate
        to_upper = to_currency.upper()
        return {
            "from_currency": from_currency.upper(),
            "to_currency": to_upper,
            "rate": rate,
            "original_amount": amount,
            "converted_amount": round(converted, 2),
            "symbol": SUPPORTED_CURRENCIES.get(to_upper, {}).get("symbol", ""),
        }
