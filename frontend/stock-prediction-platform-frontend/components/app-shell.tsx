"use client"

import { AppSidebar } from "./app-sidebar"
import { AppHeader } from "./app-header"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useStore((s) => s.sidebarCollapsed)

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <AppHeader />
      <main
        className={cn(
          "pt-14 transition-all duration-300",
          collapsed ? "pl-16" : "pl-60"
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
