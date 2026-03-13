"use client"

import { useState } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronDown, Info, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatPercent, formatNumber, convertValue } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { BacktestResult } from "@/lib/types"

interface ResultsPanelProps {
  result: BacktestResult | null
}

const chartRanges = ["1M", "3M", "6M", "1Y", "All"] as const

function MetricCard({
  label,
  value,
  color,
  subtitle,
  tooltip,
  children,
}: {
  label: string
  value: string
  color?: string
  subtitle?: string
  tooltip?: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger>
              <Info className="size-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px]">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className={cn("mt-1 font-mono text-xl font-bold tabular-nums", color || "text-card-foreground")}>
        {value}
      </p>
      {subtitle && <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  )
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold text-popover-foreground">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

function DrawdownTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold text-loss">
        {payload[0].value.toFixed(2)}%
      </p>
    </div>
  )
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const [chartRange, setChartRange] = useState<(typeof chartRanges)[number]>("All")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [tradesOpen, setTradesOpen] = useState(false)
  const [tradesPage, setTradesPage] = useState(0)
  const tradesPerPage = 20
  // Subscribe to currency changes to trigger re-render
  useStore((s) => s.exchangeRate)
  useStore((s) => s.currencySymbol)

  if (!result) {
    return (
      <div className="flex h-[600px] flex-col items-center justify-center rounded-lg border border-dashed border-border">
        <BarChart3 className="mb-4 size-16 text-muted-foreground/30" />
        <h3 className="text-lg font-semibold text-muted-foreground">No Results Yet</h3>
        <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground/70">
          Configure your strategy and run a backtest to see results here
        </p>
      </div>
    )
  }

  const profitable = result.total_return_pct >= 0
  const equityColor = profitable ? "#22c55e" : "#ef4444"

  // Filter equity curve by range
  const filteredCurve = (() => {
    if (chartRange === "All") return result.equity_curve
    const months = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 }[chartRange]
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return result.equity_curve.filter((d) => new Date(d.date) >= cutoff)
  })()

  const filteredDrawdown = (() => {
    if (chartRange === "All") return result.drawdown_curve
    const months = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 }[chartRange]
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return result.drawdown_curve.filter((d) => new Date(d.date) >= cutoff)
  })()

  const totalPages = Math.ceil(result.trades.length / tradesPerPage)
  const paginatedTrades = result.trades.slice(
    tradesPage * tradesPerPage,
    (tradesPage + 1) * tradesPerPage
  )

  const sharpeColor = (result.sharpe_ratio ?? 0) > 1 ? "text-profit" : (result.sharpe_ratio ?? 0) > 0 ? "text-warning" : "text-loss"
  const pfColor = (result.profit_factor ?? 0) > 1 ? "text-profit" : "text-loss"

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Final Capital"
          value={formatCurrency(result.final_capital)}
          color={profitable ? "text-profit" : "text-loss"}
          subtitle={`${formatPercent(result.total_return_pct)} (${formatCurrency(result.final_capital - result.initial_capital)})`}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={formatNumber(result.sharpe_ratio, 4)}
          color={sharpeColor}
          tooltip="Risk-adjusted return. >1 is good, >2 is excellent."
        />
        <MetricCard
          label="Max Drawdown"
          value={formatPercent(result.max_drawdown_pct)}
          color="text-loss"
          tooltip="Maximum peak-to-trough decline in portfolio value."
        />
        <MetricCard
          label="Win Rate"
          value={`${result.win_rate_pct.toFixed(1)}%`}
          color="text-foreground"
        >
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-profit" style={{ width: `${result.win_rate_pct}%` }} />
          </div>
        </MetricCard>
        <MetricCard label="Total Trades" value={String(result.total_trades)} />
        <MetricCard
          label="Profit Factor"
          value={formatNumber(result.profit_factor)}
          color={pfColor}
          tooltip="Gross profit / gross loss. >1 means profitable strategy."
        />
      </div>

      {/* Advanced Metrics */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} />
          Advanced Metrics
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Alpha (annualized)"
              value={formatNumber(result.alpha, 4)}
              color={((result.alpha ?? 0) >= 0) ? "text-profit" : "text-loss"}
              tooltip="Excess return over the regional benchmark index"
            />
            <MetricCard
              label="Beta"
              value={formatNumber(result.beta, 4)}
              tooltip="Volatility relative to market. 1.0 = same as market."
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Equity Curve Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-card-foreground">Equity Curve</h3>
          <div className="flex gap-1">
            {chartRanges.map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  chartRange === r
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={filteredCurve}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={equityColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={equityColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} tickFormatter={(v) => { const s = useStore.getState(); return `${s.currencySymbol}${((v * s.exchangeRate) / 1000).toFixed(0)}k` }} />
            <RechartsTooltip content={<CustomTooltip />} />
            <ReferenceLine y={result.initial_capital} stroke="#52525b" strokeDasharray="5 5" label={{ value: `Start: ${formatCurrency(result.initial_capital)}`, fill: "#52525b", fontSize: 10 }} />
            <Area type="monotone" dataKey="equity" stroke={equityColor} strokeWidth={2} fill="url(#equityGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Drawdown Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 text-sm font-medium text-card-foreground">Drawdown</h3>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={filteredDrawdown}>
            <defs>
              <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <RechartsTooltip content={<DrawdownTooltip />} />
            <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1.5} fill="url(#ddGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Trades Table */}
      <Collapsible open={tradesOpen} onOpenChange={setTradesOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn("size-4 transition-transform", tradesOpen && "rotate-180")} />
          Trade Log ({result.trades.length} trades)
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Entry Date</th>
                  <th className="px-3 py-2 font-medium">Exit Date</th>
                  <th className="px-3 py-2 font-medium">Direction</th>
                  <th className="px-3 py-2 font-medium text-right">Entry</th>
                  <th className="px-3 py-2 font-medium text-right">Exit</th>
                  <th className="px-3 py-2 font-medium text-right">P&L</th>
                  <th className="px-3 py-2 font-medium text-right">P&L (%)</th>
                  <th className="px-3 py-2 font-medium text-right">Days</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{trade.id}</td>
                    <td className="px-3 py-2 text-xs">{trade.entry_date}</td>
                    <td className="px-3 py-2 text-xs">{trade.exit_date}</td>
                    <td className="px-3 py-2 text-xs">{trade.direction}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{formatCurrency(trade.entry_price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{formatCurrency(trade.exit_price)}</td>
                    <td className={cn("px-3 py-2 text-right font-mono text-xs tabular-nums", trade.pnl >= 0 ? "text-profit" : "text-loss")}>
                      {trade.pnl >= 0 ? "+" : ""}{formatCurrency(trade.pnl)}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-mono text-xs tabular-nums", trade.pnl_pct >= 0 ? "text-profit" : "text-loss")}>
                      {formatPercent(trade.pnl_pct)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{trade.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {tradesPage + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTradesPage(Math.max(0, tradesPage - 1))}
                  disabled={tradesPage === 0}
                  className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setTradesPage(Math.min(totalPages - 1, tradesPage + 1))}
                  disabled={tradesPage >= totalPages - 1}
                  className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
