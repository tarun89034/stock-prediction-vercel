"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConfigPanel, type BacktestConfig } from "@/components/backtest/config-panel"
import { ResultsPanel } from "@/components/backtest/results-panel"
import { SweepSheet } from "@/components/backtest/sweep-sheet"
import { useStore } from "@/lib/store"
import { api } from "@/lib/api"
import type { BacktestResult, ParameterSweepResult } from "@/lib/types"

export default function BacktestPage() {
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [sweepResult, setSweepResult] = useState<ParameterSweepResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isSweeping, setIsSweeping] = useState(false)
  const [sweepOpen, setSweepOpen] = useState(false)
  const [lastConfig, setLastConfig] = useState<BacktestConfig | null>(null)
  const addActivity = useStore((s) => s.addActivity)
  const setLastBacktestResult = useStore((s) => s.setLastBacktestResult)

  const handleRunBacktest = async (config: BacktestConfig) => {
    setIsRunning(true)
    setLastConfig(config)
    const startTime = Date.now()
    try {
      const result = await api.runBacktest({
        ticker: config.ticker,
        start_date: config.startDate,
        end_date: config.endDate,
        strategy: config.strategy,
        fast_window: config.fastWindow,
        slow_window: config.slowWindow,
        rsi_period: config.rsiPeriod,
        rsi_overbought: config.rsiOverbought,
        rsi_oversold: config.rsiOversold,
        initial_capital: config.initialCapital,
        slippage_pct: config.slippage,
        commission_pct: config.commission,
      })
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      setResult(result)
      setLastBacktestResult(result)
      addActivity({
        id: Date.now().toString(),
        ticker: result.ticker,
        type: "Backtest",
        strategy: result.strategy,
        result: result.total_return_pct,
        date: new Date().toISOString().split("T")[0],
      })
      toast.success(`Backtest completed in ${elapsed}s`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backtest failed"
      toast.error(message)
    } finally {
      setIsRunning(false)
    }
  }

  const handleRunSweep = async () => {
    if (!lastConfig) {
      toast.error("Run a backtest first to set parameters")
      return
    }
    setIsSweeping(true)
    try {
      const result = await api.runParameterSweep({
        ticker: lastConfig.ticker,
        start_date: lastConfig.startDate,
        end_date: lastConfig.endDate,
        strategy: lastConfig.strategy,
        fast_window_range: [10, 20, 30, 50],
        slow_window_range: [50, 100, 150, 200],
        initial_capital: lastConfig.initialCapital,
        slippage_pct: lastConfig.slippage,
        commission_pct: lastConfig.commission,
      })
      setSweepResult(result)
      setSweepOpen(true)
      toast.success(`Parameter sweep completed — ${result.combinations_tested} combinations tested`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sweep failed"
      toast.error(message)
    } finally {
      setIsSweeping(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Backtest</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test trading strategies against historical market data
        </p>
      </div>
      <div className="flex gap-6">
        {/* Config Panel */}
        <aside className="w-[380px] shrink-0">
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="rounded-lg border border-border bg-card p-5">
              <ConfigPanel
                onRunBacktest={handleRunBacktest}
                onRunSweep={handleRunSweep}
                isRunning={isRunning}
                isSweeping={isSweeping}
              />
            </div>
          </ScrollArea>
        </aside>

        {/* Results Panel */}
        <div className="min-w-0 flex-1">
          <ResultsPanel result={result} />
        </div>
      </div>

      <SweepSheet open={sweepOpen} onOpenChange={setSweepOpen} result={sweepResult} />
    </div>
  )
}
