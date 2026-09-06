import { randomUUID } from "node:crypto"
import type { Video } from "@workspace/core/types"
import { ContentModel } from "@workspace/db/models"
import { Router, type NextFunction, type Request, type Response } from "express"

import {
  authenticateUser,
  getRequestActor,
} from "../middlewares/user-access.middleware"
import {
  findPublicVideo,
  getPublicContents,
  getContentMappers,
  normalizeContentLocale,
  publicVideoFilter,
  publicVideoListFilter,
  stringValue,
  numberValue,
  toRecord,
  contentPagePipeline,
} from "../services/content-video.service"
import {
  createVideoComment,
  getVideoComments,
} from "../services/video-comments.service"
import {
  getVideoInteraction,
  markVideoWatched,
  setVideoCollectionFlag,
  setVideoReaction,
} from "../services/video-interaction.service"

const router: Router = Router()
const WATCH_CORE_CACHE_MS = 30_000
const RELATED_POOL_CACHE_MS = 5 * 60_000
type WatchCore = {
  content: Record<string, unknown>
  relatedContents: Record<string, unknown>[]
}
const watchCoreCache = new Map<
  string,
  { expiresAt: number; pending: Promise<WatchCore | null> }
>()
let relatedPoolCache:
  | {
      expiresAt: number
      pending: Promise<Record<string, unknown>[]>
    }
  | undefined

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locale = normalizeContentLocale(req.query.locale)
    const paginated =
      typeof req.query.cursor === "string" ||
      typeof req.query.limit === "string"
    const cursor = nonNegativeInteger(req.query.cursor, 0)
    const limit = paginated ? boundedLimit(req.query.limit, 4) : 100
    const sort: Record<string, 1 | -1> =
      req.query.sort === "trending"
        ? { "stats.viewCount": -1, createdAt: -1, _id: -1 }
        : { createdAt: -1, _id: -1 }
    const filter = publicVideoListFilter(req.query.sort)
    const [contents, total, { mapVideo }] = await Promise.all([
      getPublicContents(filter, limit, cursor, sort),
      ContentModel.countDocuments(filter),
      getContentMappers(locale),
    ])
    const videos = contents.map(mapVideo)

    if (!paginated) {
      res.status(200).json({ videos, total })
      return
    }
    const nextOffset = cursor + videos.length
    res.status(200).json({
      items: videos,
      nextCursor: nextOffset < total ? String(nextOffset) : null,
      total,
    })
  } catch (error) {
    next(error)
  }
})

router.get(
  "/:id/interaction",
  authenticateUser,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const content = await findPublicVideo(req.params.id)
      if (!content) {
        res.status(404).json({ error: "Video not found" })
        return
      }
      const interaction = await getVideoInteraction(
        getRequestActor(res).id,
        stringValue(content._id)
      )
      res.status(200).json({ interaction })
    } catch (error) {
      next(error)
    }
  }
)

router.patch(
  "/:id/interaction",
  authenticateUser,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const content = await findPublicVideo(req.params.id)
      if (!content) {
        res.status(404).json({ error: "Video not found" })
        return
      }
      const body = isRecord(req.body) ? req.body : {}
      const userId = getRequestActor(res).id
      const contentId = stringValue(content._id)
      let interaction
      if ("reaction" in body) {
        const reaction = body.reaction
        if (reaction !== null && reaction !== "like" && reaction !== "dislike")
          throw invalid("reaction must be like, dislike, or null")
        interaction = await setVideoReaction(userId, contentId, reaction)
      } else if (typeof body.watchLater === "boolean") {
        interaction = await setVideoCollectionFlag(
          userId,
          contentId,
          "watchLater",
          body.watchLater
        )
      } else if (typeof body.saved === "boolean") {
        interaction = await setVideoCollectionFlag(
          userId,
          contentId,
          "saved",
          body.saved
        )
      } else {
        throw invalid("No supported interaction field was provided")
      }
      res.status(200).json({ interaction })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/:id/history",
  authenticateUser,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const content = await findPublicVideo(req.params.id)
      if (!content) {
        res.status(404).json({ error: "Video not found" })
        return
      }
      await markVideoWatched(getRequestActor(res).id, stringValue(content._id))
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/:id/related",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const video = await findPublicVideo(req.params.id)
      if (!video) {
        res.status(404).json({ error: "Video not found" })
        return
      }
      const cursor = nonNegativeInteger(req.query.cursor, 0)
      const limit = boundedLimit(req.query.limit, 4)
      const filter = {
        ...publicVideoFilter(),
        _id: { $ne: stringValue(video._id) },
      }
      const [contents, total, { mapVideo }] = await Promise.all([
        getPublicContents(filter, limit, cursor),
        ContentModel.countDocuments(filter),
        getContentMappers(),
      ])
      const items = contents.map(mapVideo)
      const nextOffset = cursor + items.length
      res.status(200).json({
        items,
        nextCursor: nextOffset < total ? String(nextOffset) : null,
        total,
      })
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/:id/comments",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const video = await findPublicVideo(req.params.id)
      if (!video) {
        res.status(404).json({ error: "Video not found" })
        return
      }
      const result = await getVideoComments(
        stringValue(video._id),
        nonNegativeInteger(req.query.cursor, 0),
        boundedLimit(req.query.limit, 10)
      )
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/:id/comments",
  authenticateUser,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const video = await findPublicVideo(req.params.id)
      if (!video) {
        res.status(404).json({ error: "Video not found" })
        return
      }
      const body = isRecord(req.body) ? req.body : {}
      const message =
        typeof body.message === "string" ? body.message.trim() : ""
      if (!message || message.length > 2_000)
        throw invalid("Comment must contain between 1 and 2000 characters")
      const parentId =
        typeof body.parentId === "string" && body.parentId.trim()
          ? body.parentId.trim()
          : undefined
      const comment = await createVideoComment({
        contentId: stringValue(video._id),
        userId: getRequestActor(res).id,
        message,
        ...(parentId ? { parentId } : {}),
      })
      res.status(201).json({ comment })
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const locale = normalizeContentLocale(req.query.locale)
      const core = await getWatchCore(req.params.id)
      if (!core) {
        res.status(404).json({ error: "Video not found" })
        return
      }
      const { content, relatedContents } = core
      const commentCount = numberValue(toRecord(content.stats).commentCount)
      const [{ mapVideo }, comments] = await Promise.all([
        getContentMappers(locale),
        commentCount > 0
          ? getVideoComments(stringValue(content._id), 0, 10)
          : Promise.resolve({ items: [], nextCursor: null, total: 0 }),
      ])
      const video = mapVideo(content)
      const relatedVideos = relatedContents.map(mapVideo).map(toRelatedSummary)
      if (!video) {
        res.status(404).json({ error: "Video not found" })
        return
      }
      res.status(200).json({
        video,
        relatedVideos,
        relatedNextCursor: null,
        comments: comments.items,
        commentsNextCursor: comments.nextCursor,
        commentsTotal: comments.total,
      })
    } catch (error) {
      next(error)
    }
  }
)

function nonNegativeInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function getWatchCore(idOrSlug: string): Promise<WatchCore | null> {
  const key = idOrSlug.trim().toLowerCase()
  const cached = watchCoreCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.pending

  const pending = Promise.all([
    findPublicVideo(idOrSlug),
    // Fetch one extra candidate because the requested video may be inside the
    // shared random UUID slice. Both indexed queries can run in parallel.
    getRelatedPool(),
  ])
    .then(([content, candidates]) => {
      if (!content) return null
      const contentId = stringValue(content._id)
      return {
        content,
        relatedContents: candidates
          .filter((candidate) => stringValue(candidate._id) !== contentId)
          .slice(0, 20),
      }
    })
    .catch((error) => {
      watchCoreCache.delete(key)
      throw error
    })

  if (watchCoreCache.size >= 250) {
    const now = Date.now()
    for (const [cacheKey, entry] of watchCoreCache) {
      if (entry.expiresAt <= now) watchCoreCache.delete(cacheKey)
    }
    if (watchCoreCache.size >= 250) {
      const oldestKey = watchCoreCache.keys().next().value
      if (oldestKey) watchCoreCache.delete(oldestKey)
    }
  }
  watchCoreCache.set(key, {
    expiresAt: Date.now() + WATCH_CORE_CACHE_MS,
    pending,
  })
  return pending
}

function getRelatedPool() {
  if (relatedPoolCache && relatedPoolCache.expiresAt > Date.now())
    return relatedPoolCache.pending

  const pending = getRandomRelatedContents("", 21).catch((error) => {
    relatedPoolCache = undefined
    throw error
  })
  relatedPoolCache = {
    expiresAt: Date.now() + RELATED_POOL_CACHE_MS,
    pending,
  }
  return pending
}

function toRelatedSummary(video: Video): Video {
  return {
    id: video.id,
    title: video.title,
    description: "",
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount,
    publishedAt: video.publishedAt,
    category: video.category,
    ...(video.previewUrl ? { previewUrl: video.previewUrl } : {}),
    ...(video.channel ? { channel: video.channel } : {}),
  }
}

async function getRandomRelatedContents(excludedId: string, limit: number) {
  const seed = randomUUID()
  const findRange = (range: Record<string, string>) =>
    ContentModel.aggregate<Record<string, unknown>>(
      contentPagePipeline(
        {
          ...publicVideoFilter(),
          _id: { ...range, ...(excludedId ? { $ne: excludedId } : {}) },
        },
        limit,
        0,
        { _id: 1 }
      )
    )
      .hint({ _id: 1 })
      .exec()

  // Content IDs are UUIDv4, so an indexed seek from a random UUID produces a
  // random slice without MongoDB's $sample scanning the whole public catalog.
  const after = await findRange({ $gte: seed })
  if (after.length >= limit) return after
  const before = await findRange({ $lt: seed })
  return [...after, ...before.slice(0, limit - after.length)]
}

function boundedLimit(value: unknown, fallback: number) {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10)
  return Math.max(1, Math.min(Number.isFinite(parsed) ? parsed : fallback, 50))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function invalid(message: string) {
  return Object.assign(new Error(message), { name: "ValidationError" })
}

export default router
