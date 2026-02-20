import streamlit as st
import requests
import plotly.graph_objects as go
import pandas as pd

API_BASE = "http://localhost:8000/api"

st.title("🔮 Price Direction Prediction")
st.warning("Predictions are probabilistic estimates, NOT guarantees. The model predicts DIRECTION (up/down), not exact prices.")

col1, col2 = st.columns([1, 1])
with col1:
    ticker = st.text_input("Ticker Symbol", value="AAPL")
with col2:
    pred_days = st.slider("Prediction Horizon (days)", 1, 30, 5)

if st.button("🔮 Generate Prediction", type="primary"):
    with st.spinner("Training model with walk-forward validation..."):
        try:
            response = requests.post(
                f"{API_BASE}/predict/run",
                json={"ticker": ticker, "prediction_days": pred_days},
                timeout=120,
            )
            result = response.json()

            if response.status_code == 200:
                # Signal banner
                signal = result["signal"]
                colors = {"BUY": "green", "SELL": "red", "HOLD": "orange"}
                st.markdown(
                    f"### Signal: :{colors.get(signal, 'gray')}[**{signal}**]"
                )

                # Metrics
                m1, m2, m3 = st.columns(3)
                m1.metric("Current Price", f"${result['current_price']:.2f}")
                m2.metric(
                    "Walk-Forward Accuracy",
                    f"{result['walk_forward_score']:.1%}",
                )
                m3.metric(
                    "Model Accuracy",
                    f"{result['model_accuracy']:.1%}",
                )

                # Accuracy context
                if result["walk_forward_score"] < 0.53:
                    st.error(
                        "⚠️ Walk-forward accuracy is below 53%. "
                        "This model has NO meaningful edge. "
                        "Treat predictions as coin flips."
                    )
                elif result["walk_forward_score"] < 0.56:
                    st.warning(
                        "Walk-forward accuracy is marginal. "
                        "Predictions have a slight edge but high uncertainty."
                    )

                # Prediction table
                pred_df = pd.DataFrame(result["predictions"])
                st.dataframe(pred_df, use_container_width=True)

                # SHAP explanations
                st.markdown("### 🧠 Why This Prediction?")
                st.caption(
                    "SHAP values show feature contribution. "
                    "Financial features are correlated — treat as approximate."
                )
                shap_data = result["shap_explanation"]
                for item in shap_data:
                    direction_emoji = "🟢" if item["direction"] == "Bullish" else "🔴"
                    bar_length = min(int(abs(item["shap_impact"]) * 200), 30)
                    bar = "█" * bar_length
                    st.markdown(
                        f"{direction_emoji} **{item['feature']}** "
                        f"(value: {item['value']:.4f}) → "
                        f"`{bar}` {item['shap_impact']:+.4f}"
                    )
            else:
                st.error(f"Error: {result.get('detail', 'Unknown error')}")
        except requests.exceptions.ConnectionError:
            st.error("Cannot connect to backend.")