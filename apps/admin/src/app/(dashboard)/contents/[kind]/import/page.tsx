import { ArrowLeft, Search, X } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Button, Input, buttonVariants } from "@workspace/ui/components"
import { getQueueImports } from "@/lib/admin-api"
import type { QueueImportStatus } from "@/lib/queue-import"

import { SitemapImportForm } from "./sitemap-import-form"
import { QueuePager } from "./queue-pager"
import { QueueRefreshButton } from "./queue-refresh-button"
import { RetryQueueImportButton } from "./retry-queue-import-button"
import { QueueStatusFilter } from "./queue-status-filter"

const QUEUE_STATUSES: QueueImportStatus[] = [
  "pending",
  "processing",
  "completed",
  "failed",
]

export default async function SitemapImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>
  searchParams: Promise<{
    page?: string | string[]
    status?: string | string[]
    q?: string | string[]
  }>
}) {
  const [{ kind }, rawSearch, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("admin.sitemapImport"),
  ])
  if (kind !== "video") notFound()
  const rawPage = Array.isArray(rawSearch.page)
    ? rawSearch.page[0]
    : rawSearch.page
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)
  const rawStatus = Array.isArray(rawSearch.status)
    ? rawSearch.status[0]
    : rawSearch.status
  const status = QUEUE_STATUSES.includes(rawStatus as QueueImportStatus)
    ? (rawStatus as QueueImportStatus)
    : undefined
  const rawQuery = Array.isArray(rawSearch.q) ? rawSearch.q[0] : rawSearch.q
  const query = rawQuery?.trim().slice(0, 400) ?? ""
  const queue = await getQueueImports({ page, limit: 100, status, query })
  const clearQuery = status ? `?status=${encodeURIComponent(status)}` : ""

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Link
          href="/contents/video"
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
      </header>

      <SitemapImportForm />

      <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-4 border-b px-5 py-4">
          <form
            action="/contents/video/import"
            className="flex max-w-2xl gap-2"
          >
            {status ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="outline">
              <Search className="size-4" />
              {t("search")}
            </Button>
            {query ? (
              <Link
                href={`/contents/video/import${clearQuery}`}
                className={buttonVariants({ variant: "ghost", size: "icon" })}
                aria-label={t("clearSearch")}
              >
                <X className="size-4" />
              </Link>
            ) : null}
          </form>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">{t("queueTitle")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("queueTotal", { count: queue.total })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <QueueRefreshButton />
              <QueueStatusFilter value={status} />
            </div>
          </div>
        </div>
        {queue.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">{t("dvdId")}</th>
                  <th className="px-5 py-3 font-medium">{t("source")}</th>
                  <th className="px-5 py-3 font-medium">{t("statusLabel")}</th>
                  <th className="px-5 py-3 font-medium">{t("worker")}</th>
                  <th className="px-5 py-3 font-medium">{t("created")}</th>
                  <th className="px-5 py-3 font-medium">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {queue.items.map((item) => (
                  <tr key={item._id}>
                    <td className="max-w-80 px-5 py-3">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-medium hover:underline"
                        title={item.url}
                      >
                        {item.dvdId}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {item.ref}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex max-w-64 flex-col items-start gap-1.5">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                          {t(`status.${item.status}`)}
                        </span>
                        {item.status === "failed" && item.error ? (
                          <span
                            className="line-clamp-2 text-xs text-destructive"
                            title={item.error}
                          >
                            {item.error}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-56 px-5 py-3 text-xs text-muted-foreground">
                      {item.workerId ? (
                        <span className="block truncate" title={item.workerId}>
                          {item.workerId}
                        </span>
                      ) : item.status === "processing" ? (
                        t("workerUnknown")
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Bangkok",
                      }).format(new Date(item.createdAt))}
                    </td>
                    <td className="px-5 py-3">
                      {item.status === "failed" ? (
                        <RetryQueueImportButton id={item._id} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            {t(query ? "searchEmpty" : "queueEmpty")}
          </p>
        )}
      </section>
      {queue.totalPages > 1 ? (
        <QueuePager
          page={queue.page}
          pageCount={queue.totalPages}
          pageSize={queue.limit}
        />
      ) : null}
    </div>
  )
}
