"use client"

import * as React from "react"
import { CalendarDays, Clock3, FilePlus2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import type { HourlyContentStats } from "@/lib/admin-api"

type Labels = {
  title: string
  description: string
  date: string
  time: string
  contents: string
  total: string
  currentHour: string
}

export function HourlyContentStatsPanel({
  stats,
  labels,
}: {
  stats: HourlyContentStats
  labels: Labels
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const number = React.useMemo(() => new Intl.NumberFormat(), [])
  const max = Math.max(1, ...stats.hours.map((item) => item.count))
  const currentCount =
    stats.date === stats.currentDate
      ? (stats.hours[stats.currentHour]?.count ?? 0)
      : null

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <FilePlus2 className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">{labels.title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels.description}
          </p>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-sm font-medium">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="sr-only">{labels.date}</span>
          <input
            type="date"
            value={stats.date}
            onChange={(event) => {
              const params = new URLSearchParams(searchParams.toString())
              params.set("date", event.target.value)
              router.push(`/?${params.toString()}`)
            }}
            className="bg-transparent outline-none"
          />
        </label>
      </header>

      <div className="grid gap-3 border-b bg-muted/10 p-4 sm:grid-cols-2 sm:p-5">
        <Stat
          icon={<FilePlus2 className="size-4" />}
          label={labels.total}
          value={number.format(stats.total)}
        />
        <Stat
          icon={<Clock3 className="size-4" />}
          label={labels.currentHour}
          value={currentCount === null ? "—" : number.format(currentCount)}
        />
      </div>

      <div className="overflow-x-auto border-b px-3 py-5 sm:px-5">
        <HourlyAreaChart stats={stats} max={max} number={number} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-muted/25 text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-5 py-3">{labels.time}</th>
              <th className="w-full px-5 py-3">{labels.contents}</th>
              <th className="px-5 py-3 text-right">{labels.total}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stats.hours.map((item) => (
              <tr key={item.hour} className="hover:bg-muted/20">
                <td className="px-5 py-3 font-medium whitespace-nowrap tabular-nums">
                  {hourLabel(item.hour)}
                </td>
                <td className="px-5 py-3">
                  <div className="h-2 min-w-40 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${(item.count / max) * 100}%` }}
                    />
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums">
                  {number.format(item.count)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function HourlyAreaChart({
  stats,
  max,
  number,
}: {
  stats: HourlyContentStats
  max: number
  number: Intl.NumberFormat
}) {
  const width = 1_000
  const height = 250
  const left = 52
  const right = 18
  const top = 16
  const bottom = 32
  const plotHeight = height - top - bottom
  const baseline = top + plotHeight
  const points = stats.hours.map((item) => ({
    ...item,
    x: left + (item.hour / 23) * (width - left - right),
    y: top + (1 - item.count / max) * plotHeight,
  }))
  const line = points.map((point) => `${point.x},${point.y}`).join(" ")
  const area = `M ${points[0]?.x ?? left} ${baseline} L ${points
    .map((point) => `${point.x} ${point.y}`)
    .join(" L ")} L ${points.at(-1)?.x ?? left} ${baseline} Z`
  const gradientId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "")

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${stats.date} Asia/Bangkok: ${number.format(stats.total)}`}
      className="h-64 w-full min-w-[720px]"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = top + ratio * plotHeight
        return (
          <g key={ratio}>
            <line
              x1={left}
              x2={width - right}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeDasharray="4 4"
            />
            <text
              x={left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {number.format(Math.round(max * (1 - ratio)))}
            </text>
          </g>
        )
      })}
      <path d={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((point) => (
        <g key={point.hour}>
          <circle cx={point.x} cy={point.y} r="7" fill="transparent">
            <title>{`${hourLabel(point.hour)}: ${number.format(point.count)}`}</title>
          </circle>
          {point.hour % 2 === 0 || point.hour === 23 ? (
            <text
              x={point.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {String(point.hour).padStart(2, "0")}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  )
}

function hourLabel(hour: number) {
  const start = String(hour).padStart(2, "0")
  return `${start}:00–${start}:59 Bangkok`
}
