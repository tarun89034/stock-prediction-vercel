import streamlit as st
import requests
import plotly.graph_objects as go
import pandas as pd

API_BASE = "http://localhost:8000/api"

st.title("Explain - SHAP Model Explanations")
st.markdown(
    "Understand **why** the model predicts what it predicts. "
    "SHAP values show each feature's contribution to the prediction."
)

st.warning(
    "Financial features are highly correlated (RSI, MACD, moving averages are all "
    "derived from price). SHAP values should be treated as **approximate explanations**, "
    "not exact causal attributions."
)

# --- Controls ---
col1, col2 = st.columns([1, 1])
with col1:
    ticker = st.text_input("Ticker Symbol", value="AAPL")
with col2:
    pred_days = st.slider("Prediction Horizon (days)", 1, 30, 5)

if st.button("Generate SHAP Explanation", type="primary"):
    with st.spinner("Training model and computing SHAP values..."):
        try:
            response = requests.post(
                f"{API_BASE}/predict/run",
                json={"ticker": ticker, "prediction_days": pred_days},
                timeout=120,
            )
            result = response.json()

            if response.status_code == 200:
                st.markdown("---")

                # --- Signal Summary ---
                signal = result["signal"]
                colors = {"BUY": "green", "SELL": "red", "HOLD": "orange"}
                st.markdown(
                    f"### Prediction Signal: :{colors.get(signal, 'gray')}[**{signal}**]"
                )

                m1, m2 = st.columns(2)
                m1.metric("Current Price", f"${result['current_price']:.2f}")
                m2.metric(
                    "Walk-Forward Accuracy",
                    f"{result['walk_forward_score']:.1%}",
                )

                # --- SHAP Waterfall-style Bar Chart ---
                st.markdown("---")
                st.markdown("## Feature Impact Breakdown")
                st.caption(
                    "Each bar shows how much a feature pushes the prediction "
                    "toward UP (positive/green) or DOWN (negative/red)."
                )

                shap_data = result["shap_explanation"]
                if shap_data:
                    # Sort by absolute impact for display
                    shap_df = pd.DataFrame(shap_data)
                    shap_df = shap_df.sort_values("magnitude", ascending=True)

                    fig = go.Figure()
                    fig.add_trace(
                        go.Bar(
                            y=shap_df["feature"],
                            x=shap_df["shap_impact"],
                            orientation="h",
                            marker_color=[
                                "#00d4aa" if v > 0 else "#ff4444"
                                for v in shap_df["shap_impact"]
                            ],
                            text=[
                                f"{v:+.4f}" for v in shap_df["shap_impact"]
                            ],
                            textposition="outside",
                            hovertemplate=(
                                "<b>%{y}</b><br>"
                                "SHAP Impact: %{x:.4f}<br>"
                                "<extra></extra>"
                            ),
                        )
                    )
                    fig.update_layout(
                        title="SHAP Feature Contributions",
                        xaxis_title="SHAP Value (impact on prediction)",
                        yaxis_title="Feature",
                        template="plotly_dark",
                        height=400,
                        showlegend=False,
                    )
                    fig.add_vline(x=0, line_color="white", line_width=1)
                    st.plotly_chart(fig, use_container_width=True)

                    # --- Detailed Feature Table ---
                    st.markdown("---")
                    st.markdown("## Detailed Feature Values")

                    for item in reversed(shap_data):
                        direction_emoji = (
                            "Green" if item["direction"] == "Bullish" else "Red"
                        )
                        icon = (
                            "+" if item["direction"] == "Bullish" else "-"
                        )

                        bar_length = min(int(abs(item["shap_impact"]) * 200), 30)
                        bar = "|" * max(bar_length, 1)

                        col_a, col_b, col_c = st.columns([2, 3, 1])
                        with col_a:
                            st.markdown(f"**{item['feature']}**")
                        with col_b:
                            st.markdown(
                                f"Value: `{item['value']:.4f}` | "
                                f"Impact: `{item['shap_impact']:+.4f}`"
                            )
                        with col_c:
                            if item["direction"] == "Bullish":
                                st.success(item["direction"])
                            else:
                                st.error(item["direction"])

                    # --- How to Read SHAP ---
                    st.markdown("---")
                    st.markdown("## How to Read SHAP Explanations")
                    st.markdown(
                        """
**Green bars (positive SHAP)** = This feature pushes the prediction toward **UP**.
**Red bars (negative SHAP)** = This feature pushes the prediction toward **DOWN**.

**Bar length** = How much influence this feature has on the prediction.
**Value** = The actual feature value the model observed for the most recent data.

**Key features explained:**
- **RSI** < 30 = oversold (often bullish), > 70 = overbought (often bearish)
- **SMA Ratio** > 1.0 = price above moving average (bullish trend)
- **MACD** positive = upward momentum, negative = downward momentum
- **Volatility** = higher volatility generally increases uncertainty
- **Volume Ratio** > 1.0 = higher than normal trading volume

**Important caveats:**
- These features are correlated. RSI, MACD, and moving averages are all derived from price.
- SHAP values are **approximate**, not exact causal explanations.
- A feature being "bullish" does NOT mean the stock will go up. It means this feature
  *contributes* to a directional lean in the model's probability estimate.
"""
                    )
                else:
                    st.info("No SHAP explanation data available.")

            else:
                st.error(f"Error: {result.get('detail', 'Unknown error')}")
        except requests.exceptions.ConnectionError:
            st.error(
                "Cannot connect to backend. Is the FastAPI server running on port 8000?"
            )
