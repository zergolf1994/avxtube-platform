"use client"

import * as React from "react"
import { LoaderCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import type { HomeFeedItem } from "@workspace/core/validators"
import type { Playlist, Short, Video } from "@workspace/core/types"
import { VideoGrid } from "@/components/video"
import { PlaylistShelf } from "./playlist-shelf"
import { SectionHeading } from "./section-heading"
import { ShortsShelf } from "./shorts-shelf"

type FeedItem = Video | Short | Playlist
type FeedResponse = { items: FeedItem[]; page: number; nextPage: number | null }

export function ConfigurableFeed({
  feed,
  locale,
  initialVideos,
  initialShorts,
  initialPlaylists,
}: {
  feed: HomeFeedItem
  locale: string
  initialVideos: Video[]
  initialShorts: Short[]
  initialPlaylists: Playlist[]
}) {
  const t = useTranslations("video")
  const home = useTranslations("video.home")
  const initial = React.useMemo(
    () => preload(feed, initialVideos, initialShorts, initialPlaylists),
    [feed, initialPlaylists, initialShorts, initialVideos]
  )
  const [items, setItems] = React.useState<FeedItem[]>(initial?.items ?? [])
  const [nextPage, setNextPage] = React.useState<number | null>(
    initial?.nextPage ?? feed.startPage
  )
  const [loadedPages, setLoadedPages] = React.useState(initial ? 1 : 0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const loadingRef = React.useRef(false)
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  const startedRef = React.useRef(false)
  const title =
    feed.title ||
    (feed.categories.length
      ? feed.categories.join(", ")
      : feed.id === "latest-videos"
        ? home("latestVideos")
        : feed.type === "videos"
          ? home("videos")
          : feed.type === "shorts"
            ? "Shorts"
            : home("playlists"))
  const barePrimaryVideos =
    feed.id === "videos" && !feed.title && feed.categories.length === 0
  const viewAllHref =
    feed.showViewAll && feed.viewAllHref ? feed.viewAllHref : undefined
  const withinLimit = feed.maxPages === null || loadedPages < feed.maxPages
  const canLoad = nextPage !== null && withinLimit && !loading
  const labels = {
    views: (count: string) => t("views", { count }),
    published: (date: string) => t("published", { date }),
    moreOptions: t("moreOptions"),
    verified: t("verified"),
  }

  const load = React.useCallback(
    async (page: number, replace = false) => {
      if (loadingRef.current) return
      loadingRef.current = true
      setLoading(true)
      setError(false)
      try {
        const url = new URL("/api/v1/home/feed", window.location.origin)
        url.searchParams.set("type", feed.type)
        feed.categories.forEach((category) =>
          url.searchParams.append("category", category)
        )
        url.searchParams.set("sort", feed.sort)
        url.searchParams.set("page", String(page))
        url.searchParams.set("pageSize", String(feed.pageSize))
        url.searchParams.set("locale", locale)
        const response = await fetch(url, {
          headers: { accept: "application/json" },
        })
        if (!response.ok)
          throw new Error(`Home feed returned ${response.status}`)
        const result = (await response.json()) as FeedResponse
        setItems((current) =>
          replace ? result.items : uniqueItems([...current, ...result.items])
        )
        setNextPage(result.nextPage)
        setLoadedPages((current) => (replace ? 1 : current + 1))
      } catch {
        setError(true)
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [feed.categories, feed.pageSize, feed.sort, feed.type, locale]
  )

  React.useEffect(() => {
    if (startedRef.current || initial) return
    startedRef.current = true
    void load(feed.startPage, true)
  }, [feed.startPage, initial, load])

  React.useEffect(() => {
    if (feed.loadMore !== "auto" || !canLoad) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextPage !== null) void load(nextPage)
      },
      { rootMargin: "400px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [canLoad, feed.loadMore, load, nextPage])

  if (!items.length && !loading && !error) return null
  return (
    <section className={barePrimaryVideos ? "mt-4" : "mt-9 border-t pt-7"}>
      {feed.type === "videos" ? (
        <>
          {barePrimaryVideos ? null : (
            <SectionHeading
              title={title}
              href={viewAllHref}
              actionLabel={home("viewAll")}
            />
          )}
          {items.length ? (
            <VideoGrid
              videos={items as Video[]}
              locale={locale}
              labels={labels}
            />
          ) : null}
        </>
      ) : feed.type === "shorts" ? (
        <ShortsShelf
          shorts={items as Short[]}
          limit={items.length}
          title={title}
          bare
          viewAllHref={viewAllHref}
          viewAllLabel={home("viewAll")}
        />
      ) : (
        <PlaylistShelf
          playlists={items as Playlist[]}
          title={title}
          bare
          viewAllHref={viewAllHref}
          viewAllLabel={home("viewAll")}
        />
      )}
      {loading ? (
        <div className="flex justify-center py-8 text-sm text-muted-foreground">
          <LoaderCircle className="mr-2 size-5 animate-spin" />
          {t("loadingMore")}
        </div>
      ) : null}
      {error ? (
        <div className="py-5 text-center">
          <button
            type="button"
            className="rounded-full border px-5 py-2 text-sm font-semibold"
            onClick={() =>
              nextPage !== null && void load(nextPage, loadedPages === 0)
            }
          >
            {t("retry")}
          </button>
        </div>
      ) : null}
      {feed.loadMore === "button" && canLoad ? (
        <div className="flex justify-center py-8">
          <button
            type="button"
            className="rounded-full border px-6 py-2.5 text-sm font-semibold hover:bg-muted"
            onClick={() => nextPage !== null && void load(nextPage)}
          >
            {t("loadMore")}
          </button>
        </div>
      ) : null}
      {feed.loadMore === "auto" ? (
        <div ref={sentinelRef} className="h-px" />
      ) : null}
      {feed.loadMore !== "none" && !canLoad && items.length && !loading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {t("allLoaded")}
        </p>
      ) : null}
    </section>
  )
}

function preload(
  feed: HomeFeedItem,
  videos: Video[],
  shorts: Short[],
  playlists: Playlist[]
) {
  if (feed.categories.length || feed.sort !== "latest") return null
  const source: FeedItem[] =
    feed.type === "videos"
      ? videos
      : feed.type === "shorts"
        ? shorts
        : playlists
  const start = (feed.startPage - 1) * feed.pageSize
  if (start + feed.pageSize > source.length) return null
  const items = source.slice(start, start + feed.pageSize)
  return {
    items,
    nextPage: items.length === feed.pageSize ? feed.startPage + 1 : null,
  }
}

function uniqueItems(items: FeedItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
