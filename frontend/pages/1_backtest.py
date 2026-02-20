import streamlit as st
import requests
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd

API_BASE = "http://localhost:8000/api"

st.title("🔄 Backtesting Engine")

# --- Sidebar Controls ---
with st.sidebar:
    st.header("Strategy Parameters")
    ticker = st.text_input("Ticker Symbol", value="AAPL")
    strategy = st.selectbox("Strategy", ["sma_crossover", "rsi", "macd"])
    start_date = st.date_input("Start Date", value=pd.to_datetime("2020-01-01"))
    end_date = st.date_input("End Date", value=pd.to_datetime("2025-01-01"))

    st.markdown("---")
    initial_capital = st.number_input("Initial Capital ($)", value=10000, step=1000)
    slippage = st.slider("Slippage (%)", 0.0, 2.0, 0.1, step=0.05)
    commission = st.slider("Commission (%)", 0.0, 2.0, 0.1, step=0.05)

    st.markdown("---")
    if strategy == "sma_crossover":
        fast_window = st.slider("Fast MA Window", 5, 100, 20)
        slow_window = st.slider("Slow MA Window", 20, 300, 50)
    elif strategy == "rsi":
        rsi_period = st.slider("RSI Period", 5, 50, 14)
        rsi_overbought = st.slider("RSI Overbought", 50, 95, 70)
        rsi_oversold = st.slider("RSI Oversold", 5, 50, 30)

# --- Run Backtest ---
col1, col2 = st.columns([1, 1])
with col1:
    run_backtest = st.button("🚀 Run Backtest", type="primary", use_container_width=True)
with col2:
    run_sweep = st.button("🔍 Parameter Sweep", use_container_width=True)

if run_backtest:
    with st.spinner("Running backtest... (this may take a few seconds)"):
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
            response = requests.post(f"{API_BASE}/backtest/run", json=payload, timeout=60)
            result = response.json()

            if response.status_code == 200:
                # --- Key Metrics ---
                st.markdown("## Results")
                m1, m2, m3, m4, m5 = st.columns(5)
                m1.metric("Final Capital", f"${result['final_capital']:,.2f}",
                          f"{result['total_return_pct']:+.2f}%")
                m2.metric("Sharpe Ratio", f"{result['sharpe_ratio'] or 'N/A'}")
                m3.metric("Max Drawdown", f"{result['max_drawdown_pct']:.2f}%")
                m4.metric("Win Rate", f"{result['win_rate_pct']:.1f}%")
                m5.metric("Total Trades", result["total_trades"])

                if result.get("alpha") is not None:
                    a1, a2, a3 = st.columns(3)
                    a1.metric("Alpha (annualized)", f"{result['alpha']:.4f}")
                    a2.metric("Beta", f"{result['beta']:.4f}")
                    a3.metric("Profit Factor", f"{result.get('profit_factor', 'N/A')}")

                # --- Equity Curve Chart ---
                equity_df = pd.DataFrame(result["equity_curve"])
                equity_df["date"] = pd.to_datetime(equity_df["date"])

                fig = make_subplots(
                    rows=2, cols=1, shared_xaxes=True,
                    vertical_spacing=0.05,
                    subplot_titles=("Portfolio Value", "Drawdown"),
                    row_heights=[0.7, 0.3],
                )
                fig.add_trace(
                    go.Scatter(
                        x=equity_df["date"], y=equity_df["equity"],
                        mode="lines", name="Portfolio",
                        line=dict(color="#00d4aa", width=2),
                        fill="tozeroy", fillcolor="rgba(0,212,170,0.1)",
                    ),
                    row=1, col=1,
                )
                # Starting capital reference line
                fig.add_hline(
                    y=initial_capital, line_dash="dash",
                    line_color="gray", row=1, col=1,
                    annotation_text=f"Starting: ${initial_capital:,.0f}",
                )

                if result["drawdown_curve"]:
                    dd_df = pd.DataFrame(result["drawdown_curve"])
                    dd_df["date"] = pd.to_datetime(dd_df["date"])
                    fig.add_trace(
                        go.Scatter(
                            x=dd_df["date"],
                            y=dd_df["drawdown"].apply(lambda x: x * -100),
                            mode="lines", name="Drawdown %",
                            line=dict(color="#ff4444", width=1),
                            fill="tozeroy", fillcolor="rgba(255,68,68,0.2)",
                        ),
                        row=2, col=1,
                    )

                fig.update_layout(height=600, template="plotly_dark", showlegend=True)
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.error(f"Error: {result.get('detail', 'Unknown error')}")
        except requests.exceptions.ConnectionError:
            st.error("Cannot connect to backend. Is the FastAPI server running?")

if run_sweep:
    with st.spinner("Running parameter sweep... this may take 30-60 seconds"):
        payload = {
            "ticker": ticker,
            "start_date": str(start_date),
            "end_date": str(end_date),
            "strategy": strategy,
            "fast_window_range": list(range(10, 60, 10)),
            "slow_window_range": list(range(50, 250, 25)),
            "initial_capital": initial_capital,
            "slippage_pct": slippage,
            "commission_pct": commission,
        }
        try:
            response = requests.post(f"{API_BASE}/backtest/sweep", json=payload, timeout=120)
            result = response.json()

            if response.status_code == 200:
                st.markdown(f"## Parameter Sweep Results ({result['combinations_tested']} combinations)")
                sweep_df = pd.DataFrame(result["results"])
                st.dataframe(
                    sweep_df.style.background_gradient(
                        subset=["sharpe_ratio"], cmap="RdYlGn"
                    ),
                    use_container_width=True,
                )

                # Heatmap
                if strategy == "sma_crossover" and len(sweep_df) > 1:
                    pivot = sweep_df.pivot_table(
                        index="slow_window", columns="fast_window",
                        values="sharpe_ratio",
                    )
                    fig = go.Figure(data=go.Heatmap(
                        z=pivot.values,
                        x=pivot.columns.tolist(),
                        y=pivot.index.tolist(),
                        colorscale="RdYlGn",
                        text=pivot.values.round(2),
                        texttemplate="%{text}",
                    ))
                    fig.update_layout(
                        title="Sharpe Ratio Heatmap",
                        xaxis_title="Fast Window",
                        yaxis_title="Slow Window",
                        template="plotly_dark",
                    )
                    st.plotly_chart(fig, use_container_width=True)
            else:
                st.error(f"Error: {result.get('detail', 'Unknown error')}")
        except requests.exceptions.ConnectionError:
            st.error("Cannot connect to backend.")