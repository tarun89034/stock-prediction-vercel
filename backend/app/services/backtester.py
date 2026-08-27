import vectorbt as vbt
import pandas as pd
import numpy as np
import math
from datetime import date
from typing import Optional
from app.services.data_fetcher import DataFetcher
from app.models.schemas import BacktestRequest, BacktestResult, ParameterSweepRequest
import logging

logger = logging.getLogger(__name__)


def _finite(value, ndigits: int = 2) -> Optional[float]:
    """Round a metric for the response, or return None if it isn't finite.

    vectorbt returns inf for ratios with a zero denominator -- profit_factor
    when a backtest has no losing trades, for instance -- and neither inf nor
    nan is JSON-serializable, so they must not reach the response model.
    """
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return round(f, ndigits) if math.isfinite(f) else None

class BacktestEngine:
    """
    Core backtesting engine using vectorbt.
    Supports: SMA Crossover, RSI, MACD strategies.
    All results include transaction costs.
    """

    def __init__(self):
        self.data_fetcher = DataFetcher()

    def run_backtest(self, request: BacktestRequest) -> BacktestResult:
        """Run a single backtest with the given parameters."""
        # 1. Fetch data
        df = self.data_fetcher.fetch_historical(
            request.ticker, request.start_date, request.end_date
        )
        close = df["close"]

        # 2. Generate signals based on strategy
        entries, exits = self._generate_signals(df, request)

        # 3. Run portfolio simulation with costs
        pf = vbt.Portfolio.from_signals(
            close=close,
            entries=entries,
            exits=exits,
            init_cash=request.initial_capital,
            sl_stop=0.05,  # 5% stop-loss (safety net)
            fees=request.commission_pct / 100,
            slippage=request.slippage_pct / 100,
            freq="1D",
        )

        # 4. Calculate benchmark for Alpha/Beta (market-aware)
        benchmark_returns = self.data_fetcher.fetch_benchmark(
            request.start_date, request.end_date, ticker=request.ticker
        )
        strategy_returns = pf.returns()

        alpha, beta = self._calculate_alpha_beta(strategy_returns, benchmark_returns)

        # 5. Build result
        equity = pf.value()
        drawdown = pf.drawdown()
        trades_df = pf.trades.records_readable

        return BacktestResult(
            ticker=request.ticker,
            strategy=request.strategy,
            initial_capital=request.initial_capital,
            final_capital=round(float(equity.iloc[-1]), 2),
            total_return_pct=round(float(pf.total_return() * 100), 2),
            sharpe_ratio=_finite(pf.sharpe_ratio(), 4),
            max_drawdown_pct=round(float(pf.max_drawdown() * 100), 2),
            win_rate_pct=round(float(pf.trades.win_rate() * 100), 2)
            if pf.trades.count() > 0
            else 0.0,
            total_trades=int(pf.trades.count()),
            profit_factor=_finite(pf.trades.profit_factor(), 2)
            if pf.trades.count() > 0
            else None,
            # `is not None` matters: a genuine alpha/beta of 0.0 is falsy.
            alpha=_finite(alpha, 4) if alpha is not None else None,
            beta=_finite(beta, 4) if beta is not None else None,
            equity_curve=self._series_to_list(equity, "equity"),
            drawdown_curve=self._series_to_list(drawdown, "drawdown"),
            trades=self._format_trades(trades_df),
        )

    def run_parameter_sweep(self, request: ParameterSweepRequest) -> list[dict]:
        """
        Run backtests across parameter combinations.
        Returns ranked results. This is NOT instant — manage expectations.
        """
        df = self.data_fetcher.fetch_historical(
            request.ticker, request.start_date, request.end_date
        )
        close = df["close"]
        results = []

        if request.strategy == "sma_crossover":
            for fast in request.fast_window_range:
                for slow in request.slow_window_range:
                    if fast >= slow:
                        continue  # Skip invalid combos

                    fast_ma = vbt.MA.run(close, window=fast)
                    slow_ma = vbt.MA.run(close, window=slow)
                    entries = fast_ma.ma_crossed_above(slow_ma)
                    exits = fast_ma.ma_crossed_below(slow_ma)

                    pf = vbt.Portfolio.from_signals(
                        close=close,
                        entries=entries,
                        exits=exits,
                        init_cash=request.initial_capital,
                        fees=request.commission_pct / 100,
                        slippage=request.slippage_pct / 100,
                        freq="1D",
                    )

                    results.append({
                        "fast_window": fast,
                        "slow_window": slow,
                        "total_return_pct": round(float(pf.total_return() * 100), 2),
                        "sharpe_ratio": _finite(pf.sharpe_ratio(), 4),
                        "max_drawdown_pct": round(float(pf.max_drawdown() * 100), 2),
                        "total_trades": int(pf.trades.count()),
                        "win_rate_pct": round(float(pf.trades.win_rate() * 100), 2)
                        if pf.trades.count() > 0
                        else 0.0,
                    })

        # Sort by Sharpe ratio (risk-adjusted return, not raw return)
        results.sort(key=lambda x: x["sharpe_ratio"] or -999, reverse=True)
        return results

    def _generate_signals(
        self, df: pd.DataFrame, request: BacktestRequest
    ) -> tuple[pd.Series, pd.Series]:
        """Generate entry/exit signals based on strategy type."""
        close = df["close"]

        if request.strategy == "sma_crossover":
            fast_ma = vbt.MA.run(close, window=request.fast_window)
            slow_ma = vbt.MA.run(close, window=request.slow_window)
            entries = fast_ma.ma_crossed_above(slow_ma)
            exits = fast_ma.ma_crossed_below(slow_ma)

        elif request.strategy == "rsi":
            rsi = vbt.RSI.run(close, window=request.rsi_period)
            entries = rsi.rsi_crossed_below(request.rsi_oversold)  # Buy oversold
            exits = rsi.rsi_crossed_above(request.rsi_overbought)  # Sell overbought

        elif request.strategy == "macd":
            macd = vbt.MACD.run(close)
            entries = macd.macd_crossed_above(macd.signal)
            exits = macd.macd_crossed_below(macd.signal)

        else:
            raise ValueError(f"Unknown strategy: {request.strategy}")

        return entries, exits

    @staticmethod
    def _calculate_alpha_beta(
        strategy_returns: pd.Series, benchmark_returns: pd.Series
    ) -> tuple[float | None, float | None]:
        """Calculate Alpha and Beta against benchmark."""
        try:
            # Align dates
            aligned = pd.concat(
                [strategy_returns, benchmark_returns], axis=1, join="inner"
            )
            aligned.columns = ["strategy", "benchmark"]
            aligned.dropna(inplace=True)

            if len(aligned) < 30:  # Need minimum data
                return None, None

            cov = np.cov(aligned["strategy"], aligned["benchmark"])
            beta = cov[0, 1] / cov[1, 1]
            alpha = (
                aligned["strategy"].mean() - beta * aligned["benchmark"].mean()
            ) * 252  # Annualized

            return float(alpha), float(beta)
        except Exception:
            return None, None

    @staticmethod
    def _series_to_list(series: pd.Series, value_name: str) -> list[dict]:
        """Convert pandas Series to list of dicts for JSON serialization."""
        return [
            {"date": d.isoformat(), value_name: round(float(v), 2)}
            for d, v in series.items()
        ]

    @staticmethod
    def _format_trades(trades_df: pd.DataFrame) -> list[dict]:
        """Format trades for frontend display, mapping vectorbt fields to frontend Trade type."""
        if trades_df is None or trades_df.empty:
            return []
        result = []
        for i, row in trades_df.head(100).iterrows():
            entry_ts = row.get("Entry Timestamp", "")
            exit_ts = row.get("Exit Timestamp", "")
            entry_price = row.get("Avg Entry Price", 0)
            exit_price = row.get("Avg Exit Price", 0)
            pnl = row.get("PnL", 0)
            ret = row.get("Return", 0)
            direction = row.get("Direction", "Long")

            # Calculate duration in days
            duration = 0
            try:
                if pd.notna(entry_ts) and pd.notna(exit_ts):
                    duration = (pd.Timestamp(exit_ts) - pd.Timestamp(entry_ts)).days
            except Exception:
                pass

            result.append({
                "id": int(row.get("Exit Trade Id", i)),
                "entry_date": str(entry_ts).split(" ")[0] if pd.notna(entry_ts) else "",
                "exit_date": str(exit_ts).split(" ")[0] if pd.notna(exit_ts) else "",
                "direction": str(direction),
                "entry_price": round(float(entry_price), 2) if pd.notna(entry_price) else 0,
                "exit_price": round(float(exit_price), 2) if pd.notna(exit_price) else 0,
                "pnl": round(float(pnl), 2) if pd.notna(pnl) else 0,
                "pnl_pct": round(float(ret) * 100, 2) if pd.notna(ret) else 0,
                "duration": duration,
            })
        return result