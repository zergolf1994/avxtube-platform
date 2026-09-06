import type { Locale } from "@workspace/i18n/config"
import {
  searchContentResults,
  searchContentCount,
} from "@workspace/services/queries/video"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { Search } from "lucide-react"
import {
  SearchFilterControls,
  type SearchFilterState,
} from "@/components/search/search-filter-controls"
import { SearchResults } from "@/components/search/search-results"
import { createPageMetadata } from "@/i18n/metadata"

import { SearchPager } from "./search-pager"

const PAGE_SIZE = 24

export const dynamic = "force-dynamic"
function value(
  params: Record<string, string | string[] | undefined>,
  key: string,
  fallback: string
) {
  const current = params[key]
  return (Array.isArray(current) ? current[0] : current) ?? fallback
}

type SearchPageProps = {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps) {
  const [{ locale }, raw, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("video.search"),
  ])
  const query = value(raw, "q", "").trim()
  const metadata = await createPageMetadata({
    locale,
    pathname: "/search",
    title: query ? `${t("resultLabel")}: ${query}` : t("allVideos"),
  })
  return { ...metadata, robots: { index: false, follow: true } }
}

export default async function SearchPage({
  params,
  searchParams,
}: SearchPageProps) {
  const [{ locale }, raw, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("video.search"),
  ])
  const state: SearchFilterState = {
    q: value(raw, "q", ""),
    sort: value(raw, "sort", "relevance"),
  }
  const page = positivePage(value(raw, "page", "1"))
  const result = await searchContentResults(
    { ...state, page: String(page), limit: String(PAGE_SIZE) },
    locale
  ).catch(() => ({
    videos: [],
    shorts: [],
    actors: [],
    playlists: [],
    total: 0,
    contentTotal: 0,
  }))
  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-7 pb-10">
      <header className="relative isolate overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background px-5 py-7 sm:px-7 sm:py-9">
        <div className="absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Search className="size-6" />
          </span>
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
              {t("resultLabel")}
            </p>
            <h1 className="mt-2 line-clamp-2 text-2xl font-bold tracking-tight break-words sm:text-3xl">
              {state.q ? `“${state.q}”` : t("allVideos")}
            </h1>
            <p
              className="mt-2 text-sm font-medium text-muted-foreground"
              aria-live="polite"
            >
              <Suspense
                key={JSON.stringify(state)}
                fallback={<span aria-hidden="true">…</span>}
              >
                <SearchResultCount
                  state={state}
                  locale={locale}
                  total={result.total}
                />
              </Suspense>
            </p>
          </div>
        </div>
      </header>
      <SearchFilterControls key={`${state.q}:${state.sort}`} state={state} />
      <SearchResults result={result} query={state.q} locale={locale} />
      <Suspense fallback={<div className="h-20 rounded-2xl border bg-card" />}>
        <SearchPagination
          state={state}
          locale={locale}
          page={page}
          contentTotal={result.contentTotal}
        />
      </Suspense>
    </div>
  )
}

async function SearchPagination({
  state,
  locale,
  page,
  contentTotal,
}: {
  state: SearchFilterState
  locale: Locale
  page: number
  contentTotal?: number
}) {
  const total =
    contentTotal ??
    (await searchContentCount(state, locale)
      .then((result) => result.contentTotal ?? result.total)
      .catch(() => 0))
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pageCount <= 1) return null
  return (
    <div className="rounded-2xl border bg-card px-3 py-4 sm:px-5">
      <SearchPager page={page} pageCount={pageCount} pageSize={PAGE_SIZE} />
    </div>
  )
}

function positivePage(value: string) {
  return Math.max(1, Number.parseInt(value, 10) || 1)
}

async function SearchResultCount({
  state,
  locale,
  total,
}: {
  state: SearchFilterState
  locale: Locale
  total?: number
}) {
  const t = await getTranslations({ locale, namespace: "video.search" })
  const count =
    total ??
    (await searchContentCount(state, locale)
      .then((result) => result.total)
      .catch(() => null))
  // A count failure must not replace valid search results or claim zero matches.
  return count === null ? null : t("resultCount", { count })
}
