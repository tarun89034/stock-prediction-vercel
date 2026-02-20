export interface BacktestRequest {
  ticker: string
  start_date: string
  end_date: string
  strategy: "sma_crossover" | "rsi" | "macd"
  fast_window?: number
  slow_window?: number
  rsi_period?: number
  rsi_overbought?: number
  rsi_oversold?: number
  initial_capital?: number
  slippage_pct?: number
  commission_pct?: number
}

export interface BacktestResult {
  ticker: string
  strategy: string
  initial_capital: number
  final_capital: number
  total_return_pct: number
  sharpe_ratio: number | null
  max_drawdown_pct: number
  win_rate_pct: number
  total_trades: number
  profit_factor: number | null
  alpha: number | null
  beta: number | null
  equity_curve: Array<{ date: string; equity: number }>
  drawdown_curve: Array<{ date: string; drawdown: number }>
  trades: Array<Trade>
}

export interface Trade {
  id: number
  entry_date: string
  exit_date: string
  direction: string
  entry_price: number
  exit_price: number
  pnl: number
  pnl_pct: number
  duration: number
}

export interface PredictionRequest {
  ticker: string
  prediction_days?: number
}

export interface PredictionResult {
  ticker: string
  current_price: number
  predictions: Array<{
    date: string
    predicted_direction: number
    confidence: number
    label: "UP" | "DOWN"
    disclaimer: string
  }>
  signal: "BUY" | "SELL" | "HOLD"
  shap_explanation: Array<{
    feature: string
    raw_name: string
    value: number
    shap_impact: number
    direction: "Bullish" | "Bearish"
    magnitude: number
  }>
  model_accuracy: number
  walk_forward_score: number
}

export interface ParameterSweepRequest {
  ticker: string
  start_date: string
  end_date: string
  strategy: string
  fast_window_range?: number[]
  slow_window_range?: number[]
  initial_capital?: number
  slippage_pct?: number
  commission_pct?: number
}

export interface ParameterSweepResult {
  ticker: string
  strategy: string
  combinations_tested: number
  results: Array<{
    fast_window: number
    slow_window: number
    total_return_pct: number
    sharpe_ratio: number | null
    max_drawdown_pct: number
    win_rate_pct: number
    total_trades: number
  }>
}

export interface RecentActivity {
  id: string
  ticker: string
  type: "Backtest" | "Prediction"
  strategy: string
  result: number
  date: string
}

export type Strategy = "sma_crossover" | "rsi" | "macd"

// ─── Currency Types ───

export interface CurrencyInfo {
  symbol: string
  name: string
}

export type CurrencyCode =
  | "USD" | "INR" | "EUR" | "GBP" | "JPY"
  | "CAD" | "AUD" | "CHF" | "CNY" | "SGD"
  | "HKD" | "KRW" | "BRL" | "MXN" | "ZAR"
  | "SEK" | "NZD"

export interface ExchangeRateResponse {
  from: string
  to: string
  rate: number
  from_symbol: string
  to_symbol: string
}

export interface ExchangeRatesResponse {
  base: string
  rates: Record<string, number>
  currencies: Record<string, CurrencyInfo>
}

export interface ConvertResponse {
  from_currency: string
  to_currency: string
  rate: number
  original_amount: number
  converted_amount: number
  symbol: string
}
