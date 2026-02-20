"use client"

import { AppShell } from "./app-shell"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
