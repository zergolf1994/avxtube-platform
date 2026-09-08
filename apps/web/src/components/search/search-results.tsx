import type { SearchResponse } from "@workspace/core/types"
import type { Locale } from "@workspace/i18n/config"
import { BadgeCheck, Clapperboard } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PlaylistShelf } from "@/components/home/playlist-shelf"
import { ChannelImage } from "@/components/channel/channel-image"
import { TrendingShortsCarousel } from "@/components/trending/trending-shorts-carousel"
import { VideoGrid } from "@/components/video"
import { Link } from "@/i18n/navigation"

export async function SearchResults({
  result,
  query,
  locale,
}: {
  result: Omit<SearchResponse, "total">
  query: string
  locale: Locale
}) {
  const [t, videoT] = await Promise.all([
    getTranslations({ locale, namespace: "video.search" }),
    getTranslations({ locale, namespace: "video" }),
  ])
  const empty =
    !result.videos.length &&
    !result.shorts.length &&
    !result.actors.length &&
    !result.playlists.length

  return (
    <div className="mt-2">
      {result.actors.length ? (
        <section className="border-b py-6">
          <h2 className="mb-5 text-xl font-bold">{t("actors")}</h2>
          <div className="flex gap-6 overflow-x-auto pb-3">
            {result.actors.map((actor) => (
              <Link
                key={actor.id}
                href={`/actor/${actor.handle.replace(/^@/, "")}`}
                className="w-28 shrink-0 text-center"
              >
                <ChannelImage
                  src={actor.coverUrl}
                  kind={actor.kind}
                  gender={actor.gender}
                  alt={actor.name}
                  className="mx-auto aspect-square w-24 rounded-full object-cover"
                />
                <span className="mt-2 flex items-center justify-center gap-1 text-sm font-semibold">
                  <span className="truncate">{actor.name}</span>
                  {actor.verified ? (
                    <BadgeCheck className="size-3.5 shrink-0 text-primary" />
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {result.videos.length ? (
        <section className="py-6">
          <div className="mb-5 flex items-center gap-2">
            <Clapperboard className="size-5 text-primary" />
            <h2 className="text-lg font-bold">{t("videos")}</h2>
          </div>
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
        </section>
      ) : null}
      {result.shorts.length ? (
        <TrendingShortsCarousel shorts={result.shorts.slice(0, 15)} />
      ) : null}
      {result.playlists.length ? (
        <PlaylistShelf playlists={result.playlists} />
      ) : null}
      {empty ? (
        <div className="flex min-h-[42vh] flex-col items-center justify-center text-center">
          <h2 className="text-xl font-bold">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {t("emptyDescription", { query })}
          </p>
        </div>
      ) : null}
    </div>
  )
}
