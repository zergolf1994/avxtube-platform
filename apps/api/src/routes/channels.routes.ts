import { Router } from "express"
import { CHANNEL_KINDS, CHANNEL_ROLES } from "@workspace/core/types/channel"
import {
  escapeRegExp,
  getPublicContents,
  getPublicContentSummaries,
  getContentMappers,
  publicVideoFilter,
  stringValue,
  toRecord,
  numberValue,
  contentChannelFilter,
} from "../services/content-video.service"
import {
  getPublicChannels,
  countPublicChannels,
  mapChannel,
  publicChannelFilter,
} from "../services/channel-viewer.service"

const router: Router = Router()
const CHANNEL_DETAIL_CACHE_MS = 2 * 60_000
const channelDetailCache = new Map<
  string,
  { expiresAt: number; pending: Promise<Record<string, unknown> | null> }
>()

router.get("/", async (req, res) => {
  const filter = publicChannelFilter()
  const kind = stringValue(req.query.kind)
  const role = stringValue(req.query.role)
  if (kind && !CHANNEL_KINDS.some((value) => value === kind)) {
    res.status(400).json({ error: "Invalid channel kind" })
    return
  }
  if (role && !CHANNEL_ROLES.some((value) => value === role)) {
    res.status(400).json({ error: "Invalid channel role" })
    return
  }
  if (kind) filter.kind = kind
  if (role) filter["metadata.roles"] = role
  const ids = stringValue(req.query.ids)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100)
  if (ids.length) filter._id = { $in: ids }
  const q = stringValue(req.query.q).slice(0, 200)
  if (q) {
    const pattern = new RegExp(escapeRegExp(q), "i")
    filter.$or = [{ name: pattern }, { handle: pattern }]
  }
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(stringValue(req.query.limit), 10) || ids.length || 30
    )
  )
  const offset = Math.max(
    0,
    Number.parseInt(stringValue(req.query.cursor), 10) || 0
  )
  const [rows, total] = await Promise.all([
    getPublicChannels(filter, limit, offset),
    countPublicChannels(filter),
  ])
  res.json({
    channels: rows.map(mapChannel),
    total,
    nextCursor:
      offset + rows.length < total ? String(offset + rows.length) : null,
  })
})

router.get("/:handle", async (req, res) => {
  const handle = req.params.handle.replace(/^@/, "").toLowerCase()
  res.setHeader(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=120"
  )
  const cached = channelDetailCache.get(handle)
  if (cached && cached.expiresAt > Date.now()) {
    const payload = await cached.pending
    if (!payload) {
      res.status(404).json({ error: "Channel not found" })
      return
    }
    res.json(payload)
    return
  }

  const pending = loadChannelDetail(handle, req.params.handle).catch(
    (error) => {
      channelDetailCache.delete(handle)
      throw error
    }
  )
  if (channelDetailCache.size >= 500) channelDetailCache.clear()
  channelDetailCache.set(handle, {
    expiresAt: Date.now() + CHANNEL_DETAIL_CACHE_MS,
    pending,
  })
  const payload = await pending
  if (!payload) {
    channelDetailCache.delete(handle)
    res.status(404).json({ error: "Channel not found" })
    return
  }
  res.json(payload)
})

async function loadChannelDetail(handle: string, rawHandle: string) {
  const [row] = await getPublicChannels(
    { ...publicChannelFilter(), $or: [{ handle }, { _id: rawHandle }] },
    1,
    0,
    { includeContentStats: true }
  )
  if (!row) return null
  const channel = mapChannel(row)
  const enabledTabs = new Set(channel.enabledTabs)
  const { mapVideo, mapVideoSummary, mapShortSummary } =
    await getContentMappers()
  const [videos, shorts, posts] = await Promise.all([
    enabledTabs.has("home") || enabledTabs.has("videos")
      ? getPublicContentSummaries(
          {
            ...publicVideoFilter("video"),
            ...contentChannelFilter(channel.id),
          },
          48
        )
      : [],
    enabledTabs.has("shorts")
      ? getPublicContentSummaries(
          {
            ...publicVideoFilter("short"),
            ...contentChannelFilter(channel.id),
          },
          48
        )
      : [],
    enabledTabs.has("posts")
      ? getPublicContents(
          {
            ...publicVideoFilter("post"),
            ...contentChannelFilter(channel.id),
          },
          48
        )
      : [],
  ])
  return {
    channel,
    videos: (videos ?? []).map(mapVideoSummary),
    shorts: (shorts ?? []).map(mapShortSummary),
    playlists: [],
    courses: [],
    posts: (posts ?? []).map((content) => {
      const video = mapVideo(content)
      return {
        id: video.id,
        message: video.description || video.title,
        imageUrl: video.thumbnailUrl || null,
        publishedAt: video.publishedAt,
        likeCount: numberValue(toRecord(content.stats).likeCount),
        commentCount: numberValue(toRecord(content.stats).commentCount),
      }
    }),
  }
}

export default router
