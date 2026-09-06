import type { LucideIcon } from "lucide-react"
import { Activity, BriefcaseBusiness, Cpu } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { getAdminWorkers } from "@/lib/admin-api"
import type { AdminWorker } from "@/lib/worker"

import { WorkerActions } from "./worker-actions"
import { WorkerRefreshButton } from "./worker-refresh-button"

export const dynamic = "force-dynamic"

const HEARTBEAT_TTL_MS = 3 * 60_000
const OFFLINE_DELETE_AFTER_MS = 5 * 60_000

export default async function WorkersPage() {
  const [data, t] = await Promise.all([
    getAdminWorkers(),
    getTranslations("admin.workers"),
  ])
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
        <WorkerRefreshButton />
      </header>

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
