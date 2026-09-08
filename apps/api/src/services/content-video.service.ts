import type { Video, Short } from "@workspace/core/types"
import {
  ChannelModel,
  ContentModel,
  MediaModel,
  TermModel,
} from "@workspace/db/models"
import type { PipelineStage } from "mongoose"
import { getDomainSettings } from "./settings/domain-setting.service"

// One settings snapshot per response, shared by every video/short in that response.
export async function getContentMappers(locale?: string) {
  const { domain_static, domain_playlist } = await getDomainSettings()
  return {
    mapVideo: (content: Record<string, unknown>) =>
      mapContentToVideo(content, domain_static, domain_playlist, locale),
    mapVideoSummary: (content: Record<string, unknown>) =>
      mapContentToVideoSummary(content, domain_static, domain_playlist, locale),
    mapShort: (content: Record<string, unknown>) =>
      mapContentToShort(content, domain_static, domain_playlist, locale),
    mapShortSummary: (content: Record<string, unknown>) =>
      mapContentToShortSummary(content, domain_static, domain_playlist, locale),
  }
}

function staticContentUrl(
  domain: string,
  contentSlug: string,
  file: "poster.jpg" | "preview.mp4"
) {
  // A missing setting must not send the browser directly to a hotlink-protected source.
  if (!domain || !contentSlug) return ""
  return `//${domain}/${encodeURIComponent(contentSlug)}/${file}`
}

function protocolRelativeDomain(domain: string) {
  return domain ? `//${domain}` : ""
}

export function publicVideoFilter(kind = "video"): Record<string, unknown> {
  return { kind, status: "published", visibility: "public", deletedAt: null }
}

export function publicVideoListFilter(sort?: unknown): Record<string, unknown> {
  return sort === "trending"
    ? { ...publicVideoFilter(), "stats.viewCount": { $gt: 0 } }
    : publicVideoFilter()
}

// Join only the requested page, using each related collection's _id index.
// Never return complete media metadata (tokens, referrers, etc.) to the viewer.
export function contentLookups(summary = false): PipelineStage[] {
  return [
    {
      $set: {
        __viewerRelationIds: {
          $setUnion: [
            { $ifNull: ["$studioIds", []] },
            { $ifNull: ["$actressIds", []] },
            { $ifNull: ["$actorIds", []] },
            ...(summary ? [] : [{ $ifNull: ["$directorIds", []] }]),
            { $ifNull: ["$channelIds", []] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: ChannelModel.collection.name,
        localField: "__viewerRelationIds",
        foreignField: "_id",
        pipeline: [
          {
            $match: {
              status: "active",
              deletedAt: null,
            },
          },
          {
            $project: {
              name: 1,
              handle: 1,
              avatarUrl: 1,
              verifiedAt: 1,
              kind: 1,
              "metadata.roles": 1,
              "metadata.gender": 1,
            },
          },
        ],
        as: "channels",
      },
    },
    { $unset: "__viewerRelationIds" },
    {
      $lookup: {
        from: MediaModel.collection.name,
        localField: "mediaIds",
        foreignField: "_id",
        pipeline: [
          {
            $match: { deletedAt: null, $or: [{ error: null }, { error: "" }] },
          },
          {
            $project: {
              kind: 1,
              purpose: 1,
              quality: 1,
              provider: 1,
              storageId: 1,
              "metadata.directUrl": 1,
              "metadata.duration": 1,
              "metadata.hls.uri": 1,
              "metadata.hls.media.sourceUrl": 1,
              "metadata.hls.media.duration": 1,
              "metadata.sprite": 1,
            },
          },
        ],
        as: "media",
      },
    },
    {
      $lookup: {
        from: TermModel.collection.name,
        localField: "termIds",
        foreignField: "_id",
        pipeline: [
          { $match: { status: "active", deletedAt: null } },
          ...(summary ? [{ $match: { taxonomy: "category" } }] : []),
          { $project: { name: 1, slug: 1, taxonomy: 1 } },
        ],
        as: "terms",
      },
    },
  ]
}

export function contentPagePipeline(
  filter: Record<string, unknown>,
  limit = 24,
  offset = 0,
  sort: Record<string, 1 | -1> | null = { createdAt: -1, _id: -1 }
): PipelineStage[] {
  return [
    { $match: filter },
    ...(sort ? [{ $sort: sort } as PipelineStage.Sort] : []),
    { $skip: offset },
    { $limit: limit },
    ...contentLookups(),
    {
      $project: {
        _id: 1,
        kind: 1,
        title: 1,
        translated: 1,
        slug: 1,
        description: 1,
        createdAt: 1,
        updatedAt: 1,
        stats: 1,
        studioIds: 1,
        actressIds: 1,
        actorIds: 1,
        directorIds: 1,
        channelIds: 1,
        mediaIds: 1,
        termIds: 1,
        "metadata.dvdId": 1,
        "metadata.commentPolicy": 1,
        "metadata.releaseDate": 1,
        channels: 1,
        media: 1,
        terms: 1,
      },
    },
  ]
}

export function contentSummaryPagePipeline(
  filter: Record<string, unknown>,
  limit = 24,
  offset = 0,
  sort: Record<string, 1 | -1> | null = { createdAt: -1, _id: -1 }
): PipelineStage[] {
  return [
    { $match: filter },
    ...(sort ? [{ $sort: sort } as PipelineStage.Sort] : []),
    { $skip: offset },
    { $limit: limit },
    ...contentLookups(true),
    {
      $project: {
        _id: 1,
        kind: 1,
        title: 1,
        translated: 1,
        slug: 1,
        createdAt: 1,
        stats: 1,
        studioIds: 1,
        actressIds: 1,
        actorIds: 1,
        channelIds: 1,
        mediaIds: 1,
        termIds: 1,
        "metadata.dvdId": 1,
        "metadata.commentPolicy": 1,
        "metadata.releaseDate": 1,
        channels: 1,
        media: 1,
        terms: 1,
      },
    },
  ]
}

export function getPublicContents(
  filter: Record<string, unknown> = publicVideoFilter(),
  limit = 24,
  offset = 0,
  sort?: Record<string, 1 | -1> | null
) {
  return ContentModel.aggregate<Record<string, unknown>>(
    contentPagePipeline(filter, limit, offset, sort)
  ).exec()
}

export function getPublicContentSummaries(
  filter: Record<string, unknown> = publicVideoFilter(),
  limit = 24,
  offset = 0,
  sort?: Record<string, 1 | -1> | null
) {
  return ContentModel.aggregate<Record<string, unknown>>(
    contentSummaryPagePipeline(filter, limit, offset, sort)
  ).exec()
}

const PUBLIC_CONTENT_COUNT_CACHE_MS = 5 * 60_000
const publicContentCountCache = new Map<
  string,
  { expiresAt: number; pending: Promise<number> }
>()

// Exact counts walk a large portion of the public index. Page navigation does
// not need a brand-new total on every request, so coalesce concurrent callers
// and reuse the result briefly.
export function countPublicContents(filter: Record<string, unknown>) {
  const key = JSON.stringify(filter)
  const cached = publicContentCountCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.pending

  const pending = ContentModel.countDocuments(filter).catch((error) => {
    publicContentCountCache.delete(key)
    throw error
  })
  if (publicContentCountCache.size >= 100) publicContentCountCache.clear()
  publicContentCountCache.set(key, {
    expiresAt: Date.now() + PUBLIC_CONTENT_COUNT_CACHE_MS,
    pending,
  })
  return pending
}

export function invalidatePublicContentCountCache() {
  publicContentCountCache.clear()
}

let materializedActressCountReady: Promise<boolean> | null = null

// This allows the new indexed filter to be deployed before the one-time
// actressCount backfill without hiding legacy content.
export function hasMaterializedActressCounts() {
  materializedActressCountReady ??= ContentModel.exists({
    actressCount: { $exists: false },
  }).then((row) => row === null)
  return materializedActressCountReady
}

export async function findPublicVideo(
  idOrSlug: string,
  kind = "video"
): Promise<Record<string, unknown> | null> {
  const normalized = idOrSlug.trim().toLowerCase()
  const identity = UUID_PATTERN.test(normalized)
    ? { _id: normalized }
    : { slug: { $eq: normalized, $type: "string" } }
  const [content] = await getPublicContents(
    { ...publicVideoFilter(kind), ...identity },
    1,
    0,
    null
  )
  return content ?? null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function mapContentToVideo(
  content: Record<string, unknown>,
  staticDomain = "",
  playlistDomain = "",
  locale?: string
): Video {
  const metadata = toRecord(content.metadata)
  const translation = contentTranslation(content, locale)
  const legacyChannelIds = stringArray(content.channelIds)
  const studioIds = stringArray(content.studioIds)
  const actressIds = stringArray(content.actressIds)
  const actorIds = stringArray(content.actorIds)
  const directorIds = stringArray(content.directorIds)
  const relationIds = [
    ...studioIds,
    ...actressIds,
    ...actorIds,
    ...directorIds,
    ...legacyChannelIds,
  ]
  const channels = orderedRelations(content.channels, relationIds)
  const actorChannels =
    actressIds.length || actorIds.length
      ? orderedRelations(content.channels, [...actressIds, ...actorIds])
      : channels.filter((item) => {
          const roles = stringArray(toRecord(item.metadata).roles)
          return roles.includes("actor") || item.kind === "person"
        })
  const studioChannels = studioIds.length
    ? orderedRelations(content.channels, studioIds)
    : channels.filter((item) => {
        const roles = stringArray(toRecord(item.metadata).roles)
        return roles.includes("studio") || item.kind === "organization"
      })
  const directorChannels = directorIds.length
    ? orderedRelations(content.channels, directorIds)
    : channels.filter((item) =>
        stringArray(toRecord(item.metadata).roles).includes("director")
      )
  const channel = studioChannels[0] ?? actorChannels[0]
  const media = orderedRelations(content.media, content.mediaIds)
  const playable = media
    .filter((item) => item.purpose === "video" || item.purpose === "short")
    .sort(
      (left, right) => qualityRank(right.quality) - qualityRank(left.quality)
    )
  const source = playable.find((item) => mediaUrl(item)) ?? playable[0]
  const poster =
    media.find((item) => item.purpose === "poster") ??
    media.find(
      (item) => item.purpose === "thumbnail" && !toRecord(item.metadata).sprite
    )
  const trailer = media.find((item) => item.purpose === "trailer")
  const contentSlug = stringValue(content.slug)
  const posterUrl = poster
    ? staticContentUrl(staticDomain, contentSlug, "poster.jpg")
    : ""
  const previewUrl = trailer
    ? staticContentUrl(staticDomain, contentSlug, "preview.mp4")
    : ""
  const terms = orderedRelations(content.terms, content.termIds)
  const categories = terms.filter((item) => item.taxonomy === "category")
  const tags = terms.filter((item) => item.taxonomy === "tag")
  const labels = terms.filter((item) => item.taxonomy === "label")
  const series = terms.filter((item) => item.taxonomy === "series")
  const category = categories[0]
  const sourceMetadata = toRecord(source?.metadata)
  const releaseDate = optionalDateValue(metadata.releaseDate)
  const id = stringValue(content.slug) || stringValue(content._id)
  const player =
    content.kind === "video" && contentSlug && staticDomain && playlistDomain
      ? {
          vdoId: contentSlug,
          node: {
            static: protocolRelativeDomain(staticDomain),
            playlist: protocolRelativeDomain(playlistDomain),
          },
        }
      : undefined
  return {
    id,
    title:
      stringValue(translation.title) ||
      stringValue(content.title) ||
      stringValue(metadata.dvdId) ||
      id,
    description: plainText(
      stringValue(translation.description) || stringValue(content.description)
    ),
    thumbnailUrl: posterUrl,
    durationSeconds:
      numberValue(sourceMetadata.duration) ||
      numberValue(toRecord(toRecord(sourceMetadata.hls).media).duration),
    viewCount: numberValue(toRecord(content.stats).viewCount),
    likeCount: numberValue(toRecord(content.stats).likeCount),
    dislikeCount: numberValue(toRecord(content.stats).dislikeCount),
    publishedAt: releaseDate ?? dateValue(content.createdAt),
    ...(releaseDate ? { releaseDate } : {}),
    category: stringValue(category?.name) || "Other",
    actors: actorChannels.map(mapVideoChannel),
    ...(directorChannels.length
      ? { directors: directorChannels.map(mapVideoChannel) }
      : {}),
    studios: studioChannels.map(mapVideoChannel),
    categories: categories.map(mapVideoTerm),
    tags: tags.map(mapVideoTerm),
    labels: labels.map(mapVideoTerm),
    series: series.map(mapVideoTerm),
    ...(content.kind === "short" && mediaUrl(source)
      ? { playbackUrl: mediaUrl(source) }
      : {}),
    ...(previewUrl ? { previewUrl } : {}),
    ...(player ? { player } : {}),
    ...(channel
      ? {
          channel: mapVideoChannel(channel),
        }
      : {}),
  }
}

export function mapContentToShort(
  content: Record<string, unknown>,
  staticDomain = "",
  playlistDomain = "",
  locale?: string
): Short {
  const stats = toRecord(content.stats)
  const policy = toRecord(content.metadata).commentPolicy
  return {
    ...mapContentToVideo(content, staticDomain, playlistDomain, locale),
    likeCount: numberValue(stats.likeCount),
    commentCount: numberValue(stats.commentCount),
    shareCount: numberValue(stats.shareCount),
    commentPolicy:
      policy === "disabled" || policy === "review" ? policy : "enabled",
  }
}

export function mapContentToVideoSummary(
  content: Record<string, unknown>,
  staticDomain = "",
  playlistDomain = "",
  locale?: string
): Video {
  const video = mapContentToVideo(content, staticDomain, playlistDomain, locale)
  return {
    id: video.id,
    title: video.title,
    description: "",
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount,
    publishedAt: video.publishedAt,
    category: video.category,
    ...(video.releaseDate ? { releaseDate: video.releaseDate } : {}),
    ...(video.previewUrl ? { previewUrl: video.previewUrl } : {}),
    ...(video.channel ? { channel: video.channel } : {}),
  }
}

export function mapContentToShortSummary(
  content: Record<string, unknown>,
  staticDomain = "",
  playlistDomain = "",
  locale?: string
): Short {
  const stats = toRecord(content.stats)
  const policy = toRecord(content.metadata).commentPolicy
  return {
    ...mapContentToVideoSummary(content, staticDomain, playlistDomain, locale),
    likeCount: numberValue(stats.likeCount),
    commentCount: numberValue(stats.commentCount),
    shareCount: numberValue(stats.shareCount),
    commentPolicy:
      policy === "disabled" || policy === "review" ? policy : "enabled",
  }
}

export function normalizeContentLocale(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const locale = value.trim().toLowerCase()
  if (!locale || locale === "en") return undefined
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(locale) ? locale : undefined
}

function contentTranslation(
  content: Record<string, unknown>,
  locale?: string
): Record<string, unknown> {
  if (!locale) return {}
  return toRecord(toRecord(content.translated)[locale])
}

export async function getPublicVideoCategories() {
  const now = Date.now()
  if (publicCategoryCache.value && publicCategoryCache.expiresAt > now)
    return publicCategoryCache.value
  if (publicCategoryCache.pending) return publicCategoryCache.pending

  // Categories are first-class terms. Deriving this list by unwinding every
  // content.termIds array also walks tens of thousands of tag references on
  // every Home request, even though only category records are needed.
  const version = publicCategoryCache.version
  const request = TermModel.find({
    taxonomy: "category",
    status: "active",
    deletedAt: null,
  })
    .select("name")
    .sort({ name: 1 })
    .lean()
    .then((rows) => {
      const names = [
        ...new Set(rows.map((term) => stringValue(term.name)).filter(Boolean)),
      ]
      if (publicCategoryCache.version === version) {
        publicCategoryCache.value = names
        publicCategoryCache.expiresAt = Date.now() + PUBLIC_CATEGORY_CACHE_MS
      }
      return names
    })
    .finally(() => {
      if (publicCategoryCache.pending === request)
        publicCategoryCache.pending = null
    })
  publicCategoryCache.pending = request
  return request
}

const PUBLIC_CATEGORY_CACHE_MS = 5 * 60_000
const publicCategoryCache: {
  value: string[] | null
  expiresAt: number
  pending: Promise<string[]> | null
  version: number
} = { value: null, expiresAt: 0, pending: null, version: 0 }

export function invalidatePublicVideoCategoriesCache() {
  publicCategoryCache.value = null
  publicCategoryCache.expiresAt = 0
  publicCategoryCache.pending = null
  publicCategoryCache.version += 1
}

export async function resolveCategoryId(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized === "all") return undefined
  const term = await TermModel.findOne({
    taxonomy: "category",
    status: "active",
    deletedAt: null,
    $or: [
      { _id: normalized },
      { slug: normalized.toLowerCase() },
      { name: new RegExp(`^${escapeRegExp(normalized)}$`, "i") },
    ],
  })
    .select("_id")
    .lean()
  return term?._id ?? null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
export function toRecord(value: unknown): Record<string, unknown> {
  if (value instanceof Map) return Object.fromEntries(value)
  return isRecord(value) ? value : {}
}
export function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}
export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && !!item)
    : []
}
export function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
export function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString()
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  return new Date(0).toISOString()
}
function optionalDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString()
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  return undefined
}
export function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
export function contentChannelFilter(channelIds: string | string[]) {
  const condition = Array.isArray(channelIds) ? { $in: channelIds } : channelIds
  return {
    $or: [
      { studioIds: condition },
      { actressIds: condition },
      { actorIds: condition },
      { directorIds: condition },
      { channelIds: condition },
    ],
  }
}
function orderedRelations(value: unknown, idsValue: unknown) {
  const ids = stringArray(idsValue)
  const rows = Array.isArray(value) ? value.filter(isRecord) : []
  return rows
    .filter((item) => ids.includes(stringValue(item._id)))
    .sort(
      (a, b) =>
        ids.indexOf(stringValue(a._id)) - ids.indexOf(stringValue(b._id))
    )
}
function mapVideoChannel(channel: Record<string, unknown>) {
  return {
    id: stringValue(channel._id),
    name: stringValue(channel.name),
    handle: `@${stringValue(channel.handle).replace(/^@/, "")}`,
    avatarUrl: stringValue(channel.avatarUrl) || null,
    verified: Boolean(channel.verifiedAt),
  }
}
function mapVideoTerm(term: Record<string, unknown>) {
  return {
    id: stringValue(term._id),
    name: stringValue(term.name),
    slug: stringValue(term.slug),
  }
}
function qualityRank(value: unknown) {
  return value === "original" ? 10000 : Number(value) || 0
}
export function mediaUrl(media?: Record<string, unknown>) {
  const metadata = toRecord(media?.metadata)
  const hls = toRecord(metadata.hls)
  const stored =
    Boolean(media?.storageId) ||
    media?.provider === "local" ||
    media?.provider === "s3"
  const url =
    (stored ? stringValue(metadata.directUrl) : "") ||
    stringValue(hls.uri) ||
    stringValue(toRecord(hls.media).sourceUrl) ||
    stringValue(metadata.directUrl)
  return /^(https?:\/\/|\/(?!\/))/.test(url) ? url : ""
}
