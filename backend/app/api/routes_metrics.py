from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

@router.get("/health")
@limiter.limit("30/minute")
async def metrics_health(request: Request):
    """Metrics are embedded in backtest results. This route is a placeholder."""
    return {
        "available_metrics": [
            "sharpe_ratio",
            "max_drawdown",
            "win_rate",
            "profit_factor",
            "alpha",
            "beta",
            "total_return",
        ]
    }