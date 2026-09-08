"use client"

import type { Playlist, Video, WatchData } from "@workspace/core/types"
import { authClient } from "@workspace/auth/client"
import { BadgeCheck, MessageCircle, X } from "lucide-react"
import { useTranslations } from "next-intl"
import * as React from "react"

import { FollowActorButton } from "@/components/actor/follow-actor-button"
import { VideoListCard } from "@/components/video"
import { Link } from "@/i18n/navigation"

import { VideoActions } from "./video-actions"
import { WatchComments } from "./watch-comments"
import { WatchPlayer } from "./watch-player"
import { WatchPlaylistPanel } from "./watch-playlist-panel"

export function WatchExperience({
  data,
  locale,
  playlist,
}: {
  data: WatchData
  locale: string
  playlist?: Playlist | null
}) {
  const t = useTranslations("video")
  const { data: session } = authClient.useSession()
  const userId = session?.user?.id
  const [theater, setTheater] = React.useState(false)
  const [autoplay, setAutoplay] = React.useState(true)
  const [mobileCommentsOpen, setMobileCommentsOpen] = React.useState(false)
  const [detailsExpanded, setDetailsExpanded] = React.useState(false)
  const toggleTheater = React.useCallback(
    () => setTheater((value) => !value),
    []
  )
  const { video } = data
  React.useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    fetch(`/api/v1/videos/${encodeURIComponent(video.id)}/history`, {
      method: "POST",
      signal: controller.signal,
    }).catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        console.error("[watch-history]", error)
    })
    return () => controller.abort()
  }, [userId, video.id])
  const related = data.relatedVideos.slice(0, 20)
  const views = Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(video.viewCount)
  const releaseDate = video.releaseDate
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Bangkok",
      }).format(new Date(video.releaseDate))
    : null
  const channelHref = video.channel
    ? `/channel/${video.channel.handle.replace(/^@/, "")}`
    : null
  const playlistIndex = playlist
    ? Math.max(
        0,
        playlist.items.findIndex((item) => item.id === video.id)
      ) + 1
    : null

  const player = (
    <div className="sticky top-[var(--watch-player-top,4rem)] z-30 transition-[top] duration-200 lg:static">
      <WatchPlayer
        video={video}
        theater={theater}
        onTheater={toggleTheater}
        playlist={
          playlist && playlistIndex
            ? { id: playlist.id, index: playlistIndex }
            : null
        }
      />
    </div>
  )
  const details = (
    <div className="px-3 sm:px-0">
      <h1 className="mt-4 line-clamp-2 text-lg font-bold tracking-tight sm:text-2xl">
        {video.title}
      </h1>
      <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        {video.channel && channelHref ? (
          <div className="flex items-center gap-3">
            <Link
              href={channelHref}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background sm:size-11"
            >
              {initials(video.channel.name)}
            </Link>
            <div className="min-w-0">
              <Link
                href={channelHref}
                className="flex items-center gap-1 font-semibold hover:text-primary"
              >
                <span className="truncate">{video.channel.name}</span>
                {video.channel.verified ? (
                  <BadgeCheck className="size-4 shrink-0" />
                ) : null}
              </Link>
              <p className="text-xs text-muted-foreground">
                {video.channel.handle}
              </p>
            </div>
            <FollowActorButton channelId={video.channel.id} />
          </div>
        ) : null}
        <VideoActions video={video} locale={locale} />
      </div>
      <div className="mt-5 rounded-xl bg-muted/60 p-4">
        <p className="font-semibold">
          {t("views", { count: views })}
          {releaseDate ? ` • ${releaseDate}` : ""}
        </p>
        <p
          className={`mt-3 text-sm leading-6 whitespace-pre-line ${detailsExpanded ? "" : "line-clamp-3"}`}
        >
          {video.description}
        </p>
        {detailsExpanded ? <VideoDetails video={video} /> : null}
        <button
          type="button"
          aria-expanded={detailsExpanded}
          onClick={() => setDetailsExpanded((value) => !value)}
          className="mt-2 text-sm font-semibold"
        >
          {t(detailsExpanded ? "showLess" : "showMore")}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setMobileCommentsOpen(true)}
        className="mt-4 flex w-full items-center justify-between rounded-xl bg-muted/60 p-4 text-left sm:hidden"
      >
        <span>
          <strong>{t("comments", { count: data.commentsTotal })}</strong>
          <span className="mt-1 block text-xs text-muted-foreground">
            {data.comments[0]?.message}
          </span>
        </span>
        <MessageCircle className="size-5 shrink-0" />
      </button>
      <div className="hidden sm:block">
        <WatchComments
          videoId={video.id}
          initialComments={data.comments}
          initialNextCursor={data.commentsNextCursor}
          initialTotal={data.commentsTotal}
          locale={locale}
        />
      </div>
      {mobileCommentsOpen ? (
        <div
          className="fixed inset-0 z-[80] bg-black/55 sm:hidden"
          onClick={() => setMobileCommentsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t("comments", { count: data.commentsTotal })}
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-x-0 bottom-0 max-h-[80svh] overflow-y-auto rounded-t-2xl bg-background p-4 text-foreground"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <button
              type="button"
              onClick={() => setMobileCommentsOpen(false)}
              aria-label={t("shorts.close")}
              className="absolute top-3 right-3 rounded-full p-2 hover:bg-muted"
            >
              <X className="size-5" />
            </button>
            <WatchComments
              videoId={video.id}
              initialComments={data.comments}
              initialNextCursor={data.commentsNextCursor}
              initialTotal={data.commentsTotal}
              locale={locale}
            />
          </section>
        </div>
      ) : null}
    </div>
  )
  const next = (
    <aside className="min-w-0">
      {playlist ? (
        <WatchPlaylistPanel playlist={playlist} activeVideoId={video.id} />
      ) : null}
      <div className="mb-3 flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:px-0 xl:hidden">
        {["all", "creators", "music", "technology"].map((category) => (
          <button
            key={category}
            type="button"
            className="shrink-0 rounded-lg bg-muted px-4 py-2 text-sm font-semibold first:bg-foreground first:text-background"
          >
            {t(`home.categories.${category}`)}
          </button>
        ))}
      </div>
      <div className="mb-4 hidden items-center justify-between xl:flex">
        <h2 className="text-lg font-bold">{t("upNext")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <span>{t("autoplay")}</span>
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(event) => setAutoplay(event.target.checked)}
          />
        </label>
      </div>
      <div className="divide-y sm:space-y-4 sm:divide-y-0">
        {related.map((item) => (
          <VideoListCard
            key={item.id}
            video={item}
            viewsLabel={t("views", {
              count: Intl.NumberFormat(locale, {
                notation: "compact",
              }).format(item.viewCount),
            })}
          />
        ))}
      </div>
    </aside>
  )

  if (theater)
    return (
      <div className="space-y-7">
        {player}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          {details}
          {next}
        </div>
      </div>
    )
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-6">
      <div className="contents xl:block">
        {player}
        {details}
      </div>
      {next}
    </div>
  )
}

function VideoDetails({ video }: { video: Video }) {
  const t = useTranslations("video")
  const groups = [
    {
      key: "actors",
      label: t("detailsActors"),
      items: (video.actors ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        href: `/actor/${item.handle.replace(/^@/, "")}`,
      })),
    },
    {
      key: "directors",
      label: t("detailsDirectors"),
      items: (video.directors ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        href: `/channel/${item.handle.replace(/^@/, "")}`,
      })),
    },
    {
      key: "studios",
      label: t("detailsStudios"),
      items: (video.studios ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        href: `/channel/${item.handle.replace(/^@/, "")}`,
      })),
    },
    {
      key: "categories",
      label: t("detailsCategories"),
      items: (video.categories ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        href: `/category/${encodeURIComponent(item.slug)}`,
      })),
    },
    {
      key: "tags",
      label: t("detailsTags"),
      items: (video.tags ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        href: `/tag/${encodeURIComponent(item.slug)}`,
      })),
    },
    {
      key: "labels",
      label: t("detailsLabels"),
      items: (video.labels ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        href: `/search?q=${encodeURIComponent(item.name)}`,
      })),
    },
    {
      key: "series",
      label: t("detailsSeries"),
      items: (video.series ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        href: `/search?q=${encodeURIComponent(item.name)}`,
      })),
    },
  ].filter((group) => group.items.length)

  if (!groups.length) return null
  return (
    <dl className="mt-5 space-y-4 border-t border-border/70 pt-4 text-sm">
      {groups.map((group) => (
        <div key={group.key} className="grid gap-2 sm:grid-cols-[120px_1fr]">
          <dt className="font-semibold">{group.label}</dt>
          <dd className="flex flex-wrap gap-x-3 gap-y-1">
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
}
