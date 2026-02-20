from fastapi import APIRouter, HTTPException
from app.services.data_fetcher import DataFetcher

router = APIRouter()
fetcher = DataFetcher()

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