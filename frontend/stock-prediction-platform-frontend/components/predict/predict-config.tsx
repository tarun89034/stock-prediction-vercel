"use client"

import { useState, useEffect } from "react"
import { Search, Check, X, Loader2, Brain } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/format"

interface PredictConfigProps {
  onPredict: (ticker: string, days: number) => void
  isRunning: boolean
}

export function PredictConfig({ onPredict, isRunning }: PredictConfigProps) {
  const [ticker, setTicker] = useState("")
  const [tickerValid, setTickerValid] = useState<boolean | null>(null)
  const [tickerPrice, setTickerPrice] = useState<number | null>(null)
  const [tickerChecking, setTickerChecking] = useState(false)
  const [tickerError, setTickerError] = useState<string | null>(null)
  const [horizon, setHorizon] = useState(5)

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

  const getHorizonWarning = () => {
    if (horizon <= 3) return { text: "Short-term predictions are most reliable", color: "text-profit" }
    if (horizon <= 7) return { text: "Medium-term -- confidence decreases", color: "text-warning" }
    return { text: "Long-term -- treat as directional estimate only", color: "text-loss" }
  }

  const warning = getHorizonWarning()

  return (
    <div className="space-y-6">
      {/* Ticker */}
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
              {tickerValid ? <Check className="size-4 text-profit" /> : <X className="size-4 text-loss" />}
            </div>
          ) : null}
        </div>
        {tickerValid && tickerPrice && (
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">
            {ticker} — {formatCurrency(tickerPrice)}
          </p>
        )}
        {tickerValid === false && !tickerChecking && <p className="mt-1.5 text-xs text-loss">Invalid ticker symbol</p>}
        {tickerError && !tickerChecking && <p className="mt-1.5 text-xs text-warning">{tickerError}</p>}
      </div>

      {/* Prediction Horizon */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Prediction Horizon
        </label>
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>Days ahead</span>
          <span className="font-mono text-foreground">{horizon}</span>
        </div>
        <Slider min={1} max={30} value={[horizon]} onValueChange={([v]) => setHorizon(v)} />
        <p className={cn("mt-2 text-xs", warning.color)}>
          {warning.text}
        </p>
      </div>

      {/* Action */}
      <Button
        onClick={() => onPredict(ticker.toUpperCase(), horizon)}
        disabled={!tickerValid || isRunning}
        className="w-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Training model...
          </>
        ) : (
          <>
            <Brain className="mr-2 size-4" />
            Generate Prediction
          </>
        )}
      </Button>
    </div>
  )
}
