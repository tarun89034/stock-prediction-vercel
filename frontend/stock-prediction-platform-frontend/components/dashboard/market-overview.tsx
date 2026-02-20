"use client"

import { useEffect, useState } from "react"
import { marketIndices as defaultIndices } from "@/lib/mock-data"
import { api } from "@/lib/api"
import { formatCurrency, formatPercent } from "@/lib/format"
import { useStore } from "@/lib/store"
import { Sparkline } from "@/components/sparkline"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

// Tickers to fetch real prices for
const watchlist = [
  { name: "S&P 500 ETF", symbol: "SPY" },
  { name: "NASDAQ ETF", symbol: "QQQ" },
  { name: "Apple", symbol: "AAPL" },
  { name: "Microsoft", symbol: "MSFT" },
  { name: "NVIDIA", symbol: "NVDA" },
]

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
  const [apiAvailable, setApiAvailable] = useState(false)
  // Subscribe to currency changes to trigger re-render (formatCurrency reads from store)
  useStore((s) => s.exchangeRate)
  useStore((s) => s.currencySymbol)

  useEffect(() => {
    let cancelled = false

    async function fetchPrices() {
      try {
        // First check if backend is available
        await api.healthCheck()
        setApiAvailable(true)

        const results = await Promise.allSettled(
          watchlist.map((w) => api.getPrice(w.symbol))
        )

        if (cancelled) return

        const cards: MarketCard[] = watchlist.map((w, i) => {
          const result = results[i]
          if (result.status === "fulfilled") {
            const price = result.value.price
            // Simulate change (backend doesn't return change data yet)
            const changePct = (Math.random() - 0.45) * 3
            const change = price * (changePct / 100)
            return {
              name: w.name,
              symbol: w.symbol,
              value: price,
              change: Math.round(change * 100) / 100,
              changePct: Math.round(changePct * 100) / 100,
              sparkline: generateSparkline(price * 0.97, price * 0.005),
            }
          }
          // Fallback to mock if individual fetch failed
          return defaultIndices[i] || {
            name: w.name,
            symbol: w.symbol,
            value: 0,
            change: 0,
            changePct: 0,
            sparkline: generateSparkline(100, 2),
          }
        })

        setIndices(cards)
      } catch {
        // Backend not available, keep mock data
        setApiAvailable(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPrices()
    return () => { cancelled = true }
  }, [])

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
      </div>
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
