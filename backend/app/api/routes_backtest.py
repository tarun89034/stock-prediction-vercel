from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models.schemas import BacktestRequest, BacktestResult, ParameterSweepRequest
from app.services.backtester import BacktestEngine

router = APIRouter()
engine = BacktestEngine()

@router.post("/run", response_model=BacktestResult)
async def run_backtest(request: BacktestRequest):
    """Run a single backtest."""
    try:
        if request.strategy == "sma_crossover" and request.fast_window >= request.slow_window:
            raise HTTPException(
                status_code=400,
                detail="Fast window must be less than slow window",
            )
        result = engine.run_backtest(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")

@router.post("/sweep")
async def parameter_sweep(request: ParameterSweepRequest):
    """Run parameter optimization sweep. Can be slow — warn users."""
    try:
        total_combos = len(request.fast_window_range) * len(request.slow_window_range)
        if total_combos > 100:
            raise HTTPException(
                status_code=400,
                detail=f"Too many combinations ({total_combos}). Max 100. Reduce parameter ranges.",
            )
        results = engine.run_parameter_sweep(request)
        return {
            "ticker": request.ticker,
            "strategy": request.strategy,
            "combinations_tested": len(results),
            "results": results,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))