import type {
  PublicTermTaxonomy,
  TermDetailResponse,
} from "@workspace/core/types"
import type { Locale } from "@workspace/i18n/config"
import { Clapperboard, FolderOpen, Hash } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PathPager } from "@/components/pagination/path-pager"
import { VideoGrid } from "@/components/video"

export async function TermVideos({
  taxonomy,
  locale,
  page,
  pageSize,
  result,
}: {
  taxonomy: PublicTermTaxonomy
  locale: Locale
  page: number
  pageSize: number
  result: TermDetailResponse
}) {
  const [t, videoT] = await Promise.all([
    getTranslations({ locale, namespace: "video.taxonomy" }),
    getTranslations({ locale, namespace: "video" }),
  ])
  const Icon = taxonomy === "category" ? FolderOpen : Hash
  const path = `/${taxonomy}/${result.term.slug}`
  const pageCount = Math.max(1, Math.ceil(result.total / pageSize))

  return (
    <div className="space-y-7 pb-10">
      <header className="rounded-2xl border bg-card px-5 py-7 sm:px-7">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
              {t(`${taxonomy}.single`)}
            </p>
            <h1 className="mt-1 text-2xl font-black break-words sm:text-3xl">
              {result.term.name}
            </h1>
            {result.term.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {result.term.description}
              </p>
            ) : null}
            <p className="mt-3 text-xs font-semibold text-muted-foreground">
              {t("videoCount", { count: result.total })}
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="term-videos">
        <div className="mb-5 flex items-center gap-2">
          <Clapperboard className="size-5 text-primary" />
          <h2 id="term-videos" className="text-lg font-bold">
            {t("videos")}
          </h2>
        </div>
        {result.videos.length ? (
          <VideoGrid
            videos={result.videos}
            locale={locale}
            labels={{
              views: (count) => videoT("views", { count }),
              published: (date) => videoT("published", { date }),
              moreOptions: videoT("moreOptions"),
              verified: videoT("verified"),
            }}
          />
        ) : (
          <div className="rounded-2xl border border-dashed px-6 py-20 text-center text-sm text-muted-foreground">
            {t("emptyVideos")}
          </div>
        )}
      </section>

      {pageCount > 1 ? (
        <div className="rounded-2xl border bg-card px-3 py-4 sm:px-5">
          <PathPager
            path={path}
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
          />
        </div>
      ) : null}
    </div>
  )
}
