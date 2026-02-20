# 📈 Stock Prediction & Backtesting Platform

A production-ready quantitative finance platform that combines **strategy backtesting**, **ML-based price direction prediction**, and **explainable AI** — built entirely with free tools and APIs.

> **⚠️ Disclaimer:** This platform is for **educational and research purposes only**. It is NOT financial advice. Past performance does NOT guarantee future results. All predictions are probabilistic estimates with significant uncertainty. Never invest money you cannot afford to lose based on any model's output.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Local Setup](#local-setup)
  - [Docker Setup](#docker-setup)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
  - [Backtesting Engine](#1-backtesting-engine)
  - [Parameter Optimization](#2-parameter-optimization)
  - [Price Direction Prediction](#3-price-direction-prediction)
  - [SHAP Explanations](#4-shap-explanations)
  - [Performance Metrics](#5-performance-metrics)
- [API Reference](#api-reference)
- [How It Works (Technical Deep Dive)](#how-it-works)
  - [Backtesting Pipeline](#backtesting-pipeline)
  - [Feature Engineering](#feature-engineering)
  - [Walk-Forward Validation](#walk-forward-validation)
  - [SHAP Explainability](#shap-explainability)
- [Known Limitations](#known-limitations)
- [Phase 2 Roadmap](#phase-2-roadmap)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Most "stock prediction" apps show a single price forecast with no context, no risk metrics, and no way to validate whether the model actually works. This platform is different.

**What this platform does:**

1. **Backtests trading strategies** on historical data with realistic transaction costs (slippage + commission), so you see what would have *actually* happened — not a fantasy scenario.
2. **Predicts price direction** (UP/DOWN, not exact prices) using XGBoost, validated with walk-forward testing — the only honest way to evaluate a time-series model.
3. **Explains predictions** using SHAP values, so you understand *why* the model says what it says, not just *what* it says.
4. **Calculates real risk metrics** — Sharpe Ratio, Maximum Drawdown, Alpha, Beta, Win Rate, Profit Factor — so you can evaluate strategies like a quantitative analyst, not a gambler.

**What this platform does NOT do:**

- Guarantee profits (nothing can)
- Predict exact future prices (impossible with any meaningful accuracy)
- Replace professional financial advice
- Work as a high-frequency trading system

---

## Features

### Core Features (Phase 1 — Current)

| Feature | Description |
|---|---|
| **Vectorized Backtesting** | Simulate trades using Vectorbt with SMA Crossover, RSI, and MACD strategies. See Starting Capital vs. Ending Capital on interactive charts. |
| **Transaction Cost Modeling** | Every backtest includes configurable slippage and commission parameters. A strategy that looks profitable on paper often fails with real trading fees. |
| **Parameter Optimization** | Sweep across parameter ranges (e.g., MA windows from 10 to 200) and see a heatmap of Sharpe Ratios to find optimal configurations. |
| **Quantitative Metrics Dashboard** | Sharpe Ratio, Maximum Drawdown, Win/Loss Rate, Profit Factor, Alpha, and Beta — calculated for every backtest. |
| **XGBoost Direction Prediction** | Predicts whether a stock will go UP or DOWN (not exact prices) using engineered technical features. |
| **Walk-Forward Validation** | The model is validated using expanding-window walk-forward splits — the gold standard for time-series model evaluation. No look-ahead bias. |
| **SHAP Explainability** | Every prediction comes with a breakdown of which features drove the decision and in which direction. No more black-box predictions. |
| **Interactive Frontend** | Streamlit-based UI with Plotly charts — equity curves, drawdown plots, parameter heatmaps, and SHAP feature impact bars. |
| **Dockerized Deployment** | One-command deployment with `docker compose up`. Backend + frontend + database, all containerized. |

### Planned Features (Phase 2)

| Feature | Description |
|---|---|
| Finnhub Real-Time Data | Live price streaming replacing yfinance for real-time use cases |
| SEC Insider Trading Alerts | Form 4 filings showing CEO/insider buy/sell activity |
| React Frontend | Production-grade SPA replacing Streamlit |
| Redis Caching | Sub-second response times for repeated queries |
| WebSocket Live Updates | Push-based price updates without page refresh |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (Streamlit)                  │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Backtest   │ │ Predict    │ │Dashboard │ │ Explain │ │
│  │ Page       │ │ Page       │ │ Page     │ │ Page    │ │
│  └─────┬──────┘ └─────┬──────┘ └────┬─────┘ └────┬────┘ │
│        │              │             │             │       │
└────────┼──────────────┼─────────────┼─────────────┼──────┘
         │    HTTP/REST  │             │             │
         ▼              ▼             ▼             ▼
┌──────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                       │
│                                                          │
│  ┌─────────────────────────────────────────────────────��� │
│  │                   API Layer                         │ │
│  │  /api/backtest/*  /api/predict/*  /api/data/*       │ │
│  └──────────┬────────────┬──────────────┬──────────────┘ │
│             │            │              │                 │
│  ┌──────────▼──┐ ┌───────▼────┐ ┌──────▼───────┐        │
│  │ Backtest    │ │ Predictor  │ │ Data Fetcher │        │
│  │ Engine      │ │ Service    │ │ Service      │        │
│  │ (Vectorbt)  │ │ (XGBoost)  │ │ (yfinance)   │        │
│  └─────────────┘ └──────┬─────┘ └──────────────┘        │
│                         │                                │
│                  ┌──────▼─────┐                          │
│                  │  SHAP      │                          │
│                  │  Explainer │                          │
│                  └────────────┘                          │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              SQLite / PostgreSQL                     │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Yahoo Finance   │
│  (Historical     │
│   Data via       │
│   yfinance)      │
└──────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Backend Framework** | FastAPI | Async, fast, auto-generates OpenAPI docs, built-in validation via Pydantic |
| **ML Model** | XGBoost | Best-in-class for tabular data, fast training, handles missing values natively |
| **Backtesting** | Vectorbt | Vectorized (NumPy-based), orders of magnitude faster than event-driven engines like Backtrader |
| **Explainability** | SHAP (TreeExplainer) | Exact Shapley values for tree-based models, fast and theoretically grounded |
| **Performance Metrics** | quantstats | One-line calculation of Sharpe, Drawdown, Alpha, Beta, and 30+ other metrics |
| **Data Source** | yfinance | Free historical OHLCV data (suitable for backtesting, NOT for live trading) |
| **Frontend** | Streamlit + Plotly | Rapid prototyping, interactive charts, zero JavaScript required |
| **Database** | SQLite (MVP) / PostgreSQL (production) | Zero-config for development, easy migration path to production |
| **Containerization** | Docker + Docker Compose | Reproducible builds, one-command deployment |
| **Language** | Python 3.11+ | Ecosystem dominance in ML/finance, async support |

---

## Project Structure

```
stock-prediction-platform/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI application entry point
│   │   ├── config.py                # Environment variables & settings
│   │   │
│   │   ├── models/
│   │   │   ├── database.py          # SQLAlchemy async engine & session
│   │   │   └── schemas.py           # Pydantic request/response models
│   │   │
│   │   ├── services/
│   │   │   ├── data_fetcher.py      # yfinance wrapper for historical data
│   │   │   ├── backtester.py        # Vectorbt backtesting engine
│   │   │   ├── predictor.py         # XGBoost prediction + walk-forward validation
│   │   │   ├── explainer.py         # SHAP-based model explanations
│   │   │   └── metrics.py           # quantstats performance calculations
│   │   │
│   │   ├── api/
│   │   │   ├── routes_data.py       # Market data endpoints
│   │   │   ├── routes_backtest.py   # Backtesting endpoints
│   │   │   ├── routes_predict.py    # Prediction endpoints
│   │   │   └── routes_metrics.py    # Metrics endpoints
│   │   │
│   │   └── utils/
│   │       ├── cache.py             # In-memory / Redis caching (Phase 2)
│   │       └── validators.py        # Input validation helpers
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app.py                       # Streamlit main page
│   ├── pages/
│   │   ├── 1_backtest.py            # Backtesting UI
│   │   ├── 2_predict.py             # Prediction UI
│   │   ├── 3_dashboard.py           # Performance metrics dashboard
│   │   └── 4_explain.py             # SHAP explanations UI
│   ├── requirements.txt
│   └── Dockerfile
│
├── tests/
│   ├── test_data_fetcher.py
│   ├── test_backtester.py
│   ├── test_predictor.py
│   └── test_explainer.py
│
├── docker-compose.yml
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

---

## Prerequisites

- **Python 3.11+** (3.11 recommended; 3.12+ may have compatibility issues with some ML libraries)
- **pip** (Python package manager)
- **Docker & Docker Compose** (optional, for containerized deployment)
- **Git**
- **~2 GB disk space** (for Python ML dependencies)
- **4 GB+ RAM** (XGBoost + Vectorbt can be memory-intensive on large datasets)

---

## Installation

### Local Setup

**1. Clone the repository:**

```bash
git clone https://github.com/yourusername/stock-prediction-platform.git
cd stock-prediction-platform
```

**2. Set up the backend:**

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**3. Set up the frontend:**

```bash
cd ../frontend

# Create separate virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

pip install -r requirements.txt
```

**4. Configure environment variables:**

```bash
cd ..
cp .env.example .env
# Edit .env with your settings (defaults work for local development)
```

**5. Start the backend:**

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

You should see:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Started reloader process
```

Verify at: [http://localhost:8000/health](http://localhost:8000/health) → `{"status": "healthy"}`

API docs at: [http://localhost:8000/docs](http://localhost:8000/docs) (auto-generated Swagger UI)

**6. Start the frontend (in a new terminal):**

```bash
cd frontend
source venv/bin/activate
streamlit run app.py --server.port 8501
```

Open [http://localhost:8501](http://localhost:8501) in your browser.

### Docker Setup

**One command to run everything:**

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (Streamlit) | [http://localhost:8501](http://localhost:8501) |
| Backend API | [http://localhost:8000](http://localhost:8000) |
| API Docs (Swagger) | [http://localhost:8000/docs](http://localhost:8000/docs) |

**To stop:**

```bash
docker compose down
```

**To rebuild after code changes:**

```bash
docker compose up --build
```

---

## Configuration

Create a `.env` file in the project root (or copy `.env.example`):

```env
# Database
DATABASE_URL=sqlite+aiosqlite:///./stock_platform.db
# For PostgreSQL (production):
# DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/stockdb

# Backtesting Defaults
DEFAULT_SLIPPAGE_PCT=0.1
DEFAULT_COMMISSION_PCT=0.1
MAX_BACKTEST_YEARS=10

# Cache
CACHE_TTL_SECONDS=3600

# Phase 2 (not needed for MVP)
# FINNHUB_API_KEY=your_key_here
# REDIS_URL=redis://localhost:6379
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./stock_platform.db` | Database connection string. SQLite for dev, PostgreSQL for production. |
| `DEFAULT_SLIPPAGE_PCT` | `0.1` | Default slippage percentage per trade (0.1 = 0.1%). |
| `DEFAULT_COMMISSION_PCT` | `0.1` | Default commission percentage per trade. |
| `MAX_BACKTEST_YEARS` | `10` | Maximum years of historical data allowed in a single backtest. |
| `CACHE_TTL_SECONDS` | `3600` | How long to cache API responses (in seconds). |

---

## Usage Guide

### 1. Backtesting Engine

The backtesting engine simulates a trading strategy on historical data to show what **would have happened** if you had followed it — including realistic trading costs.

**Available Strategies:**

| Strategy | Logic | Parameters |
|---|---|---|
| **SMA Crossover** | Buy when fast MA crosses above slow MA; sell when it crosses below | `fast_window` (default: 20), `slow_window` (default: 50) |
| **RSI** | Buy when RSI drops below oversold threshold; sell when it rises above overbought | `rsi_period` (default: 14), `rsi_oversold` (default: 30), `rsi_overbought` (default: 70) |
| **MACD** | Buy when MACD line crosses above signal line; sell on crossunder | Uses default MACD parameters (12, 26, 9) |

**How to run a backtest via UI:**

1. Navigate to the **🔄 Backtest** page in the sidebar
2. Enter a ticker symbol (e.g., `AAPL`, `MSFT`, `TSLA`)
3. Select a strategy and date range
4. Adjust slippage and commission (default 0.1% each is realistic for retail)
5. Click **🚀 Run Backtest**

**What you'll see:**

- **Equity Curve** — your portfolio value over time vs. starting capital
- **Drawdown Chart** — how much your portfolio declined from its peak at any point
- **Key Metrics** — final capital, total return %, Sharpe Ratio, max drawdown, win rate, total trades
- **Alpha & Beta** — strategy performance relative to S&P 500 (SPY benchmark)

**Via API:**

```bash
curl -X POST http://localhost:8000/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "start_date": "2020-01-01",
    "end_date": "2025-01-01",
    "strategy": "sma_crossover",
    "fast_window": 20,
    "slow_window": 50,
    "initial_capital": 10000,
    "slippage_pct": 0.1,
    "commission_pct": 0.1
  }'
```

### 2. Parameter Optimization

Instead of guessing the best MA window, sweep across combinations and see which works best.

**How to run:**

1. On the **🔄 Backtest** page, click **🔍 Parameter Sweep**
2. The system tests all combinations of fast windows (10, 20, 30, 40, 50) × slow windows (50, 75, 100, 125, 150, 175, 200)
3. Results are displayed as a **ranked table** (sorted by Sharpe Ratio) and a **heatmap**

**Important caveats:**

- ⚠️ **Overfitting risk**: The "best" parameters on historical data often perform poorly going forward. The best Sharpe on the heatmap is NOT a prediction of future performance.
- ⚠️ **Maximum 100 combinations** per sweep to prevent server overload.
- ⚠️ Sweeps are **not instant** — expect 10-60 seconds depending on date range and number of combinations.

**Via API:**

```bash
curl -X POST http://localhost:8000/api/backtest/sweep \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "start_date": "2020-01-01",
    "end_date": "2025-01-01",
    "strategy": "sma_crossover",
    "fast_window_range": [10, 20, 30, 50],
    "slow_window_range": [50, 100, 150, 200],
    "initial_capital": 10000,
    "slippage_pct": 0.1,
    "commission_pct": 0.1
  }'
```

### 3. Price Direction Prediction

The predictor uses XGBoost to forecast whether a stock will go **UP or DOWN** over the next N days.

**Critical design decisions:**

- We predict **direction**, not exact price. Predicting exact prices is unreliable and gives false confidence.
- The model is validated with **walk-forward testing** — if the walk-forward accuracy is below 53%, the UI displays a warning that the model has no meaningful edge.
- **Confidence decays** over the prediction horizon. A 1-day prediction is far more reliable than a 30-day prediction.

**How to use:**

1. Navigate to the **🔮 Predict** page
2. Enter a ticker and select prediction horizon (1-30 days)
3. Click **🔮 Generate Prediction**

**Output includes:**

- **Signal**: BUY / SELL / HOLD (based on average predicted probability)
- **Walk-Forward Accuracy**: How well the model performed on unseen data
- **Per-day predictions**: Direction probability with decaying confidence
- **SHAP explanation**: Which features drove the prediction (see below)

**Via API:**

```bash
curl -X POST http://localhost:8000/api/predict/run \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "prediction_days": 5
  }'
```

### 4. SHAP Explanations

Every prediction comes with a SHAP (SHapley Additive exPlanations) breakdown showing **why** the model made its prediction.

**Example output:**

```
🟢 Sma 20 Ratio (value: 1.0234) → ████████ +0.1523   (Bullish)
🟢 Rsi (value: 32.45)            → ██████   +0.0987   (Bullish — oversold)
🔴 Return 5D (value: -0.034)     → █████    -0.0876   (Bearish — recent decline)
🟢 Macd (value: 0.89)            → ████     +0.0654   (Bullish — positive momentum)
🔴 Volatility 20D (value: 0.028) → ███      -0.0432   (Bearish — high volatility)
```

**How to read this:**

- **Green 🟢** = this feature pushes the prediction toward UP
- **Red 🔴** = this feature pushes the prediction toward DOWN
- **Bar length** = magnitude of impact
- **Value** = the actual feature value the model saw

**Caveat:** Financial features are highly correlated (RSI, MACD, and moving averages are all derived from price). SHAP values should be treated as **approximate explanations**, not exact causal attributions.

### 5. Performance Metrics

Every backtest automatically calculates:

| Metric | Formula / Meaning | What It Tells You |
|---|---|---|
| **Sharpe Ratio** | (Return - Risk-Free Rate) / Std Dev of Returns | Risk-adjusted return. > 1.0 is decent, > 2.0 is excellent, < 0 means you're losing money. |
| **Maximum Drawdown** | Largest peak-to-trough decline (%) | The worst-case scenario. "At some point, your $10K portfolio would have dropped to $X." |
| **Win Rate** | Winning trades / Total trades (%) | What percentage of trades made money. Note: win rate alone is meaningless without knowing the average win vs. average loss size. |
| **Profit Factor** | Gross Profits / Gross Losses | How much you make per dollar lost. > 1.0 means profitable. > 2.0 is strong. |
| **Alpha** | Strategy excess return vs. benchmark (annualized) | Your strategy's "edge" over just buying and holding SPY. Positive alpha = you're beating the market. |
| **Beta** | Strategy volatility relative to market | Beta = 1.0 means you move with the market. Beta > 1.0 = more volatile. Beta < 1.0 = less volatile. |
| **Total Return** | (Final Capital - Initial Capital) / Initial Capital (%) | Simple percentage gain/loss. |

---

## API Reference

Once the backend is running, full interactive API docs are available at:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/data/price/{ticker}` | Get current price for a ticker |
| `GET` | `/api/data/validate/{ticker}` | Check if a ticker symbol is valid |
| `GET` | `/api/data/historical/{ticker}?start=YYYY-MM-DD&end=YYYY-MM-DD` | Get historical OHLCV data |
| `POST` | `/api/backtest/run` | Run a single backtest |
| `POST` | `/api/backtest/sweep` | Run parameter optimization sweep |
| `POST` | `/api/predict/run` | Generate price direction prediction |
| `GET` | `/api/metrics/health` | List available metrics |

---

## How It Works

### Backtesting Pipeline

```
User Input (ticker, strategy, params, costs)
         │
         ▼
┌─────────────────────┐
│ 1. Fetch Historical  │  ← yfinance: OHLCV data
│    Data              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Generate Signals  │  ← Strategy logic (SMA/RSI/MACD)
│    (entries & exits) │     produces boolean Series
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. Simulate Portfolio│  ← Vectorbt: from_signals()
│    with Costs        │     includes slippage, commission,
│                      │     and 5% stop-loss
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 4. Calculate Metrics │  ← Sharpe, Drawdown, Win Rate,
│                      │     Alpha, Beta, Profit Factor
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 5. Return Results    │  ← Equity curve, drawdown curve,
│    + Chart Data      │     trade log, all metrics
└─────────────────────┘
```

### Feature Engineering

The XGBoost model uses **10 engineered features**, all derived from OHLCV data. Every feature is **lagged by 1 day** to prevent look-ahead bias:

| Feature | Description | Why It Matters |
|---|---|---|
| `return_1d` | 1-day return (yesterday) | Short-term momentum |
| `return_5d` | 5-day return | Weekly trend |
| `return_20d` | 20-day return | Monthly trend |
| `volatility_20d` | 20-day rolling standard deviation | Risk level |
| `sma_20_ratio` | Price / 20-day SMA | Mean reversion signal |
| `sma_50_ratio` | Price / 50-day SMA | Trend following signal |
| `rsi` | 14-day Relative Strength Index | Overbought/oversold |
| `volume_ratio` | Volume / 20-day average volume | Unusual activity |
| `macd` | MACD line value | Momentum |
| `macd_signal` | MACD signal line | Momentum confirmation |

**Target variable:** Binary — did the stock go UP (1) or DOWN (0) the next day?

### Walk-Forward Validation

Standard train/test splits don't work for time-series data because they allow **information leakage from the future**. Walk-forward validation solves this:

```
Data: [====================================================]
       2022        2023        2024        2025

Split 1: Train [========]  Test [===]
Split 2: Train [============]  Test [===]
Split 3: Train [================]  Test [===]
Split 4: Train [====================]  Test [===]
Split 5: Train [========================]  Test [===]
Split 6: Train [============================]  Test [===]

Final accuracy = average accuracy across all 6 test periods
```

Each split trains on an **expanding window** of past data and tests on the **next unseen chunk**. This mimics how the model would perform in real-time deployment.

**Interpreting walk-forward accuracy:**

| Accuracy | Interpretation |
|---|---|
| < 50% | Model is **worse than random**. Something is wrong. |
| 50-53% | **No meaningful edge.** Equivalent to coin flipping. |
| 53-56% | **Marginal edge.** Might be profitable after costs, might not. |
| 56-60% | **Decent edge.** Potentially useful signal. |
| > 60% | **Suspicious.** Likely overfitting or data leakage. Investigate. |

### SHAP Explainability

SHAP (SHapley Additive exPlanations) uses game theory to assign each feature an "importance score" for a specific prediction:

```
Base prediction (average): 50% chance UP
         │
         ├── RSI = 28 (oversold)          → +8%  (pushes toward UP)
         ├── SMA 20 Ratio = 1.02          → +5%  (above average, bullish)
         ├── MACD = positive               → +3%  (momentum bullish)
         ├── 5-day return = -4%            → -4%  (recent decline, bearish)
         ├── Volatility = high             → -2%  (uncertainty, bearish)
         │
Final prediction: 60% chance UP → Signal: BUY
```

---

## Known Limitations

These are not bugs — they are inherent constraints you should understand:

| Limitation | Impact | Mitigation |
|---|---|---|
| **yfinance is unofficial** | May break if Yahoo changes their website. Not suitable for production data feeds. | Phase 2 adds Finnhub as a proper API source. |
| **Prediction accuracy is modest** | 53-56% directional accuracy is typical. This is an **extremely difficult** problem. | Walk-forward validation gives honest accuracy estimates. UI warns when accuracy is too low. |
| **SHAP values are approximate** | Correlated features (RSI, MACD, MAs) make SHAP attributions unstable. | Displayed with caveats. Not presented as ground truth. |
| **No live trading integration** | This is a research/analysis tool, not a trading bot. | By design. Connecting to a broker adds massive liability and complexity. |
| **Single-asset backtesting only** | Cannot test portfolio-level strategies (e.g., pairs trading, sector rotation). | Phase 3 consideration. |
| **Vectorbt API instability** | Vectorbt's API changes between versions. Some method calls may need adjustment. | Pin version in requirements.txt. Test interactively after install. |
| **Free data limitations** | yfinance has no guaranteed uptime or rate limits. Historical data only. | Acceptable for MVP. Finnhub in Phase 2 for real-time. |
| **No user authentication** | Anyone with the URL can access the platform. | Phase 2 adds auth. For now, don't deploy publicly with sensitive data. |

---

## Phase 2 Roadmap

Only start Phase 2 after Phase 1 is **deployed, stable, and has users**.

| Feature | Priority | Estimated Effort | Dependency |
|---|---|---|---|
| **Finnhub Integration** | High | 2-3 days | Free API key from finnhub.io |
| **SEC Insider Alerts** | High | 2-3 days | Finnhub API (included in free tier) |
| **Redis Caching** | Medium | 1-2 days | Upstash free tier or local Redis |
| **User Authentication** | Medium | 2-3 days | FastAPI + JWT or Auth0 free tier |
| **React Frontend** | Medium | 2-3 weeks | Significant rewrite |
| **WebSocket Live Prices** | Low | 3-4 days | Finnhub WebSocket + FastAPI WebSocket |
| **Rate Limiting** | Medium | 1 day | Required before public deployment |
| **PostgreSQL Migration** | Low | 1 day | Supabase free tier |

---

## Troubleshooting

### Backend won't start

```bash
# Check Python version (need 3.11+)
python --version

# If dependency conflicts, try:
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

### Vectorbt import errors

```bash
# Vectorbt has heavy dependencies. If it fails:
pip install numpy==1.26.4  # Install NumPy first
pip install vectorbt       # Then vectorbt
```

### "No data returned for TICKER"

- Check if the ticker symbol is valid (e.g., `AAPL` not `Apple`)
- yfinance may be temporarily down — wait and retry
- Some tickers (OTC, international) have limited data availability

### SHAP computation is slow

- SHAP TreeExplainer is fast for XGBoost, but can be slow with many features on large datasets
- The explainer only processes the **last row** (most recent prediction), which should be fast
- If still slow, reduce the training data window in `predictor.py`

### Docker build fails

```bash
# Clear Docker cache and rebuild
docker compose down
docker system prune -f
docker compose up --build
```

### Port already in use

```bash
# Find and kill the process using port 8000 or 8501
# On macOS/Linux:
lsof -ti:8000 | xargs kill -9
lsof -ti:8501 | xargs kill -9
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and test locally
4. Ensure code follows existing patterns and includes docstrings
5. Submit a pull request with a clear description of changes

**Code standards:**

- Python: Follow PEP 8, use type hints, write docstrings
- Every service method should handle exceptions gracefully
- No hardcoded credentials or API keys — use environment variables
- New features must include at least basic tests

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Vectorbt](https://github.com/polakowo/vectorbt) — Vectorized backtesting engine
- [XGBoost](https://github.com/dmlc/xgboost) — Gradient boosting framework
- [SHAP](https://github.com/shap/shap) — Model explainability
- [yfinance](https://github.com/ranaroussi/yfinance) — Yahoo Finance data
- [FastAPI](https://github.com/tiangolo/fastapi) — Modern Python web framework
- [Streamlit](https://github.com/streamlit/streamlit) — Data app framework
- [quantstats](https://github.com/ranaroussi/quantstats) — Portfolio analytics

---

> **Remember:** No model can predict the stock market with certainty. This platform is a tool for learning, research, and analysis — not a money-printing machine. Trade responsibly.