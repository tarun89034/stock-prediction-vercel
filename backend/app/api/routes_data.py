from fastapi import APIRouter, HTTPException, Query
from app.services.data_fetcher import DataFetcher
from app.services.currency import CurrencyService

router = APIRouter()
fetcher = DataFetcher()
currency_service = CurrencyService()

@router.get("/price/{ticker}")
async def get_current_price(ticker: str):
    try:
        price = fetcher.get_current_price(ticker)
        return {"ticker": ticker, "price": price}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/validate/{ticker}")
async def validate_ticker(ticker: str):
    valid = fetcher.validate_ticker(ticker)
    return {"ticker": ticker, "valid": valid}

@router.get("/historical/{ticker}")
async def get_historical(ticker: str, start: str, end: str):
    from datetime import date
    try:
        df = fetcher.fetch_historical(ticker, date.fromisoformat(start), date.fromisoformat(end))
        return {
            "ticker": ticker,
            "rows": len(df),
            "data": df.reset_index().to_dict(orient="records"),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Currency Conversion Endpoints ───


@router.get("/currencies")
async def get_supported_currencies():
    """Return all supported currencies with symbols and names."""
    return currency_service.get_supported_currencies()


@router.get("/exchange-rate/{from_currency}/{to_currency}")
async def get_exchange_rate(from_currency: str, to_currency: str):
    """Get the exchange rate between two currencies."""
    try:
        rate = currency_service.get_exchange_rate(from_currency, to_currency)
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
async def get_all_exchange_rates(base: str = Query(default="USD")):
    """Get exchange rates from base currency to all supported currencies."""
    try:
        rates = currency_service.get_all_rates(base)
        currencies = currency_service.get_supported_currencies()
        return {
            "base": base.upper(),
            "rates": rates,
            "currencies": currencies,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/convert")
async def convert_amount(
    amount: float = Query(..., description="Amount to convert"),
    from_currency: str = Query(default="USD", alias="from"),
    to_currency: str = Query(..., alias="to"),
):
    """Convert an amount from one currency to another."""
    try:
        result = currency_service.convert(amount, from_currency, to_currency)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))