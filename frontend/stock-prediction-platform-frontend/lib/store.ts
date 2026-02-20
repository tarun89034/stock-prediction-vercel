import { create } from "zustand"
import type { BacktestResult, PredictionResult, RecentActivity, Strategy, CurrencyCode } from "./types"
import { api } from "./api"

interface AppState {
  // Global
  currentTicker: string
  setCurrentTicker: (ticker: string) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // Backtest
  lastBacktestResult: BacktestResult | null
  setLastBacktestResult: (result: BacktestResult | null) => void

  // Prediction
  lastPredictionResult: PredictionResult | null
  setLastPredictionResult: (result: PredictionResult | null) => void

  // Recent Activity
  recentActivity: RecentActivity[]
  addActivity: (activity: RecentActivity) => void

  // Currency
  selectedCurrency: CurrencyCode
  exchangeRate: number        // rate from USD -> selectedCurrency
  currencySymbol: string      // e.g. "$", "₹", "€"
  currencyLoading: boolean
  setSelectedCurrency: (code: CurrencyCode) => void
  fetchExchangeRate: (code?: CurrencyCode) => Promise<void>

  // Settings
  settings: {
    apiUrl: string
    defaultSlippage: number
    defaultCommission: number
    defaultCapital: number
    defaultDateRange: string
    defaultStrategy: Strategy
    showAdvancedMetrics: boolean
    chartAnimations: boolean
    dateFormat: string
  }
  updateSettings: (settings: Partial<AppState["settings"]>) => void
}

// Currency symbol map (client-side fallback so we don't need an API call just for symbols)
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", INR: "₹", EUR: "€", GBP: "£", JPY: "¥",
  CAD: "C$", AUD: "A$", CHF: "CHF", CNY: "¥", SGD: "S$",
  HKD: "HK$", KRW: "₩", BRL: "R$", MXN: "$", ZAR: "R",
  SEK: "kr", NZD: "NZ$",
}

export const useStore = create<AppState>((set, get) => ({
  currentTicker: "",
  setCurrentTicker: (ticker) => set({ currentTicker: ticker }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  lastBacktestResult: null,
  setLastBacktestResult: (result) => set({ lastBacktestResult: result }),

  lastPredictionResult: null,
  setLastPredictionResult: (result) => set({ lastPredictionResult: result }),

  recentActivity: [
    {
      id: "1",
      ticker: "AAPL",
      type: "Backtest",
      strategy: "SMA Crossover",
      result: 12.5,
      date: "2026-02-18",
    },
    {
      id: "2",
      ticker: "MSFT",
      type: "Prediction",
      strategy: "ML Model",
      result: 0,
      date: "2026-02-17",
    },
    {
      id: "3",
      ticker: "GOOGL",
      type: "Backtest",
      strategy: "RSI",
      result: -3.2,
      date: "2026-02-16",
    },
    {
      id: "4",
      ticker: "TSLA",
      type: "Backtest",
      strategy: "MACD",
      result: 8.7,
      date: "2026-02-15",
    },
    {
      id: "5",
      ticker: "NVDA",
      type: "Prediction",
      strategy: "ML Model",
      result: 0,
      date: "2026-02-14",
    },
  ],
  addActivity: (activity) =>
    set((s) => ({
      recentActivity: [activity, ...s.recentActivity].slice(0, 10),
    })),

  // Currency state
  selectedCurrency: "USD",
  exchangeRate: 1.0,
  currencySymbol: "$",
  currencyLoading: false,

  setSelectedCurrency: (code) => {
    set({
      selectedCurrency: code,
      currencySymbol: CURRENCY_SYMBOLS[code] || code,
    })
    // Auto-fetch the exchange rate
    get().fetchExchangeRate(code)
  },

  fetchExchangeRate: async (code?) => {
    const currency = code || get().selectedCurrency
    if (currency === "USD") {
      set({ exchangeRate: 1.0, currencySymbol: "$", currencyLoading: false })
      return
    }
    set({ currencyLoading: true })
    try {
      const data = await api.getExchangeRate("USD", currency)
      set({
        exchangeRate: data.rate,
        currencySymbol: data.to_symbol || CURRENCY_SYMBOLS[currency] || currency,
        currencyLoading: false,
      })
    } catch {
      // On failure, keep the symbol but rate=1 (show USD values)
      console.error(`Failed to fetch exchange rate for ${currency}`)
      set({ exchangeRate: 1.0, currencyLoading: false })
    }
  },

  settings: {
    apiUrl: "http://localhost:8000",
    defaultSlippage: 0.1,
    defaultCommission: 0.1,
    defaultCapital: 10000,
    defaultDateRange: "2Y",
    defaultStrategy: "sma_crossover",
    showAdvancedMetrics: false,
    chartAnimations: true,
    dateFormat: "YYYY-MM-DD",
  },
  updateSettings: (newSettings) =>
    set((s) => ({ settings: { ...s.settings, ...newSettings } })),
}))
