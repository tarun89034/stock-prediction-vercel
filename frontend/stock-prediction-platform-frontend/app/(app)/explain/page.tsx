"use client"

import { useState } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ScatterChart,
  Scatter,
  Cell,
  ZAxis,
} from "recharts"
import {
  Database,
  Cpu,
  BrainCircuit,
  ShieldCheck,
  TrendingUp,
  ChevronDown,
  AlertTriangle,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const pipelineSteps = [
  {
    icon: Database,
    title: "Data Collection",
    description: "Historical price data, volume, and market indicators are fetched from financial APIs.",
    details: "We collect OHLCV data, split-adjusted prices, and compute technical indicators across multiple timeframes.",
  },
  {
    icon: Cpu,
    title: "Feature Engineering",
    description: "Raw data is transformed into meaningful features like RSI, SMA ratios, volatility measures.",
    details: "Over 30 features are computed including momentum indicators, mean reversion signals, and volume profiles.",
  },
  {
    icon: BrainCircuit,
    title: "Model Training",
    description: "A gradient-boosted ensemble model is trained on feature-label pairs.",
    details: "We use LightGBM with careful hyperparameter tuning and feature selection to prevent overfitting.",
  },
  {
    icon: ShieldCheck,
    title: "Walk-Forward Validation",
    description: "The model is tested on unseen future data using expanding windows.",
    details: "This simulates real-world deployment: train on past, predict the future, then evaluate. Each split is independent.",
  },
  {
    icon: TrendingUp,
    title: "Prediction",
    description: "The final model generates directional forecasts with confidence scores and SHAP explanations.",
    details: "Predictions are produced for each day in the horizon with decaying confidence the further ahead we look.",
  },
]

const globalImportance = [
  { feature: "RSI (14)", importance: 0.18 },
  { feature: "SMA 20 Ratio", importance: 0.15 },
  { feature: "Volatility 20d", importance: 0.12 },
  { feature: "Volume Change", importance: 0.10 },
  { feature: "MACD Signal", importance: 0.08 },
  { feature: "Bollinger %B", importance: 0.07 },
  { feature: "Price Momentum 5d", importance: 0.06 },
  { feature: "ATR 14", importance: 0.05 },
]

// Mock scatter data for feature explorer
function generateScatterData(feature: string) {
  return Array.from({ length: 80 }, () => {
    const value = Math.random() * 100
    const shapBase = feature === "RSI (14)" ? (value < 30 ? 0.1 : value > 70 ? -0.08 : (Math.random() - 0.5) * 0.05) : (Math.random() - 0.5) * 0.15
    return {
      value: Math.round(value * 10) / 10,
      shap: Math.round((shapBase + (Math.random() - 0.5) * 0.04) * 1000) / 1000,
    }
  })
}

const walkForwardSplits = [
  { id: 1, trainStart: "2020-01", trainEnd: "2022-12", testStart: "2023-01", testEnd: "2023-06", accuracy: 55.2 },
  { id: 2, trainStart: "2020-01", trainEnd: "2023-06", testStart: "2023-07", testEnd: "2023-12", accuracy: 53.8 },
  { id: 3, trainStart: "2020-01", trainEnd: "2023-12", testStart: "2024-01", testEnd: "2024-06", accuracy: 56.1 },
  { id: 4, trainStart: "2020-01", trainEnd: "2024-06", testStart: "2024-07", testEnd: "2024-12", accuracy: 54.5 },
  { id: 5, trainStart: "2020-01", trainEnd: "2024-12", testStart: "2025-01", testEnd: "2025-06", accuracy: 55.9 },
]

function ImportTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { feature: string; importance: number } }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover p-2 shadow-lg">
      <p className="text-xs font-medium text-popover-foreground">{payload[0].payload.feature}</p>
      <p className="text-xs text-muted-foreground">Importance: {payload[0].payload.importance.toFixed(3)}</p>
    </div>
  )
}

export default function ExplainerPage() {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [selectedFeature, setSelectedFeature] = useState("RSI (14)")
  const scatterData = generateScatterData(selectedFeature)

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">How It Works</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Understand the ML pipeline, feature importance, and validation methodology
        </p>
      </div>

      {/* Section 1: Pipeline Steps */}
      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Model Pipeline
        </h2>
        <div className="relative flex flex-col gap-3">
          {pipelineSteps.map((step, i) => {
            const Icon = step.icon
            const expanded = expandedStep === i
            return (
              <Collapsible key={i} open={expanded} onOpenChange={() => setExpandedStep(expanded ? null : i)}>
                <CollapsibleTrigger className="flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-foreground/20">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Icon className="size-5 text-foreground" />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-card-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 ml-[72px] rounded-lg border border-border bg-secondary/50 p-4">
                  <p className="text-sm text-muted-foreground">{step.details}</p>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </section>

      {/* Section 2: Global Feature Importance */}
      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Global Feature Importance
        </h2>
        <div className="rounded-lg border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={globalImportance} layout="vertical" margin={{ left: 100, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: "#52525b" }} tickLine={false} axisLine={false} width={100} />
              <RechartsTooltip content={<ImportTooltip />} />
              <Bar dataKey="importance" fill="#3b82f6" fillOpacity={0.7} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Section 3: Interactive Feature Explorer */}
      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Feature Explorer
        </h2>
        <div className="mb-4">
          <Select value={selectedFeature} onValueChange={setSelectedFeature}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {globalImportance.map((f) => (
                <SelectItem key={f.feature} value={f.feature}>{f.feature}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
              <XAxis
                type="number"
                dataKey="value"
                name="Feature Value"
                tick={{ fontSize: 10, fill: "#52525b" }}
                tickLine={false}
                axisLine={false}
                label={{ value: "Feature Value", position: "bottom", fill: "#52525b", fontSize: 11, offset: -5 }}
              />
              <YAxis
                type="number"
                dataKey="shap"
                name="SHAP Value"
                tick={{ fontSize: 10, fill: "#52525b" }}
                tickLine={false}
                axisLine={false}
                label={{ value: "SHAP Impact", angle: -90, position: "insideLeft", fill: "#52525b", fontSize: 11 }}
              />
              <ZAxis range={[30, 30]} />
              <RechartsTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="rounded-lg border border-border bg-popover p-2 shadow-lg">
                      <p className="text-xs text-muted-foreground">Value: {d.value}</p>
                      <p className={cn("text-xs font-semibold", d.shap >= 0 ? "text-profit" : "text-loss")}>
                        SHAP: {d.shap >= 0 ? "+" : ""}{d.shap.toFixed(4)}
                      </p>
                    </div>
                  )
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={entry.shap >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.6} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted-foreground">
            Each dot is one data point. Green = bullish SHAP impact, Red = bearish. When {selectedFeature} shows extreme values, the model often responds with stronger predictions.
          </p>
        </div>
      </section>

      {/* Section 4: Walk-Forward Validation */}
      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Walk-Forward Validation
        </h2>
        <div className="space-y-2">
          {walkForwardSplits.map((split) => (
            <div key={split.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <span className="font-mono text-xs text-muted-foreground">Split {split.id}</span>
              <div className="flex flex-1 items-center gap-1">
                <div className="relative flex-1">
                  <div className="h-6 rounded-md bg-info/20" title={`Train: ${split.trainStart} to ${split.trainEnd}`}>
                    <div className="flex h-full items-center px-2">
                      <span className="text-[10px] text-info">Train: {split.trainStart} → {split.trainEnd}</span>
                    </div>
                  </div>
                </div>
                <div className="relative w-28">
                  <div className="h-6 rounded-md bg-profit/20" title={`Test: ${split.testStart} to ${split.testEnd}`}>
                    <div className="flex h-full items-center px-2">
                      <span className="text-[10px] text-profit">Test: {split.testStart} → {split.testEnd}</span>
                    </div>
                  </div>
                </div>
              </div>
              <span className={cn("font-mono text-xs font-semibold tabular-nums", split.accuracy > 55 ? "text-profit" : split.accuracy > 53 ? "text-warning" : "text-loss")}>
                {split.accuracy.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Each split trains on all data up to the test period, then evaluates on unseen data. This simulates real-world deployment conditions.
        </p>
      </section>

      {/* Section 5: Disclaimers */}
      <section>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="size-5 text-warning" />
            <h3 className="text-sm font-semibold text-warning">Important Disclaimers</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
              Prediction accuracy of 53-56% is typical and represents a marginal edge at best
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
              SHAP values are approximate due to feature correlation
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
              Historical performance does not predict future results
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
              This tool is for education and research, not financial advice
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
