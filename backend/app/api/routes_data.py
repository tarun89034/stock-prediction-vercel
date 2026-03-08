from fastapi import APIRouter, HTTPException, Query, Request
from app.services.data_fetcher import DataFetcher
from app.services.currency import CurrencyService
from slowapi import Limiter
from slowapi.util import get_remote_address
import asyncio

router = APIRouter()
fetcher = DataFetcher()
currency_service = CurrencyService()
limiter = Limiter(key_func=get_remote_address)

@router.get("/price/{ticker}")
@limiter.limit("30/minute")
async def get_current_price(request: Request, ticker: str):
    try:
        price = await asyncio.to_thread(fetcher.get_current_price, ticker)
        return {"ticker": ticker, "price": price}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/validate/{ticker}")
@limiter.limit("30/minute")
async def validate_ticker(request: Request, ticker: str):
    valid = await asyncio.to_thread(fetcher.validate_ticker, ticker)
    return {"ticker": ticker, "valid": valid}

@router.get("/historical/{ticker}")
@limiter.limit("20/minute")
async def get_historical(request: Request, ticker: str, start: str, end: str):
    from datetime import date
    try:
        df = await asyncio.to_thread(
            fetcher.fetch_historical, ticker, date.fromisoformat(start), date.fromisoformat(end)
        )
        return {
            "ticker": ticker,
            "rows": len(df),
            "data": df.reset_index().to_dict(orient="records"),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Currency Conversion Endpoints ───


@router.get("/currencies")
@limiter.limit("30/minute")
async def get_supported_currencies(request: Request):
    """Return all supported currencies with symbols and names."""
    return currency_service.get_supported_currencies()


@router.get("/exchange-rate/{from_currency}/{to_currency}")
@limiter.limit("30/minute")
async def get_exchange_rate(request: Request, from_currency: str, to_currency: str):
    """Get the exchange rate between two currencies."""
    try:
        rate = await asyncio.to_thread(
            currency_service.get_exchange_rate, from_currency, to_currency
        )
        from_upper = from_currency.upper()
        to_upper = to_currency.upper()
        currencies = currency_service.get_supported_currencies()
        return {
            "from": from_upper,
            "to": to_upper,
            "rate": rate,
            "from_symbol": currencies.get(from_upper, {}).get("symbol", ""),
            "to_symbol": currencies.get(to_upper, {}).get("symbol", ""),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exchange-rates")
@limiter.limit("20/minute")
async def get_all_exchange_rates(request: Request, base: str = Query(default="USD")):
    """Get exchange rates from base currency to all supported currencies."""
    try:
        rates = await asyncio.to_thread(currency_service.get_all_rates, base)
        currencies = currency_service.get_supported_currencies()
        return {
            "base": base.upper(),
            "rates": rates,
            "currencies": currencies,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/convert")
@limiter.limit("30/minute")
async def convert_amount(
    request: Request,
    amount: float = Query(..., description="Amount to convert"),
    from_currency: str = Query(default="USD", alias="from"),
    to_currency: str = Query(..., alias="to"),
):
    """Convert an amount from one currency to another."""
    try:
        result = await asyncio.to_thread(
            currency_service.convert, amount, from_currency, to_currency
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))