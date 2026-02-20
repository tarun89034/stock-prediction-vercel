"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Check, X, Loader2, Wifi } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Strategy } from "@/lib/types"

export default function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  const [apiUrl, setApiUrl] = useState(settings.apiUrl)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [responseTime, setResponseTime] = useState<number | null>(null)

  const [slippage, setSlippage] = useState(settings.defaultSlippage)
  const [commission, setCommission] = useState(settings.defaultCommission)
  const [capital, setCapital] = useState(settings.defaultCapital)
  const [dateRange, setDateRange] = useState(settings.defaultDateRange)
  const [strategy, setStrategy] = useState<Strategy>(settings.defaultStrategy)
  const [showAdvanced, setShowAdvanced] = useState(settings.showAdvancedMetrics)
  const [chartAnim, setChartAnim] = useState(settings.chartAnimations)
  const [dateFormat, setDateFormat] = useState(settings.dateFormat)
  const [currency, setCurrency] = useState(settings.currencySymbol)

  const testConnection = async () => {
    setConnectionStatus("testing")
    const start = Date.now()
    try {
      // Simulated test
      await new Promise((r) => setTimeout(r, 500))
      setResponseTime(Date.now() - start)
      setConnectionStatus("success")
      toast.success("Connection successful")
    } catch {
      setConnectionStatus("error")
      toast.error("Connection failed")
    }
  }

  const saveDefaults = () => {
    updateSettings({
      apiUrl,
      defaultSlippage: slippage,
      defaultCommission: commission,
      defaultCapital: capital,
      defaultDateRange: dateRange,
      defaultStrategy: strategy,
      showAdvancedMetrics: showAdvanced,
      chartAnimations: chartAnim,
      dateFormat,
      currencySymbol: currency,
    })
    toast.success("Settings saved")
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure default parameters and display preferences
        </p>
      </div>

      {/* API Configuration */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-card-foreground">API Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Backend URL</label>
            <div className="flex gap-2">
              <input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button onClick={testConnection} variant="outline" size="sm" className="shrink-0 gap-2">
                {connectionStatus === "testing" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wifi className="size-4" />
                )}
                Test
              </Button>
            </div>
            {connectionStatus === "success" && (
              <div className="mt-2 flex items-center gap-2 text-xs text-profit">
                <Check className="size-3" />
                Connected ({responseTime}ms)
              </div>
            )}
            {connectionStatus === "error" && (
              <div className="mt-2 flex items-center gap-2 text-xs text-loss">
                <X className="size-3" />
                Connection failed. Check if backend is running.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Default Parameters */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-card-foreground">Default Parameters</h2>
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Default Slippage (%)</span>
              <span className="font-mono text-foreground">{slippage.toFixed(2)}</span>
            </div>
            <Slider min={0} max={2} step={0.05} value={[slippage]} onValueChange={([v]) => setSlippage(v)} />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Default Commission (%)</span>
              <span className="font-mono text-foreground">{commission.toFixed(2)}</span>
            </div>
            <Slider min={0} max={2} step={0.05} value={[commission]} onValueChange={([v]) => setCommission(v)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Default Initial Capital ($)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              step={1000}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Default Date Range</label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1Y">1 Year</SelectItem>
                <SelectItem value="2Y">2 Years</SelectItem>
                <SelectItem value="3Y">3 Years</SelectItem>
                <SelectItem value="5Y">5 Years</SelectItem>
                <SelectItem value="10Y">10 Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Default Strategy</label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as Strategy)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sma_crossover">SMA Crossover</SelectItem>
                <SelectItem value="rsi">RSI</SelectItem>
                <SelectItem value="macd">MACD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Display Preferences */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-card-foreground">Display Preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-card-foreground">Show advanced metrics by default</p>
              <p className="text-xs text-muted-foreground">Display alpha, beta on backtest results</p>
            </div>
            <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-card-foreground">Enable chart animations</p>
              <p className="text-xs text-muted-foreground">Animate charts on data load</p>
            </div>
            <Switch checked={chartAnim} onCheckedChange={setChartAnim} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Date Format</label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Currency Symbol</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="$">$ (USD)</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Button onClick={saveDefaults} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        Save Settings
      </Button>
    </div>
  )
}
