"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { marketIndices as defaultIndices } from "@/lib/mock-data"
import { api } from "@/lib/api"
import { formatCurrency, formatPercent } from "@/lib/format"
import { useStore } from "@/lib/store"
import { Sparkline } from "@/components/sparkline"
import { cn } from "@/lib/utils"
import { Loader2, RefreshCw } from "lucide-react"

// Global market indices watchlist
const watchlist = [
  { name: "S&P 500", symbol: "^GSPC", region: "US" },
  { name: "STOXX Europe 600", symbol: "^STOXX", region: "EU" },
  { name: "S&P/ASX 200", symbol: "^AXJO", region: "AU" },
  { name: "CSI 300", symbol: "000300.SS", region: "CN" },
  { name: "NIFTY 50", symbol: "^NSEI", region: "IN" },
  { name: "JSE All Share", symbol: "^J203.JO", region: "ZA" },
]

const REFRESH_INTERVAL = 60_000 // 60 seconds

interface MarketCard {
  name: string
  symbol: string
  value: number
  change: number
  changePct: number
  sparkline: number[]
}

function generateSparkline(start: number, volatility: number, points = 30) {
  const data: number[] = [start]
  for (let i = 1; i < points; i++) {
    data.push(data[i - 1] + (Math.random() - 0.48) * volatility)
  }
  return data
}

export function MarketOverview() {
  const [indices, setIndices] = useState<MarketCard[]>(defaultIndices)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Subscribe to currency changes to trigger re-render
  useStore((s) => s.exchangeRate)
  useStore((s) => s.currencySymbol)

  const fetchPrices = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setError(null)

    try {
      // First check if backend is available
      await api.healthCheck()
      setApiAvailable(true)

      // Fetch all prices and sparklines in parallel
      const [priceResults, sparkResults] = await Promise.all([
        Promise.allSettled(watchlist.map((w) => api.getPrice(w.symbol))),
        Promise.allSettled(watchlist.map((w) => api.getSparkline(w.symbol, 30))),
      ])

      const cards: MarketCard[] = watchlist.map((w, i) => {
        const priceResult = priceResults[i]
        const sparkResult = sparkResults[i]
        const sparkline =
          sparkResult.status === "fulfilled" && sparkResult.value.prices.length > 0
            ? sparkResult.value.prices
            : null

        if (priceResult.status === "fulfilled") {
          const data = priceResult.value
          const price = data.price
          const changePct = data.changePct ?? 0
          const change = data.change ?? 0
          return {
            name: w.name,
            symbol: w.symbol,
            value: price,
            change,
            changePct,
            sparkline: sparkline ?? generateSparkline(price * 0.97, price * 0.005),
          }
        }
        // Fallback to mock if individual fetch failed
        const fallback = defaultIndices[i]
        return fallback
          ? { ...fallback, sparkline: sparkline ?? fallback.sparkline }
          : {
              name: w.name,
              symbol: w.symbol,
              value: 0,
              change: 0,
              changePct: 0,
              sparkline: sparkline ?? generateSparkline(100, 2),
            }
      })

      setIndices(cards)
      setLastUpdated(new Date())
    } catch {
      // Backend not available
      setApiAvailable(false)
      setError("Backend unavailable -- showing cached data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchPrices()
    intervalRef.current = setInterval(() => fetchPrices(true), REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchPrices])

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Market Overview
        </h2>
        {loading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        {!loading && (
          <span className={cn("text-[10px] font-medium", apiAvailable ? "text-profit" : "text-warning")}>
            {apiAvailable ? "LIVE" : "MOCK"}
          </span>
        )}
        {!loading && (
          <button
            onClick={() => fetchPrices(true)}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
            {lastUpdated && (
              <span className="tabular-nums">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </button>
        )}
      </div>
      {error && !apiAvailable && (
        <p className="mb-3 text-xs text-warning">{error}</p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {indices.map((index) => {
          const positive = index.changePct >= 0
          return (
            <div
              key={index.symbol}
              className="group min-w-[200px] flex-1 rounded-lg border border-border bg-card p-4 transition-all hover:scale-[1.02] hover:border-border/80 hover:bg-card/80"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{index.symbol}</p>
                  <p className="text-sm font-medium text-card-foreground">{index.name}</p>
                </div>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                    positive
                      ? "bg-profit/10 text-profit"
                      : "bg-loss/10 text-loss"
                  )}
                >
                  {formatPercent(index.changePct)}
                </span>
              </div>
              <p className="mt-2 font-mono text-xl font-bold tabular-nums text-card-foreground">
                {formatCurrency(index.value)}
              </p>
              <p
                className={cn(
                  "mt-1 font-mono text-xs tabular-nums",
                  positive ? "text-profit" : "text-loss"
                )}
              >
                {positive ? "+" : ""}
                {formatCurrency(index.change)}
              </p>
              <div className="mt-3">
                <Sparkline data={index.sparkline} positive={positive} height={32} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
