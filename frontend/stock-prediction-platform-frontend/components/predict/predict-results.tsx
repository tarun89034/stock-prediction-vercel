"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
} from "recharts"
import { ArrowUp, ArrowDown, Minus, AlertTriangle, Brain } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { PredictionResult } from "@/lib/types"

interface PredictResultsProps {
  result: PredictionResult | null
}

function SignalBanner({ signal, price }: { signal: string; price: number }) {
  const config = {
    BUY: { bg: "bg-profit/10 border-profit/30", text: "text-profit", icon: ArrowUp, label: "BUY SIGNAL" },
    SELL: { bg: "bg-loss/10 border-loss/30", text: "text-loss", icon: ArrowDown, label: "SELL SIGNAL" },
    HOLD: { bg: "bg-warning/10 border-warning/30", text: "text-warning", icon: Minus, label: "HOLD -- NO CLEAR SIGNAL" },
  }[signal] ?? { bg: "bg-secondary", text: "text-foreground", icon: Minus, label: signal }

  const Icon = config.icon

  return (
    <div className={cn("rounded-lg border p-6 text-center", config.bg)}>
      <Icon className={cn("mx-auto mb-2 size-8", config.text)} />
      <p className={cn("text-2xl font-bold", config.text)}>{config.label}</p>
      <p className="mt-2 font-mono text-lg tabular-nums text-foreground">
        Current Price: {formatCurrency(price)}
      </p>
    </div>
  )
}

function ShapTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { feature: string; shap_impact: number; value: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="text-xs font-medium text-popover-foreground">{d.feature}</p>
      <p className="text-xs text-muted-foreground">Value: {d.value.toFixed(2)}</p>
      <p className={cn("text-xs font-semibold", d.shap_impact >= 0 ? "text-profit" : "text-loss")}>
        SHAP: {d.shap_impact >= 0 ? "+" : ""}{d.shap_impact.toFixed(4)}
      </p>
    </div>
  )
}

export function PredictResults({ result }: PredictResultsProps) {
  // Subscribe to currency store so component re-renders when currency changes
  const _exchangeRate = useStore((s) => s.exchangeRate)
  const _currencySymbol = useStore((s) => s.currencySymbol)

  if (!result) {
    return (
      <div className="flex h-[600px] flex-col items-center justify-center rounded-lg border border-dashed border-border">
        <Brain className="mb-4 size-16 text-muted-foreground/30" />
        <h3 className="text-lg font-semibold text-muted-foreground">No Prediction Yet</h3>
        <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground/70">
          Enter a ticker and generate a prediction to see AI-powered forecasts
        </p>
      </div>
    )
  }

  const wfColor = result.walk_forward_score < 53 ? "text-loss" : result.walk_forward_score < 56 ? "text-warning" : "text-profit"
  const lowConfidence = result.walk_forward_score < 53

  // SHAP chart data (sorted by absolute impact)
  const shapData = [...result.shap_explanation]
    .sort((a, b) => Math.abs(b.shap_impact) - Math.abs(a.shap_impact))

  // Natural language summary from top 3 features
  const top3 = shapData.slice(0, 3)
  const buildSummary = () => {
    const bullish = top3.filter((f) => f.direction === "Bullish")
    const bearish = top3.filter((f) => f.direction === "Bearish")
    const parts: string[] = []
    if (bullish.length) {
      parts.push(
        `primarily because ${bullish.map((f) => `${f.feature} was ${f.direction.toLowerCase()} (${f.value.toFixed(1)})`).join(" and ")}`
      )
    }
    if (bearish.length) {
      parts.push(
        `despite ${bearish.map((f) => `${f.feature} pulling slightly ${f.direction.toLowerCase()}`).join(" and ")}`
      )
    }
    return `The model predicted ${result.signal} ${parts.join(", ")}.`
  }

  return (
    <div className="space-y-6">
      {/* Signal Banner */}
      <SignalBanner signal={result.signal} price={result.current_price} />

      {/* Model Confidence */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Walk-Forward Accuracy</p>
          <p className={cn("mt-1 font-mono text-xl font-bold tabular-nums", wfColor)}>
            {result.walk_forward_score.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Model Accuracy</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-card-foreground">
            {result.model_accuracy.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Prediction Horizon</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-card-foreground">
            {result.predictions.length} days
          </p>
        </div>
      </div>

      {/* Low confidence warning */}
      {lowConfidence && (
        <div className="flex items-start gap-3 rounded-lg border border-loss/30 bg-loss/5 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-loss" />
          <div>
            <p className="text-sm font-semibold text-loss">Low Model Confidence</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Walk-forward accuracy is below 53%. This model has NO meaningful edge for this ticker.
              Predictions are essentially random. Do NOT make financial decisions based on this output.
            </p>
          </div>
        </div>
      )}

      {/* Prediction Timeline */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Prediction Timeline</h3>
        <div className="space-y-2">
          {result.predictions.map((pred, i) => {
            const opacity = 1 - i * 0.12
            const isUp = pred.label === "UP"
            return (
              <div
                key={pred.date}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-all"
                style={{ opacity }}
              >
                <div className="w-24 text-xs text-muted-foreground">{pred.date}</div>
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold",
                    isUp ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                  )}
                >
                  {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {pred.label}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn("h-full rounded-full", isUp ? "bg-profit" : "bg-loss")}
                        style={{ width: `${pred.confidence * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {(pred.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SHAP Explanation */}
      <div>
        <h3 className="mb-1 text-sm font-medium text-foreground">
          Why This Prediction?
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          SHAP values show feature contribution. Financial features are correlated -- treat as approximate.
        </p>
        <div className="rounded-lg border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={Math.max(200, shapData.length * 40)}>
            <BarChart data={shapData} layout="vertical" margin={{ left: 100, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: "#52525b" }} tickLine={false} axisLine={false} width={100} />
              <RechartsTooltip content={<ShapTooltip />} />
              <ReferenceLine x={0} stroke="#52525b" />
              <Bar dataKey="shap_impact" radius={[4, 4, 4, 4]}>
                {shapData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.shap_impact >= 0 ? "#22c55e" : "#ef4444"}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-secondary/50 p-4">
          <p className="text-sm text-muted-foreground italic">
            {buildSummary()}
          </p>
        </div>
      </div>
    </div>
  )
}
