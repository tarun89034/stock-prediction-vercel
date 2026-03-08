from fastapi import APIRouter, HTTPException, Request
from app.models.schemas import BacktestRequest, BacktestResult, ParameterSweepRequest
from app.services.backtester import BacktestEngine
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
        if backtest_request.strategy == "sma_crossover" and backtest_request.fast_window >= backtest_request.slow_window:
            raise HTTPException(
                status_code=400,
                detail="Fast window must be less than slow window",
            )
        result = await asyncio.to_thread(engine.run_backtest, backtest_request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")

@router.post("/sweep")
@limiter.limit("5/minute")
async def parameter_sweep(request: Request, sweep_request: ParameterSweepRequest):
    """Run parameter optimization sweep. Can be slow — warn users."""
    try:
        total_combos = len(sweep_request.fast_window_range) * len(sweep_request.slow_window_range)
        if total_combos > 100:
            raise HTTPException(
                status_code=400,
                detail=f"Too many combinations ({total_combos}). Max 100. Reduce parameter ranges.",
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