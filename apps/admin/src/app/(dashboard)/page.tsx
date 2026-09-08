import { ArrowRight, Clapperboard, FileText, Radio, Video } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import {
  getAdminDashboardSummary,
  type AdminDashboardSummary,
} from "@/lib/admin-api"
import { contentKinds, type ContentKind } from "@/lib/content"

import { HourlyContentStatsPanel } from "./hourly-content-stats"

const icons = { video: Video, short: Clapperboard, post: FileText, live: Radio }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>
}) {
  const t = await getTranslations("admin")
  const raw = await searchParams
  const date = dashboardDate(Array.isArray(raw.date) ? raw.date[0] : raw.date)
  const summary: AdminDashboardSummary = await getAdminDashboardSummary(
    date
  ).catch(() => ({
    totals: {},
    hourly: {
      date,
      timeZone: "Asia/Bangkok" as const,
      currentDate: "",
      currentHour: 0,
      total: 0,
      hours: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    },
  }))

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">{t("dashboard")}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          {t("overview")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t("overviewDescription")}
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {contentKinds.map((kind) => (
          <ContentStat
            key={kind}
            kind={kind}
            total={summary.totals[kind] ?? 0}
            label={t(`kinds.${kind}`)}
          />
        ))}
      </section>
      <HourlyContentStatsPanel
        stats={summary.hourly}
        labels={{
          title: t("hourlyStats.title"),
          description: t("hourlyStats.description"),
          date: t("hourlyStats.date"),
          time: t("hourlyStats.time"),
          contents: t("hourlyStats.contents"),
          total: t("hourlyStats.total"),
          currentHour: t("hourlyStats.currentHour"),
        }}
      />
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("content")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("overviewDescription")}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {contentKinds.map((kind) => {
            const Icon = icons[kind]
            return (
              <Link
                key={kind}
                href={`/contents/${kind}/new`}
                className="group flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">
                    {t("new", { kind: t(`kindSingular.${kind}`) })}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {t(`kinds.${kind}`)}
                  </span>
                </span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function ContentStat({
  kind,
  total,
  label,
}: {
  kind: ContentKind
  total: number
  label: string
}) {
  const Icon = icons[kind]
  return (
    <Link
      href={`/contents/${kind}`}
      className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
      <p className="mt-5 text-3xl font-bold tabular-nums">
        {total.toLocaleString()}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </Link>
  )
}

function dashboardDate(value?: string) {
  const today = new Date(Date.now() + 7 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10)
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? today
    : value
}
