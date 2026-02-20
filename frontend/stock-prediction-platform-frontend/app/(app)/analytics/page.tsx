"use client"

import { useState } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts"
import { useStore } from "@/lib/store"
import { mockBacktestResult, mockMonthlyReturns } from "@/lib/mock-data"
import { formatPercent, formatCurrency, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LineChart as LineChartIcon, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const mockStrategyComparison = [
  { ticker: "AAPL", strategy: "SMA Crossover", dateRange: "2024-01 to 2025-01", returnPct: 24.5, sharpe: 1.24, maxDD: -15.3, winRate: 58.3, alpha: 0.083, beta: 0.92 },
  { ticker: "MSFT", strategy: "RSI", dateRange: "2024-01 to 2025-01", returnPct: 18.2, sharpe: 1.08, maxDD: -12.7, winRate: 55.6, alpha: 0.045, beta: 0.87 },
  { ticker: "GOOGL", strategy: "MACD", dateRange: "2024-01 to 2025-01", returnPct: -3.2, sharpe: -0.15, maxDD: -22.4, winRate: 45.2, alpha: -0.065, beta: 1.12 },
  { ticker: "TSLA", strategy: "SMA Crossover", dateRange: "2024-06 to 2025-06", returnPct: 32.1, sharpe: 1.56, maxDD: -18.9, winRate: 62.1, alpha: 0.142, beta: 1.45 },
  { ticker: "NVDA", strategy: "RSI", dateRange: "2023-01 to 2025-01", returnPct: 45.3, sharpe: 1.82, maxDD: -20.1, winRate: 60.8, alpha: 0.195, beta: 1.32 },
]

const riskMetrics = [
  { metric: "Sharpe Ratio", value: "1.24", rating: 3, label: "Good", explanation: "Risk-adjusted returns above average" },
  { metric: "Sortino Ratio", value: "1.67", rating: 4, label: "Very Good", explanation: "Strong downside risk management" },
  { metric: "Max Drawdown", value: "-15.3%", rating: 2, label: "Fair", explanation: "Significant but recoverable" },
  { metric: "Win Rate", value: "58.3%", rating: 3, label: "Good", explanation: "Wins more often than loses" },
  { metric: "Profit Factor", value: "1.87", rating: 4, label: "Very Good", explanation: "Profits nearly double the losses" },
  { metric: "Calmar Ratio", value: "1.60", rating: 3, label: "Good", explanation: "Decent return for the drawdown risk" },
]

// Generate mock trade histogram
const tradeReturns = Array.from({ length: 100 }, () => (Math.random() - 0.4) * 15)
const histBuckets = [-15, -10, -5, -2, 0, 2, 5, 10, 15]
const histogram = histBuckets.slice(0, -1).map((_, i) => {
  const min = histBuckets[i]
  const max = histBuckets[i + 1]
  const count = tradeReturns.filter((r) => r >= min && r < max).length
  return { bucket: `${min}% to ${max}%`, count, mid: (min + max) / 2 }
})

function SharpeGauge({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, -1), 3)
  const pct = ((clamped + 1) / 4) * 100

  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full">
      <div className="absolute inset-0 flex">
        <div className="h-full flex-1 bg-loss/30" />
        <div className="h-full flex-1 bg-warning/30" />
        <div className="h-full flex-1 bg-profit/30" />
        <div className="h-full flex-1 bg-info/30" />
      </div>
      <div
        className="absolute top-0 h-full w-1 bg-foreground rounded-full"
        style={{ left: `${pct}%` }}
      />
    </div>
  )
}

function MonthlyHeatmap() {
  const getColor = (val: number) => {
    if (val > 3) return "bg-profit/60 text-profit"
    if (val > 1) return "bg-profit/30 text-profit"
    if (val > 0) return "bg-profit/10 text-profit/80"
    if (val > -1) return "bg-loss/10 text-loss/80"
    if (val > -3) return "bg-loss/30 text-loss"
    return "bg-loss/60 text-loss"
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-xs text-muted-foreground">Year</th>
            {monthNames.map((m) => (
              <th key={m} className="px-1 py-1 text-center text-xs text-muted-foreground">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mockMonthlyReturns.map((row) => (
            <tr key={row.year}>
              <td className="px-2 py-1 font-mono text-xs text-muted-foreground">{row.year}</td>
              {row.months.map((val, i) => (
                <td key={i} className="px-1 py-1">
                  <div className={cn("flex items-center justify-center rounded-md px-1 py-2 font-mono text-xs tabular-nums", getColor(val))}>
                    {formatPercent(val).replace("+", "")}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HistTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { bucket: string; count: number } }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover p-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{payload[0].payload.bucket}</p>
      <p className="text-xs font-semibold text-popover-foreground">{payload[0].payload.count} trades</p>
    </div>
  )
}

function DDTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover p-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold text-loss">{payload[0].value.toFixed(2)}%</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const lastResult = useStore((s) => s.lastBacktestResult)
  const data = lastResult || mockBacktestResult
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deep-dive into strategy performance and risk metrics
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {/* Strategy Comparison Table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-card-foreground">Strategy Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Ticker</th>
                <th className="px-4 py-2 font-medium">Strategy</th>
                <th className="px-4 py-2 font-medium">Date Range</th>
                <th className="px-4 py-2 font-medium text-right">Return %</th>
                <th className="px-4 py-2 font-medium text-right">Sharpe</th>
                <th className="px-4 py-2 font-medium text-right">Max DD %</th>
                <th className="px-4 py-2 font-medium text-right">Win Rate %</th>
                <th className="px-4 py-2 font-medium text-right">Alpha</th>
                <th className="px-4 py-2 font-medium text-right">Beta</th>
              </tr>
            </thead>
            <tbody>
              {mockStrategyComparison.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                  className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-2.5 font-mono font-semibold text-card-foreground">{row.ticker}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.strategy}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.dateRange}</td>
                  <td className={cn("px-4 py-2.5 text-right font-mono tabular-nums", row.returnPct >= 0 ? "text-profit" : "text-loss")}>{formatPercent(row.returnPct)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-card-foreground">{row.sharpe.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-loss">{formatPercent(row.maxDD)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-card-foreground">{row.winRate.toFixed(1)}%</td>
                  <td className={cn("px-4 py-2.5 text-right font-mono tabular-nums", row.alpha >= 0 ? "text-profit" : "text-loss")}>{formatNumber(row.alpha, 4)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-card-foreground">{formatNumber(row.beta, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metric Deep-Dive 2x2 Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sharpe Ratio Card */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-medium text-card-foreground">Sharpe Ratio</h3>
          <p className="mb-4 font-mono text-3xl font-bold tabular-nums text-profit">
            {formatNumber(data.sharpe_ratio, 2)}
          </p>
          <SharpeGauge value={data.sharpe_ratio ?? 0} />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{"< 0 Bad"}</span>
            <span>0-1 OK</span>
            <span>1-2 Good</span>
            <span>{"> 2 Great"}</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            A Sharpe ratio of {formatNumber(data.sharpe_ratio, 2)} indicates risk-adjusted returns that exceed typical market performance.
          </p>
        </div>

        {/* Drawdown Analysis */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-medium text-card-foreground">Drawdown Analysis</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data.drawdown_curve}>
              <defs>
                <linearGradient id="ddGradAnalytics" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
              <XAxis dataKey="date" tick={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <RechartsTooltip content={<DDTooltip />} />
              <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1.5} fill="url(#ddGradAnalytics)" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>Worst Drawdown: <span className="font-mono font-semibold text-loss">{formatPercent(data.max_drawdown_pct)}</span></p>
          </div>
        </div>

        {/* Win/Loss Distribution */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-medium text-card-foreground">Win/Loss Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={histogram}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
              <RechartsTooltip content={<HistTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {histogram.map((entry, i) => (
                  <Cell key={i} fill={entry.mid >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>Avg Win: <span className="font-mono text-profit">+3.2%</span></span>
            <span>Avg Loss: <span className="font-mono text-loss">-2.1%</span></span>
            <span>Median: <span className="font-mono text-card-foreground">+0.8%</span></span>
          </div>
        </div>

        {/* Monthly Returns Heatmap */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-medium text-card-foreground">Monthly Returns Heatmap</h3>
          <MonthlyHeatmap />
        </div>
      </div>

      {/* Risk Metrics Summary */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-card-foreground">Risk Metrics Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Metric</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2 font-medium">Rating</th>
                <th className="px-4 py-2 font-medium">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {riskMetrics.map((row) => (
                <tr key={row.metric} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-card-foreground">{row.metric}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-card-foreground">{row.value}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      "text-xs font-semibold",
                      row.rating >= 4 ? "text-profit" : row.rating >= 3 ? "text-info" : row.rating >= 2 ? "text-warning" : "text-loss"
                    )}>
                      {"*".repeat(row.rating)} {row.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
