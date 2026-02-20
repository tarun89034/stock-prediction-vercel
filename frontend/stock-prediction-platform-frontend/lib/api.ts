import type {
  BacktestRequest,
  BacktestResult,
  PredictionRequest,
  PredictionResult,
  ParameterSweepRequest,
  ParameterSweepResult,
} from "./types"

const DEFAULT_BASE_URL = "http://localhost:8000"
const TIMEOUT_MS = 120_000
const MAX_RETRIES = 1

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("quantedge_api_url") || DEFAULT_BASE_URL
  }
  return DEFAULT_BASE_URL
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    if (response.status >= 500 && retries > 0) {
      return fetchWithRetry(url, options, retries - 1)
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error")
      throw new Error(`API Error ${response.status}: ${errorBody}`)
    }

    return response
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. The server may be processing a large computation.")
    }
    if (retries > 0 && error instanceof TypeError) {
      return fetchWithRetry(url, options, retries - 1)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export const api = {
  async healthCheck(): Promise<{ status: string }> {
    const res = await fetchWithRetry(`${getBaseUrl()}/health`)
    return res.json()
  },

  async validateTicker(ticker: string): Promise<{ ticker: string; valid: boolean }> {
    const res = await fetchWithRetry(`${getBaseUrl()}/api/data/validate/${ticker}`)
    return res.json()
  },

  async getPrice(ticker: string): Promise<{ ticker: string; price: number }> {
    const res = await fetchWithRetry(`${getBaseUrl()}/api/data/price/${ticker}`)
    return res.json()
  },

  async getHistoricalData(
    ticker: string,
    start: string,
    end: string
  ): Promise<{ ticker: string; rows: number; data: Array<Record<string, unknown>> }> {
    const res = await fetchWithRetry(
      `${getBaseUrl()}/api/data/historical/${ticker}?start=${start}&end=${end}`
    )
    return res.json()
  },

  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    const res = await fetchWithRetry(`${getBaseUrl()}/api/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    return res.json()
  },

  async runParameterSweep(request: ParameterSweepRequest): Promise<ParameterSweepResult> {
    const res = await fetchWithRetry(`${getBaseUrl()}/api/backtest/sweep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    return res.json()
  },

  async runPrediction(request: PredictionRequest): Promise<PredictionResult> {
    const res = await fetchWithRetry(`${getBaseUrl()}/api/predict/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    return res.json()
  },

  async getMetricsHealth(): Promise<{ available_metrics: string[] }> {
    const res = await fetchWithRetry(`${getBaseUrl()}/api/metrics/health`)
    return res.json()
  },
}
