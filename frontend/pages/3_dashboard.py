import streamlit as st
import requests
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd

API_BASE = "http://localhost:8000/api"

st.title("Dashboard - Performance Metrics")
st.markdown(
    "Run a backtest first, then view detailed performance analytics here."
)

# --- Input Controls ---
with st.sidebar:
    st.header("Dashboard Settings")
    ticker = st.text_input("Ticker Symbol", value="AAPL")
    strategy = st.selectbox("Strategy", ["sma_crossover", "rsi", "macd"])
    start_date = st.date_input("Start Date", value=pd.to_datetime("2020-01-01"))
    end_date = st.date_input("End Date", value=pd.to_datetime("2025-01-01"))
    initial_capital = st.number_input("Initial Capital ($)", value=10000, step=1000)
    slippage = st.slider("Slippage (%)", 0.0, 2.0, 0.1, step=0.05)
    commission = st.slider("Commission (%)", 0.0, 2.0, 0.1, step=0.05)

    if strategy == "sma_crossover":
        fast_window = st.slider("Fast MA Window", 5, 100, 20)
        slow_window = st.slider("Slow MA Window", 20, 300, 50)
    elif strategy == "rsi":
        rsi_period = st.slider("RSI Period", 5, 50, 14)
        rsi_overbought = st.slider("RSI Overbought", 50, 95, 70)
        rsi_oversold = st.slider("RSI Oversold", 5, 50, 30)

if st.button("Generate Dashboard", type="primary"):
    with st.spinner("Running backtest for dashboard metrics..."):
        payload = {
            "ticker": ticker,
            "start_date": str(start_date),
            "end_date": str(end_date),
            "strategy": strategy,
            "initial_capital": initial_capital,
            "slippage_pct": slippage,
            "commission_pct": commission,
            "fast_window": fast_window if strategy == "sma_crossover" else 20,
            "slow_window": slow_window if strategy == "sma_crossover" else 50,
            "rsi_period": rsi_period if strategy == "rsi" else 14,
            "rsi_overbought": rsi_overbought if strategy == "rsi" else 70,
            "rsi_oversold": rsi_oversold if strategy == "rsi" else 30,
        }
        try:
            response = requests.post(
                f"{API_BASE}/backtest/run", json=payload, timeout=60
            )
            result = response.json()

            if response.status_code == 200:
                st.markdown("---")

                # --- Summary Metrics Row ---
                st.markdown("## Key Performance Indicators")
                c1, c2, c3, c4 = st.columns(4)
                c1.metric(
                    "Total Return",
                    f"{result['total_return_pct']:+.2f}%",
                    delta=f"${result['final_capital'] - result['initial_capital']:,.2f}",
                )
                c2.metric(
                    "Sharpe Ratio",
                    f"{result['sharpe_ratio']:.4f}"
                    if result.get("sharpe_ratio") is not None
                    else "N/A",
                )
                c3.metric(
                    "Max Drawdown",
                    f"-{result['max_drawdown_pct']:.2f}%",
                )
                c4.metric(
                    "Profit Factor",
                    f"{result['profit_factor']:.2f}"
                    if result.get("profit_factor") is not None
                    else "N/A",
                )

                c5, c6, c7, c8 = st.columns(4)
                c5.metric("Win Rate", f"{result['win_rate_pct']:.1f}%")
                c6.metric("Total Trades", result["total_trades"])
                c7.metric(
                    "Alpha (annualized)",
                    f"{result['alpha']:.4f}"
                    if result.get("alpha") is not None
                    else "N/A",
                )
                c8.metric(
                    "Beta",
                    f"{result['beta']:.4f}"
                    if result.get("beta") is not None
                    else "N/A",
                )

                # --- Interpretation Cards ---
                st.markdown("---")
                st.markdown("## Metric Interpretation")

                sharpe = result.get("sharpe_ratio")
                if sharpe is not None:
                    if sharpe < 0:
                        st.error(
                            f"**Sharpe Ratio: {sharpe:.4f}** - This strategy is losing "
                            f"money on a risk-adjusted basis. Negative Sharpe means "
                            f"you'd be better off in risk-free assets."
                        )
                    elif sharpe < 1.0:
                        st.warning(
                            f"**Sharpe Ratio: {sharpe:.4f}** - Below 1.0. The risk-adjusted "
                            f"return is modest. Consider optimizing parameters."
                        )
                    elif sharpe < 2.0:
                        st.success(
                            f"**Sharpe Ratio: {sharpe:.4f}** - Decent risk-adjusted return. "
                            f"Above 1.0 is generally considered acceptable."
                        )
                    else:
                        st.info(
                            f"**Sharpe Ratio: {sharpe:.4f}** - Excellent risk-adjusted return. "
                            f"Verify this isn't due to overfitting on a specific period."
                        )

                max_dd = result["max_drawdown_pct"]
                if max_dd > 30:
                    st.error(
                        f"**Max Drawdown: -{max_dd:.2f}%** - Severe drawdown. At some point "
                        f"your portfolio dropped by over 30% from its peak. Most investors "
                        f"cannot stomach this level of loss."
                    )
                elif max_dd > 15:
                    st.warning(
                        f"**Max Drawdown: -{max_dd:.2f}%** - Moderate drawdown. Expect "
                        f"significant paper losses during bad periods."
                    )
                else:
                    st.success(
                        f"**Max Drawdown: -{max_dd:.2f}%** - Relatively contained drawdown."
                    )

                # --- Equity & Drawdown Charts ---
                st.markdown("---")
                st.markdown("## Equity Curve & Drawdown")

                equity_df = pd.DataFrame(result["equity_curve"])
                equity_df["date"] = pd.to_datetime(equity_df["date"])

                fig = make_subplots(
                    rows=2,
                    cols=1,
                    shared_xaxes=True,
                    vertical_spacing=0.08,
                    subplot_titles=(
                        "Portfolio Value Over Time",
                        "Drawdown From Peak",
                    ),
                    row_heights=[0.65, 0.35],
                )

                # Equity curve
                fig.add_trace(
                    go.Scatter(
                        x=equity_df["date"],
                        y=equity_df["equity"],
                        mode="lines",
                        name="Portfolio Value",
                        line=dict(color="#00d4aa", width=2),
                        fill="tozeroy",
                        fillcolor="rgba(0,212,170,0.1)",
                    ),
                    row=1,
                    col=1,
                )
                fig.add_hline(
                    y=initial_capital,
                    line_dash="dash",
                    line_color="gray",
                    annotation_text=f"Starting: ${initial_capital:,.0f}",
                    row=1,
                    col=1,
                )

                # Drawdown curve
                if result.get("drawdown_curve"):
                    dd_df = pd.DataFrame(result["drawdown_curve"])
                    dd_df["date"] = pd.to_datetime(dd_df["date"])
                    fig.add_trace(
                        go.Scatter(
                            x=dd_df["date"],
                            y=[-v * 100 for v in dd_df["drawdown"]],
                            mode="lines",
                            name="Drawdown %",
                            line=dict(color="#ff4444", width=1),
                            fill="tozeroy",
                            fillcolor="rgba(255,68,68,0.2)",
                        ),
                        row=2,
                        col=1,
                    )

                fig.update_layout(
                    height=700, template="plotly_dark", showlegend=True
                )
                fig.update_yaxes(title_text="Portfolio ($)", row=1, col=1)
                fig.update_yaxes(title_text="Drawdown (%)", row=2, col=1)
                st.plotly_chart(fig, use_container_width=True)

                # --- Trade Log ---
                st.markdown("---")
                st.markdown("## Trade Log (Last 100 Trades)")
                if result.get("trades"):
                    trades_df = pd.DataFrame(result["trades"])
                    st.dataframe(trades_df, use_container_width=True)
                else:
                    st.info("No trades were executed in this backtest.")

                # --- Metric Reference Table ---
                st.markdown("---")
                st.markdown("## Metric Reference")
                ref_data = {
                    "Metric": [
                        "Sharpe Ratio",
                        "Max Drawdown",
                        "Win Rate",
                        "Profit Factor",
                        "Alpha",
                        "Beta",
                    ],
                    "What It Means": [
                        "Risk-adjusted return. >1 decent, >2 excellent, <0 losing money",
                        "Worst peak-to-trough decline. How bad it could get.",
                        "% of trades that were profitable",
                        "Gross profit / gross loss. >1 profitable, >2 strong",
                        "Excess return vs. S&P 500 (annualized). Positive = beating market",
                        "Volatility relative to market. 1.0 = moves with market",
                    ],
                    "Your Value": [
                        f"{result.get('sharpe_ratio', 'N/A')}",
                        f"-{result['max_drawdown_pct']:.2f}%",
                        f"{result['win_rate_pct']:.1f}%",
                        f"{result.get('profit_factor', 'N/A')}",
                        f"{result.get('alpha', 'N/A')}",
                        f"{result.get('beta', 'N/A')}",
                    ],
                }
                st.table(pd.DataFrame(ref_data))

            else:
                st.error(f"Error: {result.get('detail', 'Unknown error')}")
        except requests.exceptions.ConnectionError:
            st.error(
                "Cannot connect to backend. Is the FastAPI server running on port 8000?"
            )
