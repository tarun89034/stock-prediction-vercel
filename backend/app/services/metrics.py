"""
Quantitative performance metrics calculation.
Uses quantstats for standard financial metrics.
"""
import pandas as pd
import numpy as np
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class MetricsCalculator:
    """Calculate quantitative performance metrics for backtests."""

    @staticmethod
    def calculate_sharpe_ratio(
        returns: pd.Series, risk_free_rate: float = 0.02
    ) -> Optional[float]:
        """
        Calculate annualized Sharpe Ratio.
        Sharpe = (mean_return - risk_free) / std_return * sqrt(252)
        """
        try:
            if returns.std() == 0:
                return None
            excess_returns = returns - risk_free_rate / 252
            sharpe = (excess_returns.mean() / excess_returns.std()) * np.sqrt(252)
            return round(float(sharpe), 4)
        except Exception:
            return None

    @staticmethod
    def calculate_max_drawdown(equity_curve: pd.Series) -> float:
        """Calculate maximum drawdown as a percentage."""
        try:
            peak = equity_curve.expanding(min_periods=1).max()
            drawdown = (equity_curve - peak) / peak
            return round(float(drawdown.min() * 100), 2)
        except Exception:
            return 0.0

    @staticmethod
    def calculate_win_rate(trades_pnl: pd.Series) -> float:
        """Calculate win rate as percentage of profitable trades."""
        if len(trades_pnl) == 0:
            return 0.0
        wins = (trades_pnl > 0).sum()
        return round(float(wins / len(trades_pnl) * 100), 2)

    @staticmethod
    def calculate_profit_factor(trades_pnl: pd.Series) -> Optional[float]:
        """
        Calculate profit factor: gross profits / gross losses.
        > 1.0 means profitable. > 2.0 is strong.
        """
        try:
            gross_profit = trades_pnl[trades_pnl > 0].sum()
            gross_loss = abs(trades_pnl[trades_pnl < 0].sum())
            if gross_loss == 0:
                return None
            return round(float(gross_profit / gross_loss), 2)
        except Exception:
            return None

    @staticmethod
    def calculate_alpha_beta(
        strategy_returns: pd.Series,
        benchmark_returns: pd.Series,
    ) -> tuple[Optional[float], Optional[float]]:
        """
        Calculate Alpha and Beta relative to benchmark.
        Alpha: annualized excess return
        Beta: strategy volatility relative to market
        """
        try:
            aligned = pd.concat(
                [strategy_returns, benchmark_returns], axis=1, join="inner"
            )
            aligned.columns = ["strategy", "benchmark"]
            aligned.dropna(inplace=True)

            if len(aligned) < 30:
                return None, None

            cov = np.cov(aligned["strategy"], aligned["benchmark"])
            beta = cov[0, 1] / cov[1, 1]
            alpha = (
                aligned["strategy"].mean() - beta * aligned["benchmark"].mean()
            ) * 252  # Annualized

            return round(float(alpha), 4), round(float(beta), 4)
        except Exception:
            return None, None

    @staticmethod
    def calculate_sortino_ratio(
        returns: pd.Series, risk_free_rate: float = 0.02
    ) -> Optional[float]:
        """Sortino ratio: like Sharpe but only penalizes downside volatility."""
        try:
            excess_returns = returns - risk_free_rate / 252
            downside_returns = excess_returns[excess_returns < 0]
            if len(downside_returns) == 0 or downside_returns.std() == 0:
                return None
            sortino = (excess_returns.mean() / downside_returns.std()) * np.sqrt(252)
            return round(float(sortino), 4)
        except Exception:
            return None

    @staticmethod
    def calculate_calmar_ratio(
        returns: pd.Series, equity_curve: pd.Series
    ) -> Optional[float]:
        """Calmar ratio: annualized return / max drawdown."""
        try:
            annual_return = returns.mean() * 252
            peak = equity_curve.expanding(min_periods=1).max()
            drawdown = (equity_curve - peak) / peak
            max_dd = abs(drawdown.min())
            if max_dd == 0:
                return None
            return round(float(annual_return / max_dd), 4)
        except Exception:
            return None

    @staticmethod
    def get_full_metrics(
        returns: pd.Series,
        equity_curve: pd.Series,
        trades_pnl: pd.Series,
        benchmark_returns: Optional[pd.Series] = None,
    ) -> dict:
        """Calculate all available metrics and return as a dict."""
        calc = MetricsCalculator

        metrics = {
            "sharpe_ratio": calc.calculate_sharpe_ratio(returns),
            "sortino_ratio": calc.calculate_sortino_ratio(returns),
            "max_drawdown_pct": calc.calculate_max_drawdown(equity_curve),
            "win_rate_pct": calc.calculate_win_rate(trades_pnl),
            "profit_factor": calc.calculate_profit_factor(trades_pnl),
            "calmar_ratio": calc.calculate_calmar_ratio(returns, equity_curve),
            "total_return_pct": round(
                float((equity_curve.iloc[-1] / equity_curve.iloc[0] - 1) * 100), 2
            )
            if len(equity_curve) > 0
            else 0.0,
            "total_trades": len(trades_pnl),
            "annualized_return_pct": round(float(returns.mean() * 252 * 100), 2),
            "annualized_volatility_pct": round(
                float(returns.std() * np.sqrt(252) * 100), 2
            ),
        }

        if benchmark_returns is not None:
            alpha, beta = calc.calculate_alpha_beta(returns, benchmark_returns)
            metrics["alpha"] = alpha
            metrics["beta"] = beta
        else:
            metrics["alpha"] = None
            metrics["beta"] = None

        return metrics
