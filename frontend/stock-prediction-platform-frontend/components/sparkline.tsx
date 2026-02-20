"use client"

import { ResponsiveContainer, AreaChart, Area } from "recharts"

interface SparklineProps {
  data: number[]
  positive: boolean
  height?: number
}

export function Sparkline({ data, positive, height = 40 }: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }))
  const color = positive ? "#22c55e" : "#ef4444"

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`spark-${positive ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${positive ? "up" : "down"})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
