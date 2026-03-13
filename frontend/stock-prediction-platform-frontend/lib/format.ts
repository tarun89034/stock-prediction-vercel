import { useStore } from "./store"

/**
 * Map each supported currency code to a representative locale.
 * This drives number separators (1,000 vs 1.000 vs 1 000) and date formats.
 */
const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  INR: "en-IN",   // 1,00,000.00 (lakh grouping)
  EUR: "de-DE",   // 1.000,00
  GBP: "en-GB",   // 1,000.00
  JPY: "ja-JP",   // 1,000
  CAD: "en-CA",
  AUD: "en-AU",
  CHF: "de-CH",   // 1'000.00
  CNY: "zh-CN",
  SGD: "en-SG",
  HKD: "zh-HK",
  KRW: "ko-KR",
  BRL: "pt-BR",   // 1.000,00
  MXN: "es-MX",
  ZAR: "en-ZA",
  SEK: "sv-SE",   // 1 000,00
  NZD: "en-NZ",
}

/**
 * Get the locale string for the currently selected currency.
 * Falls back to "en-US" if the currency isn't mapped.
 */
function getLocale(): string {
  const currency = useStore.getState().selectedCurrency
  return CURRENCY_LOCALE[currency] || "en-US"
}

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
 *
 * Number formatting (group separators, decimal separator) follows the locale
 * of the selected currency.
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
  const locale = getLocale()

  const formatted = converted.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${symbol}${formatted}`
}

/**
 * Convert a USD value to the selected currency (number only, no formatting).
 */
export function convertValue(usdValue: number): number {
  const { rate } = getCurrencyCtx()
  return usdValue * rate
}

/**
 * Format a percentage value with sign prefix.
 * Uses the locale-appropriate decimal separator.
 */
export function formatPercent(value: number): string {
  const locale = getLocale()
  const formatted = Math.abs(value).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${value >= 0 ? "+" : "\u2212"}${formatted}%`
}

/**
 * Format a plain number to `decimals` fractional digits.
 * Uses locale-aware decimal and grouping separators.
 */
export function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || value === undefined) return "N/A"
  const locale = getLocale()
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Abbreviate large numbers (K / M / B) using the locale-aware decimal separator.
 */
export function formatLargeNumber(value: number): string {
  const locale = getLocale()
  if (Math.abs(value) >= 1e9)
    return `${(value / 1e9).toLocaleString(locale, { maximumFractionDigits: 1 })}B`
  if (Math.abs(value) >= 1e6)
    return `${(value / 1e6).toLocaleString(locale, { maximumFractionDigits: 1 })}M`
  if (Math.abs(value) >= 1e3)
    return `${(value / 1e3).toLocaleString(locale, { maximumFractionDigits: 1 })}K`
  return value.toLocaleString(locale, { maximumFractionDigits: 0 })
}

/**
 * Format a date string according to the locale of the selected currency.
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const locale = getLocale()
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })
}
