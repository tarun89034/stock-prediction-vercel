"use client"

import { useEffect, useState, useCallback } from "react"
import { Search } from "lucide-react"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const [time, setTime] = useState<string>("")
  const [dateStr, setDateStr] = useState<string>("")
  const collapsed = useStore((s) => s.sidebarCollapsed)
  const currentTicker = useStore((s) => s.currentTicker)
  const setCurrentTicker = useStore((s) => s.setCurrentTicker)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      )
      setDateStr(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        const input = document.getElementById("global-ticker-search") as HTMLInputElement
        input?.focus()
      }
    },
    []
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      setCurrentTicker(searchValue.trim().toUpperCase())
      setSearchValue("")
    }
  }

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm transition-all duration-300",
        collapsed ? "left-16" : "left-60"
      )}
    >
      <div className="flex items-center gap-4">
        {currentTicker && (
          <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1">
            <span className="text-xs text-muted-foreground">Active:</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {currentTicker}
            </span>
          </div>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative w-72">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="global-ticker-search"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search ticker..."
          className={cn(
            "w-full rounded-lg border bg-secondary py-2 pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
            searchFocused ? "border-ring" : "border-border"
          )}
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {"Ctrl+K"}
        </kbd>
      </form>

      {/* Time */}
      <div className="flex items-center gap-3 text-right">
        <div>
          <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {time}
          </p>
          <p className="text-xs text-muted-foreground">{dateStr}</p>
        </div>
        <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
    </header>
  )
}
