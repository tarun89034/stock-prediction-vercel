"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { formatPercent, formatNumber } from "@/lib/format"
import type { ParameterSweepResult } from "@/lib/types"

interface SweepSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: ParameterSweepResult | null
}

function getSharpeColor(sharpe: number | null): string {
  if (sharpe === null) return "#52525b"
  if (sharpe > 1.5) return "#22c55e"
  if (sharpe > 1) return "#3b82f6"
  if (sharpe > 0.5) return "#f59e0b"
  if (sharpe > 0) return "#a3a3a3"
  return "#ef4444"
}

function getMedalClass(index: number): string {
  if (index === 0) return "border-l-2 border-l-[#ffd700]"
  if (index === 1) return "border-l-2 border-l-[#c0c0c0]"
  if (index === 2) return "border-l-2 border-l-[#cd7f32]"
  return ""
}

export function SweepSheet({ open, onOpenChange, result }: SweepSheetProps) {
  if (!result) return null

  const sorted = [...result.results].sort(
    (a, b) => (b.sharpe_ratio ?? -999) - (a.sharpe_ratio ?? -999)
  )

  // Build heatmap data
  const fastValues = [...new Set(result.results.map((r) => r.fast_window))].sort((a, b) => a - b)
  const slowValues = [...new Set(result.results.map((r) => r.slow_window))].sort((a, b) => a - b)
  const heatmapMap = new Map<string, number | null>()
  result.results.forEach((r) => {
    heatmapMap.set(`${r.fast_window}-${r.slow_window}`, r.sharpe_ratio)
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none border-border bg-background sm:max-w-[60vw]"
      >
        <SheetHeader className="pb-0">
          <SheetTitle className="text-foreground">Parameter Sweep Results</SheetTitle>
          <SheetDescription>
            {result.ticker} / {result.strategy} — {result.combinations_tested} combinations tested
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="space-y-6 pb-8">
            {/* Ranked Table */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-foreground">
                Rankings by Sharpe Ratio
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Fast</th>
                      <th className="px-3 py-2 font-medium">Slow</th>
                      <th className="px-3 py-2 font-medium text-right">Return %</th>
                      <th className="px-3 py-2 font-medium text-right">Sharpe</th>
                      <th className="px-3 py-2 font-medium text-right">Max DD %</th>
                      <th className="px-3 py-2 font-medium text-right">Win Rate %</th>
                      <th className="px-3 py-2 font-medium text-right">Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => (
                      <tr
                        key={`${row.fast_window}-${row.slow_window}`}
                        className={cn(
                          "border-b border-border/50 last:border-0",
                          getMedalClass(i)
                        )}
                      >
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.fast_window}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.slow_window}</td>
                        <td className={cn("px-3 py-2 text-right font-mono text-xs tabular-nums", row.total_return_pct >= 0 ? "text-profit" : "text-loss")}>
                          {formatPercent(row.total_return_pct)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className="inline-block rounded-sm px-2 py-0.5 font-mono text-xs tabular-nums text-foreground"
                            style={{ backgroundColor: `${getSharpeColor(row.sharpe_ratio)}20`, color: getSharpeColor(row.sharpe_ratio) }}
                          >
                            {formatNumber(row.sharpe_ratio, 2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-loss">
                          {formatPercent(row.max_drawdown_pct)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          {row.win_rate_pct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          {row.total_trades}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Heatmap */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-foreground">
                Sharpe Ratio Heatmap
              </h3>
              <div className="overflow-x-auto">
                <table className="border-collapse">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-xs text-muted-foreground">Fast \ Slow</th>
                      {slowValues.map((s) => (
                        <th key={s} className="px-2 py-1 text-center text-xs text-muted-foreground">
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fastValues.map((f) => (
                      <tr key={f}>
                        <td className="px-2 py-1 text-xs text-muted-foreground">{f}</td>
                        {slowValues.map((s) => {
                          const sharpe = heatmapMap.get(`${f}-${s}`)
                          const color = getSharpeColor(sharpe ?? null)
                          return (
                            <td key={s} className="px-1 py-1">
                              <div
                                className="flex size-12 items-center justify-center rounded-md font-mono text-xs tabular-nums"
                                style={{
                                  backgroundColor: `${color}20`,
                                  color: color,
                                }}
                              >
                                {sharpe !== null && sharpe !== undefined
                                  ? sharpe.toFixed(2)
                                  : "—"}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
