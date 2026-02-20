import type { BacktestResult, PredictionResult, ParameterSweepResult } from "./types"

// Sparkline data for market indices
function generateSparkline(start: number, volatility: number, points = 30) {
  const data: number[] = [start]
  for (let i = 1; i < points; i++) {
    data.push(data[i - 1] + (Math.random() - 0.48) * volatility)
  }
  return data
}

export const marketIndices = [
  {
    name: "S&P 500",
    symbol: "SPX",
    value: 5234.18,
    change: 28.45,
    changePct: 0.55,
    sparkline: generateSparkline(5100, 30),
  },
  {
    name: "NASDAQ",
    symbol: "IXIC",
    value: 16742.39,
    change: -45.22,
    changePct: -0.27,
    sparkline: generateSparkline(16500, 80),
  },
  {
    name: "DOW",
    symbol: "DJI",
    value: 39282.33,
    change: 156.87,
    changePct: 0.4,
    sparkline: generateSparkline(38800, 200),
  },
  {
    name: "VIX",
    symbol: "VIX",
    value: 14.32,
    change: -0.78,
    changePct: -5.16,
    sparkline: generateSparkline(15, 0.5),
  },
  {
    name: "Russell 2000",
    symbol: "RUT",
    value: 2084.55,
    change: 12.33,
    changePct: 0.59,
    sparkline: generateSparkline(2040, 15),
  },
]

// Generate mock equity curve
function generateEquityCurve(days: number, initialCapital: number, returnPct: number) {
  const curve: Array<{ date: string; equity: number }> = []
  const drawdownCurve: Array<{ date: string; drawdown: number }> = []
  let equity = initialCapital
  let peak = initialCapital
  const dailyReturn = returnPct / 100 / days

  const startDate = new Date("2024-01-02")
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    if (date.getDay() === 0 || date.getDay() === 6) continue

    equity = equity * (1 + dailyReturn + (Math.random() - 0.48) * 0.015)
    peak = Math.max(peak, equity)
    const drawdown = ((equity - peak) / peak) * 100

    curve.push({
      date: date.toISOString().split("T")[0],
      equity: Math.round(equity * 100) / 100,
    })
    drawdownCurve.push({
      date: date.toISOString().split("T")[0],
      drawdown: Math.round(drawdown * 100) / 100,
    })
  }
  return { curve, drawdownCurve }
}

const { curve, drawdownCurve } = generateEquityCurve(365, 10000, 24.5)

export const mockBacktestResult: BacktestResult = {
  ticker: "AAPL",
  strategy: "sma_crossover",
  initial_capital: 10000,
  final_capital: 12450.32,
  total_return_pct: 24.5,
  sharpe_ratio: 1.24,
  max_drawdown_pct: -15.3,
  win_rate_pct: 58.3,
  total_trades: 24,
  profit_factor: 1.87,
  alpha: 0.0832,
  beta: 0.92,
  equity_curve: curve,
  drawdown_curve: drawdownCurve,
  trades: Array.from({ length: 24 }, (_, i) => {
    const entryDate = new Date("2024-01-15")
    entryDate.setDate(entryDate.getDate() + i * 15)
    const exitDate = new Date(entryDate)
    exitDate.setDate(exitDate.getDate() + Math.floor(Math.random() * 10) + 2)
    const entryPrice = 170 + Math.random() * 30
    const pnlPct = (Math.random() - 0.4) * 10
    const exitPrice = entryPrice * (1 + pnlPct / 100)
    return {
      id: i + 1,
      entry_date: entryDate.toISOString().split("T")[0],
      exit_date: exitDate.toISOString().split("T")[0],
      direction: "Long",
      entry_price: Math.round(entryPrice * 100) / 100,
      exit_price: Math.round(exitPrice * 100) / 100,
      pnl: Math.round((exitPrice - entryPrice) * 50 * 100) / 100,
      pnl_pct: Math.round(pnlPct * 100) / 100,
      duration: Math.floor(Math.random() * 10) + 2,
    }
  }),
}

export const mockPredictionResult: PredictionResult = {
  ticker: "AAPL",
  current_price: 182.52,
  predictions: [
    { date: "2026-02-21", predicted_direction: 0.62, confidence: 0.62, label: "UP", disclaimer: "Short-term prediction" },
    { date: "2026-02-22", predicted_direction: 0.58, confidence: 0.58, label: "UP", disclaimer: "Short-term prediction" },
    { date: "2026-02-23", predicted_direction: 0.55, confidence: 0.55, label: "UP", disclaimer: "Medium-term prediction" },
    { date: "2026-02-24", predicted_direction: 0.47, confidence: 0.47, label: "DOWN", disclaimer: "Medium-term prediction" },
    { date: "2026-02-25", predicted_direction: 0.52, confidence: 0.52, label: "UP", disclaimer: "Medium-term prediction" },
  ],
  signal: "BUY",
  shap_explanation: [
    { feature: "RSI (14)", raw_name: "rsi_14", value: 32.4, shap_impact: 0.15, direction: "Bullish", magnitude: 0.15 },
    { feature: "SMA 20 Ratio", raw_name: "sma_20_ratio", value: 1.02, shap_impact: 0.12, direction: "Bullish", magnitude: 0.12 },
    { feature: "Volume Change", raw_name: "volume_change", value: 1.35, shap_impact: 0.08, direction: "Bullish", magnitude: 0.08 },
    { feature: "Volatility 20d", raw_name: "volatility_20d", value: 0.28, shap_impact: -0.06, direction: "Bearish", magnitude: 0.06 },
    { feature: "MACD Signal", raw_name: "macd_signal", value: -0.5, shap_impact: -0.04, direction: "Bearish", magnitude: 0.04 },
    { feature: "Bollinger %B", raw_name: "bollinger_pct_b", value: 0.35, shap_impact: 0.03, direction: "Bullish", magnitude: 0.03 },
  ],
  model_accuracy: 57.2,
  walk_forward_score: 54.8,
}

export const mockSweepResult: ParameterSweepResult = {
  ticker: "AAPL",
  strategy: "sma_crossover",
  combinations_tested: 16,
  results: [
    { fast_window: 10, slow_window: 50, total_return_pct: 28.5, sharpe_ratio: 1.45, max_drawdown_pct: -12.3, win_rate_pct: 62.1, total_trades: 18 },
    { fast_window: 10, slow_window: 100, total_return_pct: 22.3, sharpe_ratio: 1.32, max_drawdown_pct: -14.1, win_rate_pct: 58.4, total_trades: 12 },
    { fast_window: 10, slow_window: 150, total_return_pct: 18.7, sharpe_ratio: 1.18, max_drawdown_pct: -16.2, win_rate_pct: 55.6, total_trades: 8 },
    { fast_window: 10, slow_window: 200, total_return_pct: 15.2, sharpe_ratio: 0.95, max_drawdown_pct: -18.5, win_rate_pct: 52.3, total_trades: 6 },
    { fast_window: 20, slow_window: 50, total_return_pct: 24.5, sharpe_ratio: 1.24, max_drawdown_pct: -15.3, win_rate_pct: 58.3, total_trades: 24 },
    { fast_window: 20, slow_window: 100, total_return_pct: 20.1, sharpe_ratio: 1.15, max_drawdown_pct: -13.8, win_rate_pct: 56.7, total_trades: 16 },
    { fast_window: 20, slow_window: 150, total_return_pct: 16.8, sharpe_ratio: 1.02, max_drawdown_pct: -17.1, win_rate_pct: 54.2, total_trades: 10 },
    { fast_window: 20, slow_window: 200, total_return_pct: 12.4, sharpe_ratio: 0.78, max_drawdown_pct: -19.6, win_rate_pct: 50.8, total_trades: 7 },
    { fast_window: 30, slow_window: 50, total_return_pct: -2.1, sharpe_ratio: -0.15, max_drawdown_pct: -22.4, win_rate_pct: 45.2, total_trades: 30 },
    { fast_window: 30, slow_window: 100, total_return_pct: 19.2, sharpe_ratio: 1.08, max_drawdown_pct: -14.5, win_rate_pct: 55.9, total_trades: 20 },
    { fast_window: 30, slow_window: 150, total_return_pct: 14.5, sharpe_ratio: 0.89, max_drawdown_pct: -16.8, win_rate_pct: 53.1, total_trades: 12 },
    { fast_window: 30, slow_window: 200, total_return_pct: 10.8, sharpe_ratio: 0.65, max_drawdown_pct: -20.2, win_rate_pct: 49.5, total_trades: 8 },
    { fast_window: 50, slow_window: 100, total_return_pct: 16.4, sharpe_ratio: 0.98, max_drawdown_pct: -15.9, win_rate_pct: 54.8, total_trades: 14 },
    { fast_window: 50, slow_window: 150, total_return_pct: 11.2, sharpe_ratio: 0.72, max_drawdown_pct: -18.4, win_rate_pct: 51.6, total_trades: 9 },
    { fast_window: 50, slow_window: 200, total_return_pct: 8.5, sharpe_ratio: 0.55, max_drawdown_pct: -21.1, win_rate_pct: 48.3, total_trades: 6 },
    { fast_window: 50, slow_window: 50, total_return_pct: -5.3, sharpe_ratio: -0.35, max_drawdown_pct: -25.6, win_rate_pct: 42.1, total_trades: 35 },
  ],
}

export const mockMonthlyReturns = [
  { year: 2024, months: [2.1, -1.3, 3.5, -0.8, 1.2, 2.8, -2.1, 4.2, -1.5, 3.1, -0.4, 1.8] },
  { year: 2025, months: [1.5, 2.3, -1.2, 0.8, 3.1, -0.5, 2.4, -1.8, 1.9, 2.7, -0.9, 3.2] },
]
