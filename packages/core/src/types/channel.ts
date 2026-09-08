import type { Playlist, Short, Video } from "./content"

export const CHANNEL_KINDS = ["person", "organization", "page"] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]
export const CHANNEL_GENDERS = [
  "male",
  "female",
  "non_binary",
  "other",
] as const
export type ChannelGender = (typeof CHANNEL_GENDERS)[number]
export const PERSON_CHANNEL_ROLES = ["actor", "director", "creator"] as const
export const ORGANIZATION_CHANNEL_ROLES = ["studio", "label", "brand"] as const
export const PAGE_CHANNEL_ROLES = ["community"] as const
export const CHANNEL_ROLES = [
  ...PERSON_CHANNEL_ROLES,
  ...ORGANIZATION_CHANNEL_ROLES,
  ...PAGE_CHANNEL_ROLES,
] as const
export type ChannelRole = (typeof CHANNEL_ROLES)[number]

export type ChannelMetadata = Record<string, unknown> & {
  roles?: ChannelRole[]
  gender?: ChannelGender
  stageName?: string
  nationality?: string | null
  genres?: string[]
  legalName?: string | null
  foundedYear?: number | null
  specialties?: string[]
  topics?: string[]
}

export type ChannelSummary = {
  id: string
  name: string
  handle: string
  avatarUrl: string | null
  verified: boolean
}
// Compatibility name for existing video card DTOs.
export type VideoChannel = ChannelSummary
export const CHANNEL_TAB_IDS = [
  "home",
  "videos",
  "shorts",
  "live",
  "courses",
  "playlists",
  "posts",
  "about",
] as const
export type ChannelTabId = (typeof CHANNEL_TAB_IDS)[number]
export type ChannelLayout = "banner" | "compact"
export type ChannelLink = { label: string; url: string }

export type Channel = ChannelSummary & {
  kind: ChannelKind
  layout: ChannelLayout
  enabledTabs: ChannelTabId[]
  defaultTab: ChannelTabId
  membershipEnabled: boolean
  description: string
  bannerUrl: string | null
  country: string | null
  subscriberCount: number
  videoCount: number
  shortCount: number
  viewCount: number
  joinedAt: string
  isFollowing: boolean
  links: ChannelLink[]
  metadata?: ChannelMetadata
}
export type Actor = VideoChannel & {
  kind: ChannelKind
  gender?: ChannelGender
  bio: string
  followerCount: number
  videoCount: number
  coverUrl: string
  isFollowing: boolean
}

export type ActorsResponse = {
  actors: Actor[]
  total: number
  nextCursor?: string | null
}

export type ChannelDetailResponse = {
  channel: Channel
  videos: Video[]
  shorts: Short[]
  playlists: Playlist[]
  courses: ChannelCourse[]
  posts: ChannelPost[]
}

export type ChannelCourse = {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  lessonCount: number
}

export type ChannelPost = {
  id: string
  message: string
  imageUrl: string | null
  publishedAt: string
  likeCount: number
  commentCount: number
}

export type FollowingProfile = {
  id: string
  type: "actor" | "studio"
  name: string
  handle: string
  initials: string
  avatarUrl: string | null
  verified: boolean
  isLive: boolean
  hasNew?: boolean
}
