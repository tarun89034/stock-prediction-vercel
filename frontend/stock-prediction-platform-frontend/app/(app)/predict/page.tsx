"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PredictConfig } from "@/components/predict/predict-config"
import { PredictResults } from "@/components/predict/predict-results"
import { useStore } from "@/lib/store"
import { api } from "@/lib/api"
import type { PredictionResult } from "@/lib/types"

export default function PredictPage() {
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const addActivity = useStore((s) => s.addActivity)
  const setLastPredictionResult = useStore((s) => s.setLastPredictionResult)

  const handlePredict = async (ticker: string, days: number) => {
    setIsRunning(true)
    try {
      const result = await api.runPrediction({
        ticker,
        prediction_days: days,
      })
      setResult(result)
      setLastPredictionResult(result)
      addActivity({
        id: Date.now().toString(),
        ticker,
        type: "Prediction",
        strategy: "ML Model",
        result: 0,
        date: new Date().toISOString().split("T")[0],
      })
      toast.success(`Prediction generated for ${ticker}`)
      if (result.walk_forward_score < 53) {
        toast.warning("Walk-forward accuracy is below 53%")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prediction failed"
      toast.error(message)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Predict</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-powered stock price direction forecast using walk-forward validated models
        </p>
      </div>
      <div className="flex gap-6">
        {/* Config */}
        <aside className="w-[350px] shrink-0">
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="rounded-lg border border-border bg-card p-5">
              <PredictConfig onPredict={handlePredict} isRunning={isRunning} />
            </div>
          </ScrollArea>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          <PredictResults result={result} />
        </div>
      </div>
    </div>
  )
}
