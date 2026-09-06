import type { Locale } from "@workspace/i18n/config"
import {
  getActors,
  getShortsPage,
  getVideosPage,
} from "@workspace/services/queries/video"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@workspace/ui/components"
import { BadgeCheck, Flame, UsersRound } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { ChannelImage } from "@/components/channel/channel-image"
import { TrendingShortsCarousel } from "@/components/trending/trending-shorts-carousel"
import { TrendingVideoFeed } from "@/components/trending/trending-video-feed"
import { Link } from "@/i18n/navigation"
import { createPageMetadata } from "@/i18n/metadata"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "video.trending" })
  return createPageMetadata({
    locale,
    pathname: "/trending",
    title: t("title"),
    description: t("description"),
  })
}

export default async function TrendingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const [actorsResult, shortsResult, videosResult, t] = await Promise.all([
    getActors().catch(() => ({ actors: [], total: 0 })),
    getShortsPage(1, 10).catch(() => ({
      items: [],
      page: 1,
      pageSize: 10,
      nextPage: null,
      total: 0,
    })),
    getVideosPage(0, 8, "trending", locale).catch(() => ({
      items: [],
      nextCursor: null,
      total: 0,
    })),
    getTranslations({ locale, namespace: "video" }),
  ])
  const actors = actorsResult.actors
    .filter((actor) => actor.followerCount > 0)
    .sort((left, right) => right.followerCount - left.followerCount)
  const shorts = shortsResult.items
    .filter((short) => short.viewCount > 0)
    .sort((left, right) => right.viewCount - left.viewCount)
  const hasTrending =
    actors.length > 0 || shorts.length > 0 || videosResult.items.length > 0

  return (
    <div className="space-y-10 pb-8">
      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <Flame className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            {t("trending.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("trending.description")}
          </p>
        </div>
      </header>
      {actors.length ? (
        <section aria-labelledby="trending-actors">
          <div className="mb-5 flex items-center gap-2">
            <UsersRound className="size-5 text-primary" />
            <h2 id="trending-actors" className="text-xl font-bold">
              {t("trending.actors")}
            </h2>
          </div>
          <Carousel
            opts={{ align: "start", slidesToScroll: "auto" }}
            className="mx-10 sm:mx-11"
          >
            <CarouselContent className="-ml-3">
              {actors.map((actor) => (
                <CarouselItem
                  key={actor.id}
                  className="basis-1/3 pl-3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 2xl:basis-[14.285%]"
                >
                  <article className="group text-center">
                    <Link
                      href={`/channel/${actor.handle.replace(/^@/, "")}`}
                      className="mx-auto block w-full max-w-36"
                    >
                      <span className="relative block aspect-square overflow-hidden rounded-full bg-muted ring-2 ring-transparent transition-all group-hover:ring-primary group-hover:ring-offset-2 group-hover:ring-offset-background">
                        <ChannelImage
                          src={actor.coverUrl}
                          kind={actor.kind}
                          gender={actor.gender}
                          alt={actor.name}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </span>
                      <span className="mt-3 flex items-center justify-center gap-1">
                        <span className="line-clamp-1 text-sm font-semibold group-hover:text-primary">
                          {actor.name}
                        </span>
                        {actor.verified ? (
                          <BadgeCheck className="size-3.5 shrink-0 text-primary" />
                        ) : null}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("followers", {
                          count: Intl.NumberFormat(locale, {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(actor.followerCount),
                        })}
                      </span>
                    </Link>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious
              aria-label={t("trending.previousActors")}
              className="-left-10"
            />
            <CarouselNext
              aria-label={t("trending.nextActors")}
              className="-right-10"
            />
          </Carousel>
        </section>
      ) : null}
      {shorts.length ? <TrendingShortsCarousel shorts={shorts} /> : null}
      {videosResult.items.length ? (
        <TrendingVideoFeed initialPage={videosResult} />
      ) : null}
      {!hasTrending ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          {t("trending.empty")}
        </div>
      ) : null}
    </div>
  )
}
