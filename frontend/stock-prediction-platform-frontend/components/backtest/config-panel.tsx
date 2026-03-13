"use client"

import { useState, useEffect } from "react"
import {
  Search,
  Check,
  X,
  TrendingUp,
  Activity,
  BarChart2,
  ChevronDown,
  Loader2,
  Rocket,
  ScanSearch,
} from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { Strategy } from "@/lib/types"

interface ConfigPanelProps {
  onRunBacktest: (config: BacktestConfig) => void
  onRunSweep: () => void
  isRunning: boolean
  isSweeping: boolean
}

export interface BacktestConfig {
  ticker: string
  strategy: Strategy
  startDate: string
  endDate: string
  fastWindow: number
  slowWindow: number
  rsiPeriod: number
  rsiOverbought: number
  rsiOversold: number
  slippage: number
  commission: number
  initialCapital: number
}

const strategies: { id: Strategy; label: string; description: string; icon: React.ElementType }[] = [
  { id: "sma_crossover", label: "SMA Crossover", description: "Buy when fast MA crosses above slow MA", icon: TrendingUp },
  { id: "rsi", label: "RSI", description: "Buy oversold, sell overbought", icon: Activity },
  { id: "macd", label: "MACD", description: "Buy on MACD crossover signal", icon: BarChart2 },
]

const datePresets = [
  { label: "1Y", years: 1 },
  { label: "2Y", years: 2 },
  { label: "3Y", years: 3 },
  { label: "5Y", years: 5 },
  { label: "10Y", years: 10 },
]

function getPresetDates(years: number) {
  const end = new Date()
  const start = new Date()
  start.setFullYear(start.getFullYear() - years)
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

export function ConfigPanel({ onRunBacktest, onRunSweep, isRunning, isSweeping }: ConfigPanelProps) {
  const [ticker, setTicker] = useState("")
  const [tickerValid, setTickerValid] = useState<boolean | null>(null)
  const [tickerPrice, setTickerPrice] = useState<number | null>(null)
  const [tickerChecking, setTickerChecking] = useState(false)
  const [strategy, setStrategy] = useState<Strategy>("sma_crossover")
  const [startDate, setStartDate] = useState(() => getPresetDates(2).start)
  const [endDate, setEndDate] = useState(() => getPresetDates(2).end)
  const [fastWindow, setFastWindow] = useState(20)
  const [slowWindow, setSlowWindow] = useState(50)
  const [rsiPeriod, setRsiPeriod] = useState(14)
  const [rsiOverbought, setRsiOverbought] = useState(70)
  const [rsiOversold, setRsiOversold] = useState(30)
  const [slippage, setSlippage] = useState(0.1)
  const [commission, setCommission] = useState(0.1)
  const [initialCapital, setInitialCapital] = useState(10000)
  const [costsOpen, setCostsOpen] = useState(false)
  const [tickerError, setTickerError] = useState<string | null>(null)

  // Real ticker validation via backend API
  useEffect(() => {
    if (!ticker) {
      setTickerValid(null)
      setTickerPrice(null)
      setTickerError(null)
      return
    }
    const timeout = setTimeout(async () => {
      setTickerChecking(true)
      setTickerError(null)
      try {
        const [validateRes, priceRes] = await Promise.allSettled([
          api.validateTicker(ticker.toUpperCase()),
          api.getPrice(ticker.toUpperCase()),
        ])

        if (validateRes.status === "rejected" && priceRes.status === "rejected") {
          // Both failed — likely network/backend issue, not an invalid ticker
          setTickerValid(null)
          setTickerPrice(null)
          setTickerError("Cannot reach backend — is the server running on port 8000?")
          return
        }

        const isValid = validateRes.status === "fulfilled" && validateRes.value.valid
        setTickerValid(isValid)

        if (isValid && priceRes.status === "fulfilled") {
          setTickerPrice(priceRes.value.price)
        } else {
          setTickerPrice(null)
        }
      } catch {
        setTickerValid(null)
        setTickerPrice(null)
        setTickerError("Cannot reach backend — is the server running on port 8000?")
      } finally {
        setTickerChecking(false)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [ticker])

  const handleRun = () => {
    onRunBacktest({
      ticker: ticker.toUpperCase(),
      strategy,
      startDate,
      endDate,
      fastWindow,
      slowWindow,
      rsiPeriod,
      rsiOverbought,
      rsiOversold,
      slippage,
      commission,
      initialCapital,
    })
  }

  const smaError = strategy === "sma_crossover" && fastWindow >= slowWindow

  return (
    <div className="space-y-6">
      {/* Ticker Input */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Ticker Symbol
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g., AAPL, RELIANCE.NS, 0700.HK)"
            className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-9 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {tickerChecking ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : tickerValid !== null ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {tickerValid ? (
                <Check className="size-4 text-profit" />
              ) : (
                <X className="size-4 text-loss" />
              )}
            </div>
          ) : null}
        </div>
        {tickerValid && tickerPrice && (
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">
            {ticker} — {formatCurrency(tickerPrice)}
          </p>
        )}
        {tickerValid === false && !tickerChecking && (
          <p className="mt-1.5 text-xs text-loss">Invalid ticker symbol</p>
        )}
        {tickerError && !tickerChecking && (
          <p className="mt-1.5 text-xs text-warning">{tickerError}</p>
        )}
      </div>

      {/* Strategy Selection */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Strategy
        </label>
        <div className="space-y-2">
          {strategies.map((s) => {
            const Icon = s.icon
            const selected = strategy === s.id
            return (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                  selected
                    ? "border-foreground/30 bg-secondary"
                    : "border-border bg-card hover:border-muted-foreground/30"
                )}
              >
                <div className={cn("flex size-9 items-center justify-center rounded-md", selected ? "bg-foreground/10 text-foreground" : "bg-secondary text-muted-foreground")}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", selected ? "text-foreground" : "text-card-foreground")}>{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                {selected && (
                  <div className="size-2 rounded-full bg-foreground" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Date Range */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Date Range
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Start</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring [color-scheme:dark]"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">End</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring [color-scheme:dark]"
            />
          </div>
        </div>
        <div className="mt-2 flex gap-1.5">
          {datePresets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                const d = getPresetDates(p.years)
                setStartDate(d.start)
                setEndDate(d.end)
              }}
              className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy Parameters */}
      <div>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Parameters
        </label>
        {strategy === "sma_crossover" && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>Fast MA Window</span>
                <span className="font-mono text-foreground">{fastWindow}</span>
              </div>
              <Slider min={5} max={100} value={[fastWindow]} onValueChange={([v]) => setFastWindow(v)} />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>Slow MA Window</span>
                <span className="font-mono text-foreground">{slowWindow}</span>
              </div>
              <Slider min={20} max={300} value={[slowWindow]} onValueChange={([v]) => setSlowWindow(v)} />
            </div>
            {smaError && (
              <p className="text-xs text-loss">Fast window must be less than slow window</p>
            )}
          </div>
        )}
        {strategy === "rsi" && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>RSI Period</span>
                <span className="font-mono text-foreground">{rsiPeriod}</span>
              </div>
              <Slider min={5} max={50} value={[rsiPeriod]} onValueChange={([v]) => setRsiPeriod(v)} />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>Overbought Threshold</span>
                <span className="font-mono text-foreground">{rsiOverbought}</span>
              </div>
              <Slider min={50} max={95} value={[rsiOverbought]} onValueChange={([v]) => setRsiOverbought(v)} />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>Oversold Threshold</span>
                <span className="font-mono text-foreground">{rsiOversold}</span>
              </div>
              <Slider min={5} max={50} value={[rsiOversold]} onValueChange={([v]) => setRsiOversold(v)} />
            </div>
          </div>
        )}
        {strategy === "macd" && (
          <p className="text-sm text-muted-foreground">
            Using default MACD parameters (12, 26, 9)
          </p>
        )}
      </div>

      {/* Cost Parameters */}
      <Collapsible open={costsOpen} onOpenChange={setCostsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          <span>Transaction Costs</span>
          <ChevronDown className={cn("size-4 transition-transform", costsOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-4 rounded-lg border border-border bg-card p-4">
          <div>
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Slippage (%)</span>
              <span className="font-mono text-foreground">{slippage.toFixed(2)}</span>
            </div>
            <Slider min={0} max={2} step={0.05} value={[slippage]} onValueChange={([v]) => setSlippage(v)} />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Commission (%)</span>
              <span className="font-mono text-foreground">{commission.toFixed(2)}</span>
            </div>
            <Slider min={0} max={2} step={0.05} value={[commission]} onValueChange={([v]) => setCommission(v)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Initial Capital ({useStore.getState().currencySymbol})</label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              step={1000}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Action Buttons */}
      <div className="space-y-2">
        <Button
          onClick={handleRun}
          disabled={!tickerValid || isRunning || smaError}
          className="w-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Rocket className="mr-2 size-4" />
              Run Backtest
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onRunSweep}
          disabled={!tickerValid || isSweeping}
          className="w-full"
        >
          {isSweeping ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Sweeping...
            </>
          ) : (
            <>
              <ScanSearch className="mr-2 size-4" />
              Parameter Sweep
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
