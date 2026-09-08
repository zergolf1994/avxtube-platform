"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Activity, BriefcaseBusiness, Cpu, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components"
import { useAutoReload } from "@/hooks/use-auto-reload"
import type { AdminWorker, AdminWorkersResponse } from "@/lib/worker"

import { WorkerActions } from "./worker-actions"

const HEARTBEAT_TTL_MS = 3 * 60_000
const OFFLINE_DELETE_AFTER_MS = 5 * 60_000
const POLLING_STORAGE_KEY = "admin-workers-polling-ms"
const POLLING_OPTIONS = [0, 5_000, 10_000, 30_000] as const

export function WorkersDashboard({
  initialData,
}: {
  initialData: AdminWorkersResponse
}) {
  const t = useTranslations("admin.workers")
  const [data, setData] = React.useState(initialData)
  const [pending, setPending] = React.useState(false)
  const [reloadError, setReloadError] = React.useState("")
  const [intervalMs, setIntervalMs] = React.useState(10_000)
  const loadingRef = React.useRef(false)

  const reload = React.useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setPending(true)
    setReloadError("")
    try {
      const response = await fetch("/api/v1/admin/workers", {
        cache: "no-store",
      })
      if (!response.ok)
        throw new Error(`Worker refresh failed (${response.status})`)
      setData((await response.json()) as AdminWorkersResponse)
    } catch (cause) {
      setReloadError(
        cause instanceof Error ? cause.message : "Worker refresh failed"
      )
    } finally {
      loadingRef.current = false
      setPending(false)
    }
  }, [])

  React.useEffect(() => {
    const saved = Number.parseInt(
      window.localStorage.getItem(POLLING_STORAGE_KEY) ?? "",
      10
    )
    if (POLLING_OPTIONS.includes(saved as (typeof POLLING_OPTIONS)[number]))
      setIntervalMs(saved)
  }, [])
  useAutoReload(() => void reload(), intervalMs)

  const now = new Date(data.now).getTime()
  const workers = data.workers.map((worker) => ({
    ...worker,
    effectiveStatus: effectiveStatus(worker, now),
  }))
  const online = workers.filter(
    (worker) => worker.effectiveStatus !== "offline"
  ).length
  const activeJobs = workers.reduce(
    (total, worker) => total + worker.activeJobs,
    0
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Cpu className="size-4" />
            {t("eyebrow")}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <WorkerRefreshControl
          intervalMs={intervalMs}
          pending={pending}
          onIntervalChange={setIntervalMs}
          onReload={reload}
        />
      </header>
      {reloadError ? (
        <p role="alert" className="text-sm text-destructive">
          {reloadError}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={Cpu}
          label={t("registered")}
          value={workers.length.toLocaleString()}
        />
        <SummaryCard
          icon={Activity}
          label={t("online")}
          value={online.toLocaleString()}
        />
        <SummaryCard
          icon={BriefcaseBusiness}
          label={t("activeJobs")}
          value={activeJobs.toLocaleString()}
        />
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">{t("worker")}</th>
                <th className="px-5 py-3 font-medium">{t("version")}</th>
                <th className="px-5 py-3 font-medium">{t("status")}</th>
                <th className="px-5 py-3 text-center font-medium">
                  {t("jobs")}
                </th>
                <th className="px-5 py-3 font-medium">{t("resources")}</th>
                <th className="px-5 py-3 text-right font-medium">
                  {t("heartbeat")}
                </th>
                <th className="px-5 py-3 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {workers.map((worker) => (
                <tr key={worker._id}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{worker.workerId || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {worker.type} · {worker.hostname || "—"}
                    </p>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {worker.version || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(worker.effectiveStatus)}`}
                      >
                        {t(`statusValue.${worker.effectiveStatus}`)}
                      </span>
                      {!worker.enable ? (
                        <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                          {t("disabled")}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center tabular-nums">
                    {worker.activeJobs} / {worker.maxJobs}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground tabular-nums">
                    CPU {percent(worker.system?.cpuPercent)} · RAM{" "}
                    {bytes(worker.system?.memUsed)} /{" "}
                    {bytes(worker.system?.memTotal)}
                  </td>
                  <td className="px-5 py-3 text-right text-xs whitespace-nowrap text-muted-foreground">
                    {formatDate(worker.heartbeatAt)}
                  </td>
                  <td className="px-5 py-3">
                    <WorkerActions
                      id={worker._id}
                      name={worker.workerId || worker._id}
                      enabled={worker.enable}
                      canDelete={canDeleteWorker(worker, now)}
                      onChanged={reload}
                    />
                  </td>
                </tr>
              ))}
              {!workers.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <Cpu className="mx-auto size-10 text-muted-foreground/60" />
                    <p className="mt-4 font-semibold">{t("empty")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("emptyDescription")}
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function WorkerRefreshControl({
  intervalMs,
  pending,
  onIntervalChange,
  onReload,
}: {
  intervalMs: number
  pending: boolean
  onIntervalChange: (value: number) => void
  onReload: () => Promise<void>
}) {
  const t = useTranslations("admin.workers")
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
        <span className="text-muted-foreground">{t("autoReload")}</span>
        <select
          value={intervalMs}
          onChange={(event) => {
            const value = Number.parseInt(event.target.value, 10)
            onIntervalChange(value)
            window.localStorage.setItem(POLLING_STORAGE_KEY, String(value))
          }}
          className="bg-transparent font-medium outline-none"
          aria-label={t("autoReload")}
        >
          <option value={0}>{t("off")}</option>
          <option value={5_000}>{t("everySeconds", { count: 5 })}</option>
          <option value={10_000}>{t("everySeconds", { count: 10 })}</option>
          <option value={30_000}>{t("everySeconds", { count: 30 })}</option>
        </select>
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => void onReload()}
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {t(pending ? "refreshing" : "refresh")}
      </Button>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}

function effectiveStatus(worker: AdminWorker, now: number) {
  if (!worker.heartbeatAt) return "offline" as const
  return now - new Date(worker.heartbeatAt).getTime() < HEARTBEAT_TTL_MS
    ? worker.status
    : ("offline" as const)
}

function canDeleteWorker(worker: AdminWorker, now: number) {
  const lastSeen = worker.heartbeatAt ?? worker.createdAt
  const lastSeenAt = new Date(lastSeen).getTime()
  return (
    Number.isFinite(lastSeenAt) &&
    now - lastSeenAt >= OFFLINE_DELETE_AFTER_MS &&
    effectiveStatus(worker, now) === "offline"
  )
}

function statusClass(status: AdminWorker["status"]) {
  if (status === "idle") return "bg-emerald-500/15 text-emerald-700"
  if (status === "busy") return "bg-blue-500/15 text-blue-700"
  if (status === "paused") return "bg-amber-500/15 text-amber-700"
  return "bg-muted text-muted-foreground"
}

function percent(value?: number) {
  return typeof value === "number" ? `${value.toFixed(0)}%` : "—"
}

function bytes(value?: number) {
  return typeof value === "number" && value > 0
    ? `${(value / 1024 ** 3).toFixed(1)} GB`
    : "—"
}

function formatDate(value?: string) {
  if (!value) return "—"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value))
}
