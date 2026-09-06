"use client"

import * as React from "react"
import type { HomeFeedResponse } from "@workspace/core/types"
import type { HomeFeedSettings } from "@workspace/core/validators"
import { Clapperboard, LoaderCircle } from "lucide-react"
import { useTranslations } from "next-intl"

import { VideoGrid } from "@/components/video"
import { CategoryChips } from "./category-chips"
import { ConfigurableFeed } from "./configurable-feed"

const categoryKeys: Record<string, string> = {
  Travel: "travel",
  Food: "food",
  Technology: "technology",
  Creators: "creators",
  Music: "music",
  Education: "education",
  Fitness: "fitness",
  Lifestyle: "lifestyle",
  Science: "science",
  Adventure: "adventure",
}

export function HomeFeed({
  categories: availableCategories,
  videos: initialVideos,
  shorts: initialShorts,
  playlists: initialPlaylists,
  locale,
  feeds,
}: HomeFeedResponse & {
  locale: string
  feeds: HomeFeedSettings["feeds"]
}) {
  const t = useTranslations("video")
  const home = useTranslations("video.home")
  const [activeCategory, setActiveCategory] = React.useState("all")
  const [feed, setFeed] = React.useState({
    videos: initialVideos,
    shorts: initialShorts,
    playlists: initialPlaylists,
  })
  const [categoryLoading, setCategoryLoading] = React.useState(false)
  const [categoryError, setCategoryError] = React.useState(false)
  const requestRef = React.useRef<AbortController | null>(null)
  const categories = React.useMemo(
    () => [
      { value: "all", label: home("categories.all") },
      ...availableCategories.slice(0, 10).map((category) => ({
        value: category,
        label: categoryKeys[category]
          ? home(`categories.${categoryKeys[category]}`)
          : category,
      })),
    ],
    [availableCategories, home]
  )
  const loadCategory = React.useCallback(
    async (category: string) => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      setActiveCategory(category)
      setCategoryLoading(true)
      setCategoryError(false)
      setFeed({ videos: [], shorts: [], playlists: [] })
      try {
        const url = new URL("/api/v1/home", window.location.origin)
        url.searchParams.set("category", category)
        url.searchParams.set("locale", locale)
        const response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        })
        if (!response.ok)
          throw new Error(`Home API returned ${response.status}`)
        const nextFeed = (await response.json()) as HomeFeedResponse
        setFeed({
          videos: nextFeed.videos,
          shorts: nextFeed.shorts,
          playlists: nextFeed.playlists,
        })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setCategoryError(true)
      } finally {
        if (requestRef.current === controller) setCategoryLoading(false)
      }
    },
    [locale]
  )
  React.useEffect(() => () => requestRef.current?.abort(), [])
  const { videos, shorts, playlists } = feed
  const labels = {
    views: (count: string) => t("views", { count }),
    published: (date: string) => t("published", { date }),
    moreOptions: t("moreOptions"),
    verified: t("verified"),
  }
  const hasContent = videos.length || shorts.length || playlists.length
  return (
    <>
      <div className="sticky top-16 z-20 -mt-4 bg-background/95 pt-4 pb-2 backdrop-blur-xl">
        <CategoryChips
          categories={categories}
          active={activeCategory}
          onChange={(category) => void loadCategory(category)}
        />
      </div>
      {categoryLoading ? (
        <div
          className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="mr-2 size-5 animate-spin" />
          {t("loadingMore")}
        </div>
      ) : null}
      {categoryError && !categoryLoading ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="font-medium">{home("categoryLoadError")}</p>
          <button
            type="button"
            onClick={() => void loadCategory(activeCategory)}
            className="mt-4 rounded-full border px-5 py-2 text-sm font-semibold hover:bg-muted"
          >
            {t("retry")}
          </button>
        </div>
      ) : null}
      {activeCategory !== "all" &&
      !categoryLoading &&
      !categoryError &&
      videos.length ? (
        <section className="mt-4">
          <VideoGrid videos={videos} locale={locale} labels={labels} />
        </section>
      ) : activeCategory !== "all" && !categoryLoading && !categoryError ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="font-medium">{home("noCategoryTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {home("noCategoryDescription")}
          </p>
        </div>
      ) : null}
      {activeCategory === "all" ? (
        <>
          {feeds
            .filter((item) => item.enabled)
            .map((item) => (
              <ConfigurableFeed
                key={item.id}
                feed={item}
                locale={locale}
                initialVideos={videos}
                initialShorts={shorts}
                initialPlaylists={playlists}
              />
            ))}
        </>
      ) : null}
      {!hasContent &&
      activeCategory === "all" &&
      !categoryLoading &&
      !categoryError ? (
        <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
          <span className="mb-5 grid size-20 place-items-center rounded-full bg-muted">
            <Clapperboard className="size-9 text-muted-foreground" />
          </span>
          <h1 className="text-xl font-bold">{home("emptyTitle")}</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {home("emptyDescription")}
          </p>
        </div>
      ) : null}
    </>
  )
}
