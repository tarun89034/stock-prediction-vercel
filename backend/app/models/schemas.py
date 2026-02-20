from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class BacktestRequest(BaseModel):
    ticker: str = Field(..., json_schema_extra={"example": "AAPL"})
    start_date: date = Field(..., json_schema_extra={"example": "2020-01-01"})
    end_date: date = Field(..., json_schema_extra={"example": "2025-01-01"})
    strategy: str = Field(..., json_schema_extra={"example": "sma_crossover"})  # sma_crossover, rsi, macd
    # Strategy parameters
    fast_window: int = Field(default=20, ge=5, le=200)
    slow_window: int = Field(default=50, ge=10, le=500)
    rsi_period: int = Field(default=14, ge=5, le=50)
    rsi_overbought: float = Field(default=70.0, ge=50, le=95)
    rsi_oversold: float = Field(default=30.0, ge=5, le=50)
    # Cost parameters
    initial_capital: float = Field(default=10000.0, ge=100)
    slippage_pct: float = Field(default=0.1, ge=0, le=2.0)
    commission_pct: float = Field(default=0.1, ge=0, le=2.0)

class BacktestResult(BaseModel):
    ticker: str
    strategy: str
    initial_capital: float
    final_capital: float
    total_return_pct: float
    sharpe_ratio: Optional[float]
    max_drawdown_pct: float
    win_rate_pct: float
    total_trades: int
    profit_factor: Optional[float]
    alpha: Optional[float]
    beta: Optional[float]
    # Serialized chart data (dates + equity curve)
    equity_curve: list[dict]
    drawdown_curve: list[dict]
    trades: list[dict]

class PredictionRequest(BaseModel):
    ticker: str = Field(..., json_schema_extra={"example": "AAPL"})
    prediction_days: int = Field(default=5, ge=1, le=30)

class PredictionResult(BaseModel):
    ticker: str
    current_price: float
    predictions: list[dict]  # [{date, predicted_price, confidence}]
    signal: str  # "BUY", "SELL", "HOLD"
    shap_explanation: list[dict]  # [{feature, value, impact}]
    model_accuracy: float
    walk_forward_score: float

class ParameterSweepRequest(BaseModel):
    ticker: str
    start_date: date
    end_date: date
    strategy: str
    # Ranges for optimization
    fast_window_range: list[int] = Field(default=[10, 20, 30, 50])
    slow_window_range: list[int] = Field(default=[50, 100, 150, 200])
    initial_capital: float = Field(default=10000.0)
    slippage_pct: float = Field(default=0.1)
    commission_pct: float = Field(default=0.1)