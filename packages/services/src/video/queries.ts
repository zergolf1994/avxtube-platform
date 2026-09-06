import "server-only"

import type {
  Actor,
  ActorsResponse,
  Short,
  ShortsResponse,
  ShortsPageResponse,
  StudioOverview,
  Video,
  VideosResponse,
  WatchData,
  CursorPage,
  FollowingProfile,
  HomeFeedResponse,
  Playlist,
  CollectionKind,
  CollectionResponse,
  SearchResponse,
  ChannelDetailResponse,
  HistoryResponse,
} from "@workspace/core/types"

const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000"
const apiVersion = process.env.API_VERSION ?? "v1"

function createVideosApiUrl(path = ""): URL {
  return new URL(`/${apiVersion}/videos${path}`, apiOrigin)
}

async function fetchJson<ResponseBody>(
  url: URL,
  requestHeaders?: HeadersInit
): Promise<ResponseBody> {
  const headers = new Headers(requestHeaders)
  headers.set("accept", "application/json")
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(
      `Videos API returned ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<ResponseBody>
}

export async function getVideos(): Promise<VideosResponse> {
  return fetchJson<VideosResponse>(createVideosApiUrl())
}

export async function getVideosPage(
  cursor = 0,
  limit = 8,
  sort?: "trending" | "releaseDate",
  locale = "en",
  actress = "all"
): Promise<CursorPage<Video>> {
  const url = createVideosApiUrl()
  url.searchParams.set("cursor", String(cursor))
  url.searchParams.set("limit", String(limit))
  if (sort) url.searchParams.set("sort", sort)
  if (actress !== "all") url.searchParams.set("actress", actress)
  url.searchParams.set("locale", locale)
  return fetchJson<CursorPage<Video>>(url)
}

export async function getVideo(
  id: string,
  locale = "en"
): Promise<Video | null> {
  const url = createVideosApiUrl(`/${encodeURIComponent(id)}`)
  url.searchParams.set("locale", locale)
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(
      `Videos API returned ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as { video: Video }
  return data.video
}

export async function getWatchData(
  id: string,
  locale = "en"
): Promise<WatchData | null> {
  const url = createVideosApiUrl(`/${encodeURIComponent(id)}`)
  url.searchParams.set("locale", locale)
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
  if (response.status === 404) return null
  if (!response.ok)
    throw new Error(
      `Videos API returned ${response.status} ${response.statusText}`
    )
  return response.json() as Promise<WatchData>
}

export async function getActors(): Promise<ActorsResponse> {
  return fetchJson<ActorsResponse>(new URL(`/${apiVersion}/actors`, apiOrigin))
}

export async function getActor(
  handle: string
): Promise<{ actor: Actor; videos: Video[] } | null> {
  const response = await fetch(
    new URL(`/${apiVersion}/actors/${encodeURIComponent(handle)}`, apiOrigin),
    {
      headers: { accept: "application/json" },
      cache: "no-store",
    }
  )
  if (response.status === 404) return null
  if (!response.ok)
    throw new Error(
      `Actors API returned ${response.status} ${response.statusText}`
    )
  return response.json() as Promise<{ actor: Actor; videos: Video[] }>
}

export async function getChannel(
  handle: string
): Promise<ChannelDetailResponse | null> {
  const response = await fetch(
    new URL(`/${apiVersion}/channels/${encodeURIComponent(handle)}`, apiOrigin),
    {
      headers: { accept: "application/json" },
      cache: "no-store",
    }
  )
  if (response.status === 404) return null
  if (!response.ok)
    throw new Error(
      `Channels API returned ${response.status} ${response.statusText}`
    )
  return response.json() as Promise<ChannelDetailResponse>
}

export async function getShorts(): Promise<ShortsResponse> {
  const page = await getShortsPage(1, 5)
  return { shorts: page.items, total: page.total }
}

export async function getShortsPage(
  page = 1,
  pageSize = 5
): Promise<ShortsPageResponse> {
  const url = new URL(`/${apiVersion}/shorts`, apiOrigin)
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))
  return fetchJson<ShortsPageResponse>(url)
}

export async function getShort(id: string): Promise<Short | null> {
  const response = await fetch(
    new URL(`/${apiVersion}/shorts/${encodeURIComponent(id)}`, apiOrigin),
    {
      headers: { accept: "application/json" },
      cache: "no-store",
    }
  )
  if (response.status === 404) return null
  if (!response.ok)
    throw new Error(
      `Shorts API returned ${response.status} ${response.statusText}`
    )
  const data = (await response.json()) as { short: Short }
  return data.short
}

export async function getStudioOverview(): Promise<StudioOverview> {
  const response = await fetchJson<{ overview: StudioOverview }>(
    new URL(`/${apiVersion}/studio/overview`, apiOrigin)
  )
  return response.overview
}

export async function getFollowingProfiles(
  cursor = 0,
  limit = 10,
  requestHeaders?: HeadersInit
): Promise<CursorPage<FollowingProfile>> {
  const url = new URL(`/${apiVersion}/following`, apiOrigin)
  url.searchParams.set("cursor", String(cursor))
  url.searchParams.set("limit", String(limit))
  return fetchJson<CursorPage<FollowingProfile>>(url, requestHeaders)
}

export async function getFollowingFeed(
  cursor = 0,
  limit = 20,
  requestHeaders?: HeadersInit
): Promise<CursorPage<Video>> {
  const url = new URL(`/${apiVersion}/following/feed`, apiOrigin)
  url.searchParams.set("cursor", String(cursor))
  url.searchParams.set("limit", String(limit))
  return fetchJson<CursorPage<Video>>(url, requestHeaders)
}

export async function getCollection(
  kind: CollectionKind,
  requestHeaders?: HeadersInit
): Promise<CollectionResponse> {
  return fetchJson<CollectionResponse>(
    new URL(`/${apiVersion}/collections/${kind}`, apiOrigin),
    requestHeaders
  )
}

export async function getHistory(
  requestHeaders?: HeadersInit
): Promise<HistoryResponse> {
  return fetchJson<HistoryResponse>(
    new URL(`/${apiVersion}/collections/history`, apiOrigin),
    requestHeaders
  )
}

export async function searchContent(
  params: Record<string, string>,
  locale = "en"
): Promise<SearchResponse> {
  return fetchJson<SearchResponse>(createSearchUrl(params, locale))
}

function createSearchUrl(params: Record<string, string>, locale: string) {
  const url = new URL(`/${apiVersion}/search`, apiOrigin)
  for (const [key, value] of Object.entries(params))
    if (value) url.searchParams.set(key, value)
  url.searchParams.set("locale", locale)
  return url
}

export async function searchContentResults(
  params: Record<string, string>,
  locale = "en"
): Promise<Omit<SearchResponse, "total"> & { total?: number }> {
  const url = createSearchUrl(params, locale)
  url.searchParams.set("part", "results")
  return fetchJson(url)
}

export async function searchContentCount(
  params: Record<string, string>,
  locale = "en"
): Promise<{ total: number; contentTotal?: number }> {
  const url = createSearchUrl(params, locale)
  url.searchParams.set("part", "count")
  return fetchJson(url)
}

export async function getHomeFeed(
  locale = "en",
  category = "all"
): Promise<HomeFeedResponse> {
  const url = new URL(`/${apiVersion}/home`, apiOrigin)
  url.searchParams.set("category", category)
  url.searchParams.set("locale", locale)
  return fetchJson<HomeFeedResponse>(url)
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  const response = await fetch(
    new URL(`/${apiVersion}/playlists/${encodeURIComponent(id)}`, apiOrigin),
    {
      headers: { accept: "application/json" },
      cache: "no-store",
    }
  )
  if (response.status === 404) return null
  if (!response.ok)
    throw new Error(
      `Playlists API returned ${response.status} ${response.statusText}`
    )
  const data = (await response.json()) as { playlist: Playlist }
  return data.playlist
}
