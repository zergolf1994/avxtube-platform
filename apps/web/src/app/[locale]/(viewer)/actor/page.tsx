import type { Locale } from "@workspace/i18n/config"
import { getActors } from "@workspace/services/queries/video"
import { BadgeCheck, UsersRound } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { FollowActorButton } from "@/components/actor/follow-actor-button"
import { ChannelImage } from "@/components/channel/channel-image"
import { PathPager } from "@/components/pagination/path-pager"
import { createPageMetadata } from "@/i18n/metadata"
import { Link } from "@/i18n/navigation"

const PAGE_SIZE = 48

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "video" })
  return createPageMetadata({
    locale,
    pathname: "/actor",
    title: t("actorsTitle"),
    description: t("actorsDescription"),
  })
}

export default async function ActorDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const [query, t] = await Promise.all([searchParams, getTranslations("video")])
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)
  const result = await getActors((page - 1) * PAGE_SIZE, PAGE_SIZE).catch(
    () => ({ actors: [], total: 0, nextCursor: null })
  )
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))

  return (
    <div className="space-y-7 pb-10">
      <header className="relative isolate overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background px-5 py-7 sm:px-7 sm:py-9">
        <div className="absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <UsersRound className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">
              {t("actorsTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("actorsDescription")}
            </p>
            <p className="mt-3 text-xs font-semibold text-primary">
              {t("actorCount", { count: result.total })}
            </p>
          </div>
        </div>
      </header>

      {result.actors.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.actors.map((actor) => (
            <article
              key={actor.id}
              className="flex items-center gap-4 rounded-2xl border bg-card p-4"
            >
              <Link href={`/actor/${actor.handle.replace(/^@/, "")}`}>
                <ChannelImage
                  src={actor.coverUrl}
                  kind={actor.kind}
                  gender={actor.gender}
                  alt={actor.name}
                  className="size-20 rounded-full object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/actor/${actor.handle.replace(/^@/, "")}`}
                  className="flex items-center gap-1 font-bold hover:text-primary"
                >
                  <span className="truncate">{actor.name}</span>
                  {actor.verified ? <BadgeCheck className="size-4" /> : null}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {actor.handle}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("followers", {
                    count: Intl.NumberFormat(undefined, {
                      notation: "compact",
                    }).format(actor.followerCount),
                  })}
                </p>
              </div>
              <FollowActorButton
                channelId={actor.id}
                initialFollowing={actor.isFollowing}
              />
            </article>
          ))}
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed px-6 py-20 text-center text-sm text-muted-foreground">
          {t("actorsDescription")}
        </div>
      )}

      {pageCount > 1 ? (
        <div className="rounded-2xl border bg-card px-3 py-4 sm:px-5">
          <PathPager
            path="/actor"
            page={page}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
          />
        </div>
      ) : null}
    </div>
  )
}
