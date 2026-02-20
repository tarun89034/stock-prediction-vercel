"use client"

import { useStore } from "@/lib/store"
import { formatPercent, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export function RecentActivity() {
  const activity = useStore((s) => s.recentActivity)

  return (
    <section>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Recent Activity
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Strategy</th>
              <th className="px-4 py-3 font-medium text-right">Result</th>
              <th className="px-4 py-3 font-medium text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-secondary/50"
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-semibold text-card-foreground">
                    {item.ticker}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      item.type === "Backtest"
                        ? "bg-info/10 text-info"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    {item.type}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {item.strategy}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.type === "Prediction" ? (
                    <span className="text-sm text-muted-foreground">--</span>
                  ) : (
                    <span
                      className={cn(
                        "font-mono text-sm font-semibold tabular-nums",
                        item.result >= 0 ? "text-profit" : "text-loss"
                      )}
                    >
                      {formatPercent(item.result)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                  {formatDate(item.date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
