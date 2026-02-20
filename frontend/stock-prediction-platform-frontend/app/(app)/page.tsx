"use client"

import { MarketOverview } from "@/components/dashboard/market-overview"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of market conditions and platform capabilities
        </p>
      </div>
      <MarketOverview />
      <QuickActions />
      <RecentActivity />
    </div>
  )
}
