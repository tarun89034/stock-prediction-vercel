import { create } from "zustand"
import type { BacktestResult, PredictionResult, RecentActivity, Strategy } from "./types"

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
    currencySymbol: string
  }
  updateSettings: (settings: Partial<AppState["settings"]>) => void
}

export const useStore = create<AppState>((set) => ({
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
    currencySymbol: "$",
  },
  updateSettings: (newSettings) =>
    set((s) => ({ settings: { ...s.settings, ...newSettings } })),
}))
