from fastapi import APIRouter, HTTPException, Request
from app.models.schemas import BacktestRequest, BacktestResult, ParameterSweepRequest
from app.services.backtester import BacktestEngine
from app.utils.validators import validate_date_range, validate_parameter_ranges
from slowapi import Limiter
from slowapi.util import get_remote_address
import asyncio

router = APIRouter()
engine = BacktestEngine()
limiter = Limiter(key_func=get_remote_address)

@router.post("/run", response_model=BacktestResult)
@limiter.limit("10/minute")
async def run_backtest(request: Request, backtest_request: BacktestRequest):
    """Run a single backtest."""
    try:
        validate_date_range(backtest_request.start_date, backtest_request.end_date)
        if backtest_request.strategy == "sma_crossover" and backtest_request.fast_window >= backtest_request.slow_window:
            raise HTTPException(
                status_code=400,
                detail="Fast window must be less than slow window",
            )
        result = await asyncio.to_thread(engine.run_backtest, backtest_request)
        return result
    except HTTPException:
        # Already a deliberate 4xx (validation) — don't re-wrap it as a 500.
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")

@router.post("/sweep")
@limiter.limit("5/minute")
async def parameter_sweep(request: Request, sweep_request: ParameterSweepRequest):
    """Run parameter optimization sweep. Can be slow — warn users."""
    try:
        validate_date_range(sweep_request.start_date, sweep_request.end_date)
        validate_parameter_ranges(
            sweep_request.fast_window_range, sweep_request.slow_window_range
        )
        results = await asyncio.to_thread(engine.run_parameter_sweep, sweep_request)
        return {
            "ticker": sweep_request.ticker,
            "strategy": sweep_request.strategy,
            "combinations_tested": len(results),
            "results": results,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))