import type { Locale } from "@workspace/i18n/config"
import { getVideosPage } from "@workspace/services/queries/video"
import { CalendarDays, Clapperboard } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { VideoGrid } from "@/components/video"
import { createPageMetadata } from "@/i18n/metadata"

import { ReleaseControls } from "./release-controls"
import { ReleasePager } from "./release-pager"

const PAGE_SIZE = 24
type ReleaseSort = "releaseDate" | "latest" | "trending"
type ActressFilter = "all" | "single" | "multiple"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "video.release" })
  return createPageMetadata({
    locale,
    pathname: "/release",
    title: t("title"),
    description: t("description"),
  })
}

export default async function ReleasePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{
    page?: string | string[]
    actress?: string | string[]
    sort?: string | string[]
  }>
}) {
  const [{ locale }, rawSearch, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("video"),
  ])
  const page = positivePage(first(rawSearch.page))
  const actress = actressFilter(first(rawSearch.actress))
  const sort = releaseSort(first(rawSearch.sort))
  const result = await getVideosPage(
    (page - 1) * PAGE_SIZE,
    PAGE_SIZE,
    sort === "latest" ? undefined : sort,
    locale,
    actress
  ).catch(() => ({ items: [], nextCursor: null, total: 0 }))
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const labels = {
    views: (count: string) => t("views", { count }),
    published: (date: string) => t("published", { date }),
    moreOptions: t("moreOptions"),
    verified: t("verified"),
  }

  return (
    <div className="space-y-7 pb-10">
      <header className="relative isolate overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background px-5 py-7 sm:px-7 sm:py-9">
        <div className="absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex max-w-2xl items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <CalendarDays className="size-6" />
          </span>
          <div>
            <p className="mb-1 text-xs font-bold tracking-[0.18em] text-primary uppercase">
              {t("release.eyebrow")}
            </p>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {t("release.title")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {t("release.description")}
            </p>
          </div>
        </div>
      </header>

      <ReleaseControls
        actress={actress}
        sort={sort}
        labels={{
          filter: t("release.filter"),
          all: t("release.all"),
          singleActress: t("release.singleActress"),
          multipleActresses: t("release.multipleActresses"),
          sort: t("release.sort"),
          releaseDate: t("release.sorts.releaseDate"),
          latest: t("release.sorts.latest"),
          trending: t("release.sorts.trending"),
          resultCount: t("release.resultCount", { count: result.total }),
        }}
      />

      <section aria-labelledby="release-results">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clapperboard className="size-5 text-primary" />
            <h2 id="release-results" className="text-lg font-bold">
              {t("release.results")}
            </h2>
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("release.pageStatus", {
              page,
              total: pageCount,
            })}
          </p>
        </div>

        {result.items.length ? (
          <VideoGrid videos={result.items} locale={locale} labels={labels} />
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 text-center">
            <span className="mb-4 grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <Clapperboard className="size-6" />
            </span>
            <p className="text-sm font-medium text-muted-foreground">
              {t("release.empty")}
            </p>
          </div>
        )}
      </section>

      {pageCount > 1 ? (
        <div className="rounded-2xl border bg-card px-3 py-4 sm:px-5">
          <ReleasePager
            page={page}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
          />
        </div>
      ) : null}
    </div>
  )
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function positivePage(value?: string) {
  return Math.max(1, Number.parseInt(value ?? "1", 10) || 1)
}

function releaseSort(value?: string): ReleaseSort {
  return value === "latest" || value === "trending" ? value : "releaseDate"
}

function actressFilter(value?: string): ActressFilter {
  return value === "single" || value === "multiple" ? value : "all"
}
