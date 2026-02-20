"""Input validation helpers for API endpoints."""
import re
from datetime import date, timedelta
from fastapi import HTTPException


def validate_ticker_symbol(ticker: str) -> str:
    """Validate and normalize ticker symbol."""
    ticker = ticker.strip().upper()
    if not re.match(r"^[A-Z]{1,5}$", ticker):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ticker symbol: '{ticker}'. Must be 1-5 uppercase letters.",
        )
    return ticker


def validate_date_range(start_date: date, end_date: date, max_years: int = 10) -> None:
    """Validate that a date range is reasonable."""
    if start_date >= end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date must be before end date.",
        )

    max_delta = timedelta(days=max_years * 365)
    if (end_date - start_date) > max_delta:
        raise HTTPException(
            status_code=400,
            detail=f"Date range exceeds maximum of {max_years} years.",
        )

    if end_date > date.today():
        raise HTTPException(
            status_code=400,
            detail="End date cannot be in the future.",
        )


def validate_parameter_ranges(
    fast_range: list[int], slow_range: list[int], max_combos: int = 100
) -> None:
    """Validate parameter sweep won't overload the server."""
    total = len(fast_range) * len(slow_range)
    if total > max_combos:
        raise HTTPException(
            status_code=400,
            detail=f"Too many parameter combinations ({total}). Maximum is {max_combos}.",
        )
