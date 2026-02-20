"use client"

import Link from "next/link"
import { BarChart3, Brain, TrendingUp, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const actions = [
  {
    title: "Run Backtest",
    description: "Test a trading strategy on historical data",
    icon: BarChart3,
    href: "/backtest",
    cta: "Start Backtesting",
    accentClass: "text-profit",
    bgClass: "bg-profit/10",
  },
  {
    title: "Get Prediction",
    description: "AI-powered price direction forecast",
    icon: Brain,
    href: "/predict",
    cta: "Generate Prediction",
    accentClass: "text-info",
    bgClass: "bg-info/10",
  },
  {
    title: "Analyze Strategy",
    description: "Deep-dive into performance metrics",
    icon: TrendingUp,
    href: "/analytics",
    cta: "View Analytics",
    accentClass: "text-warning",
    bgClass: "bg-warning/10",
  },
]

export function QuickActions() {
  return (
    <section>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Quick Actions
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex flex-col rounded-lg border border-border bg-card p-6 transition-all hover:border-border/80 hover:bg-card/80"
            >
              <div className={cn("mb-4 flex size-12 items-center justify-center rounded-lg", action.bgClass)}>
                <Icon className={cn("size-6", action.accentClass)} />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground">{action.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                {action.description}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary transition-colors group-hover:text-primary/80">
                {action.cta}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
