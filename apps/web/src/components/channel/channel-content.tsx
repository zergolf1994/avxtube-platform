/* eslint-disable @next/next/no-img-element */
import type { ChannelDetailResponse } from "@workspace/core/types"
import {
  BarChart3,
  CalendarDays,
  ExternalLink,
  Heart,
  MessageCircle,
  MoreVertical,
} from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PlaylistShelf } from "@/components/home/playlist-shelf"
import { TrendingShortsCarousel } from "@/components/trending/trending-shorts-carousel"
import { VideoGrid } from "@/components/video"
import type { ChannelTabId } from "@/lib/channel-tabs"

export async function ChannelContent({
  data,
  activeTab,
  locale,
}: {
  data: ChannelDetailResponse
  activeTab: ChannelTabId
  locale: string
}) {
  const t = await getTranslations({ locale, namespace: "video" })
  const channelT = await getTranslations({ locale, namespace: "video.channel" })
  const labels = {
    views: (count: string) => t("views", { count }),
    published: (date: string) => t("published", { date }),
    moreOptions: t("moreOptions"),
    verified: t("verified"),
  }

  if (activeTab === "videos")
    return (
      <section className="py-7">
        <h2 className="mb-5 text-xl font-bold">{channelT("allVideos")}</h2>
        <VideoGrid
          videos={data.videos}
          locale={locale}
          labels={labels}
          hideAvatar
        />
      </section>
    )
  if (activeTab === "shorts")
    return (
      <div className="py-7">
        <TrendingShortsCarousel shorts={data.shorts} />
      </div>
    )
  if (activeTab === "playlists")
    return (
      <div className="py-2">
        <PlaylistShelf playlists={data.playlists} />
      </div>
    )
  if (activeTab === "courses")
    return <ChannelCourses data={data} locale={locale} />
  if (activeTab === "posts") return <ChannelPosts data={data} locale={locale} />
  if (activeTab === "about") return <ChannelAbout data={data} locale={locale} />

  return (
    <div className="space-y-8 py-7">
      <section>
        <h2 className="mb-5 text-xl font-bold">{channelT("forYou")}</h2>
        <VideoGrid
          videos={data.videos.slice(0, 8)}
          locale={locale}
          labels={labels}
          hideAvatar
        />
      </section>
      {data.channel.enabledTabs.includes("shorts") && data.shorts.length ? (
        <TrendingShortsCarousel shorts={data.shorts} />
      ) : null}
      {data.channel.enabledTabs.includes("courses") && data.courses.length ? (
        <ChannelCourses data={data} locale={locale} compact />
      ) : null}
      {data.channel.enabledTabs.includes("playlists") &&
      data.playlists.length ? (
        <PlaylistShelf playlists={data.playlists} />
      ) : null}
    </div>
  )
}

async function ChannelCourses({
  data,
  locale,
  compact = false,
}: {
  data: ChannelDetailResponse
  locale: string
  compact?: boolean
}) {
  const t = await getTranslations({ locale, namespace: "video.channel" })
  return (
    <section className={compact ? "border-t pt-7" : "py-7"}>
      <h2 className="mb-5 text-xl font-bold">{t("courses")}</h2>
      {data.courses.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.courses.map((course) => (
            <article
              key={course.id}
              className="overflow-hidden rounded-xl border bg-card"
            >
              <div className="aspect-video overflow-hidden bg-muted">
                <img
                  src={course.thumbnailUrl}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 font-bold">{course.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {course.description}
                </p>
                <p className="mt-3 text-xs font-semibold text-primary">
                  {t("lessonCount", { count: course.lessonCount })}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState text={t("emptyCourses")} />
      )}
    </section>
  )
}

async function ChannelPosts({
  data,
  locale,
}: {
  data: ChannelDetailResponse
  locale: string
}) {
  const t = await getTranslations({ locale, namespace: "video.channel" })
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  })
  return (
    <section className="mx-auto max-w-2xl space-y-6 py-8">
      {data.posts.length ? (
        data.posts.map((post) => (
          <article key={post.id} className="rounded-2xl border bg-card p-5">
            <header className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-xs font-bold text-background">
                {data.channel.avatarUrl ? (
                  <img
                    src={data.channel.avatarUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  data.channel.name.slice(0, 1)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {data.channel.name}{" "}
                  <span className="ml-1 font-normal text-muted-foreground">
                    {date.format(new Date(post.publishedAt))}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-6 whitespace-pre-line">
                  {post.message}
                </p>
              </div>
              <button type="button" aria-label={t("moreOptions")}>
                <MoreVertical className="size-5" />
              </button>
            </header>
            {post.imageUrl ? (
              <div className="mt-4 overflow-hidden rounded-xl">
                <img
                  src={post.imageUrl}
                  alt=""
                  className="max-h-[520px] w-full object-cover"
                />
              </div>
            ) : null}
            <footer className="mt-4 flex gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Heart className="size-5" />
                {post.likeCount}
              </span>
              <span className="flex items-center gap-2">
                <MessageCircle className="size-5" />
                {post.commentCount}
              </span>
            </footer>
          </article>
        ))
      ) : (
        <EmptyState text={t("emptyPosts")} />
      )}
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

async function ChannelAbout({
  data,
  locale,
}: {
  data: ChannelDetailResponse
  locale: string
}) {
  const t = await getTranslations({ locale, namespace: "video.channel" })
  const number = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  })
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(data.channel.joinedAt))
  const metadata = data.channel.metadata
  const profileItems =
    (data.channel.kind === "person"
      ? metadata?.genres
      : data.channel.kind === "organization"
        ? metadata?.specialties
        : metadata?.topics) ?? []

  return (
    <section className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h2 className="text-xl font-bold">{t("about")}</h2>
        <p className="mt-5 max-w-3xl text-sm leading-7 whitespace-pre-line text-muted-foreground">
          {data.channel.description}
        </p>
        {profileItems.length ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {profileItems.map((item) => (
              <span
                key={item}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
        {data.channel.links.length ? (
          <div className="mt-7 border-t pt-5">
            <h3 className="font-bold">{t("links")}</h3>
            {data.channel.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <ExternalLink className="size-4" />
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <aside>
        <h2 className="border-b pb-4 text-xl font-bold">{t("stats")}</h2>
        <dl className="divide-y text-sm">
          <div className="flex items-center gap-3 py-4">
            <CalendarDays className="size-4 text-muted-foreground" />
            <dt className="sr-only">{t("joined")}</dt>
            <dd>{t("joinedDate", { date })}</dd>
          </div>
          <div className="flex items-center gap-3 py-4">
            <BarChart3 className="size-4 text-muted-foreground" />
            <dt className="sr-only">{t("totalViews")}</dt>
            <dd>
              {t("viewCount", { count: number.format(data.channel.viewCount) })}
            </dd>
          </div>
        </dl>
      </aside>
    </section>
  )
}
