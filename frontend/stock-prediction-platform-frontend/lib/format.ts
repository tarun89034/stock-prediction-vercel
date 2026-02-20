import { useStore } from "./store"

/**
 * Get the current currency conversion context from the store.
 * Returns { symbol, rate } where rate converts USD -> selected currency.
 */
function getCurrencyCtx(): { symbol: string; rate: number } {
  const state = useStore.getState()
  return { symbol: state.currencySymbol, rate: state.exchangeRate }
}

/**
 * Format a USD value into the user's selected currency.
 * If `converted` is true (default), the value is multiplied by the exchange rate.
 * Pass `converted: false` if the value is already in the target currency.
 */
export function formatCurrency(
  value: number,
  opts?: { symbol?: string; rate?: number; converted?: boolean }
): string {
  const ctx = getCurrencyCtx()
  const symbol = opts?.symbol ?? ctx.symbol
  const rate = opts?.rate ?? ctx.rate
  const shouldConvert = opts?.converted !== false
  const converted = shouldConvert ? value * rate : value
  return `${symbol}${converted.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Convert a USD value to the selected currency (number only, no formatting).
 */
export function convertValue(usdValue: number): number {
  const { rate } = getCurrencyCtx()
  return usdValue * rate
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

export function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || value === undefined) return "N/A"
  return value.toFixed(decimals)
}

export function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(0)
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
