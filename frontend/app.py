import streamlit as st

st.set_page_config(
    page_title="Stock Prediction Platform",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title(" Stock Prediction Platform")
st.markdown("""
** Disclaimer:** This platform is for educational and research purposes only.
It is NOT financial advice. Past performance does NOT guarantee future results.
All predictions are probabilistic estimates with significant uncertainty.
""")

st.markdown("---")
st.markdown("### Navigate using the sidebar:")
st.markdown("""
- ** Backtest** — Test trading strategies on historical data
- ** Predict** — XGBoost-based directional predictions
- ** Dashboard** — Performance metrics and analysis
- ** Explain** — SHAP-based model explanations
""")