from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def metrics_health():
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