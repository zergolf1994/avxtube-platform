import type { Locale } from "@workspace/i18n/config"
import { getVideosPage } from "@workspace/services/queries/video"
import { Clock3 } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { VideoGrid } from "@/components/video"
import { createPageMetadata } from "@/i18n/metadata"

import { LatestPager } from "./latest-pager"

const PAGE_SIZE = 24

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "video.latest" })
  return createPageMetadata({
    locale,
    pathname: "/latest",
    title: t("title"),
    description: t("description"),
  })
}

export default async function LatestVideosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const [{ locale }, rawSearch, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("video"),
  ])
  const rawPage = Array.isArray(rawSearch.page)
    ? rawSearch.page[0]
    : rawSearch.page
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)
  const result = await getVideosPage(
    (page - 1) * PAGE_SIZE,
    PAGE_SIZE,
    undefined,
    locale
  ).catch(() => ({ items: [], nextCursor: null, total: 0 }))
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const labels = {
    views: (count: string) => t("views", { count }),
    published: (date: string) => t("published", { date }),
    moreOptions: t("moreOptions"),
    verified: t("verified"),
  }

  return (
    <div className="space-y-8 pb-8">
      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <Clock3 className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            {t("latest.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("latest.description")}
          </p>
        </div>
      </header>

      {result.items.length ? (
        <VideoGrid videos={result.items} locale={locale} labels={labels} />
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          {t("latest.empty")}
        </div>
      )}

      {pageCount > 1 ? (
        <LatestPager page={page} pageCount={pageCount} pageSize={PAGE_SIZE} />
      ) : null}
    </div>
  )
}
