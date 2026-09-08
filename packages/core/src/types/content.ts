import type { Actor, VideoChannel } from "./channel"

export const CONTENT_KINDS = ["video", "short", "post"] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]
export const CONTENT_STATUSES = [
  "draft",
  "processing",
  "published",
  "failed",
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]
export const CONTENT_VISIBILITIES = ["public", "unlisted", "private"] as const
export type ContentVisibility = (typeof CONTENT_VISIBILITIES)[number]

// Editor placement is resolved by the API; only IDs are persisted on Content.
export type ContentRelations = {
  channels: Array<{
    id: string
    name: string
    handle: string
    avatarUrl: string | null
    kind: string
    positions: string[]
  }>
  media: Array<{
    id: string
    position: string
    kind: string
    quality?: string
    provider: string
    url: string | null
  }>
  terms: Array<{
    id: string
    name: string
    slug: string
    taxonomy: "category" | "tag" | "label" | "series"
  }>
  contents: Array<{ id: string; title: string; slug: string; kind: "video" }>
}

// Persisted content shape with dates serialized for API responses.
// Video below is the viewer's presentation DTO, not the database model.
export type Content = {
  _id: string
  kind: ContentKind
  status: ContentStatus
  visibility: ContentVisibility
  title?: string
  slug?: string
  description?: string
  studioIds?: string[]
  actressIds?: string[]
  actorIds?: string[]
  directorIds?: string[]
  termIds?: string[]
  mediaIds?: string[]
  metadata?: Record<string, unknown>
  seo?: { metaTitle?: string; metaDescription?: string; keywords?: string[] }
  stats: {
    viewCount: number
    likeCount: number
    dislikeCount: number
    commentCount: number
    shareCount: number
  }
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type Video = {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  durationSeconds: number
  viewCount: number
  likeCount?: number
  dislikeCount?: number
  publishedAt: string
  releaseDate?: string
  category: string
  actors?: VideoChannel[]
  directors?: VideoChannel[]
  studios?: VideoChannel[]
  categories?: VideoTerm[]
  tags?: VideoTerm[]
  labels?: VideoTerm[]
  series?: VideoTerm[]
  playbackUrl?: string
  previewUrl?: string
  player?: {
    vdoId: string
    node: {
      static: string
      playlist: string
    }
  }
  channel?: VideoChannel
}

export type VideoTerm = {
  id: string
  name: string
  slug: string
}

export type VideosResponse = {
  videos: Video[]
  total: number
}

export type Short = Video & {
  likeCount: number
  commentCount: number
  shareCount: number
  commentPolicy: "enabled" | "disabled" | "review"
}

export type ShortsResponse = {
  shorts: Short[]
  total: number
}

export type ShortsPageResponse = {
  items: Short[]
  page: number
  pageSize: number
  nextPage: number | null
  total: number
}

export type Playlist = {
  id: string
  title: string
  description: string
  owner: string
  visibility: "public" | "private" | "unlisted"
  items: Video[]
}

export type HomeFeedResponse = {
  categories: string[]
  videos: Video[]
  shorts: Short[]
  playlists: Playlist[]
}

export type ViewerNotification = {
  id: string
  section: "important" | "more"
  type: "upload" | "live" | "reply" | "membership"
  actorId: string
  actorName: string
  actorInitials: string
  actorAvatarUrl: string | null
  title: string
  thumbnailUrl: string | null
  targetUrl: string
  createdAt: string
  unread: boolean
}

export type NotificationsResponse = {
  notifications: ViewerNotification[]
  total: number
  nextCursor: string | null
  unreadCount: number
}

export type StudioOverview = {
  totalViews: number
  totalFollowers: number
  totalVideos: number
  estimatedRevenue: number
  recentVideos: Video[]
}

export type WatchComment = {
  id: string
  author: string
  initials: string
  message: string
  likeCount: number
  publishedAt: string
  pinned?: boolean
  replies?: WatchComment[]
}

export type WatchData = {
  video: Video
  relatedVideos: Video[]
  relatedNextCursor: string | null
  comments: WatchComment[]
  commentsNextCursor: string | null
  commentsTotal: number
}

export type CursorPage<Item> = {
  items: Item[]
  nextCursor: string | null
  total: number
}

export type PublicTermTaxonomy = "category" | "tag"

export type PublicTerm = {
  id: string
  name: string
  slug: string
  taxonomy: PublicTermTaxonomy
  description: string
}

export type TermsResponse = {
  terms: PublicTerm[]
  total: number
  nextCursor: string | null
}

export type TermDetailResponse = {
  term: PublicTerm
  videos: Video[]
  total: number
  nextCursor: string | null
}

export type CollectionKind = "library" | "history" | "watch-later" | "liked"

export type CollectionResponse = {
  kind: CollectionKind
  videos: Video[]
  total: number
}

export type VideoInteraction = {
  reaction: "like" | "dislike" | null
  watchLater: boolean
  saved: boolean
  likeCount: number
  dislikeCount: number
}

export type HistoryContentType = "video" | "short" | "podcast" | "music"

export type HistoryEntry = {
  id: string
  type: HistoryContentType
  watchedAt: string
  content: Video
}

export type HistoryResponse = CollectionResponse & {
  entries: HistoryEntry[]
}

export type SearchResponse = {
  videos: Video[]
  shorts: Short[]
  actors: Actor[]
  playlists: Playlist[]
  total: number
  contentTotal?: number
}
