import { getRelatedVideos } from "../services/related-videos.service"
import type { Video } from "@workspace/core/types"
import { ContentModel } from "@workspace/db/models"
import { Router, type NextFunction, type Request, type Response } from "express"

import {
  authenticateUser,
  getRequestActor,
} from "../middlewares/user-access.middleware"
import {
  findPublicVideo,
  getPublicContentSummaries,
  countPublicContents,
  getContentMappers,
  hasMaterializedActressCounts,
  normalizeContentLocale,
  publicVideoFilter,
  publicVideoListFilter,
  resolveCategoryId,
  stringValue,
  numberValue,
  toRecord,
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
const VIDEO_PAGE_CACHE_MS = 30_000
const videoPageCache = new Map<
  string,
  {
    expiresAt: number
    pending: Promise<{ videos: Video[]; total: number }>
  }
>()
type WatchCore = {
  content: Record<string, unknown>
  relatedContents: Record<string, unknown>[]
}
const watchCoreCache = new Map<
  string,
  { expiresAt: number; pending: Promise<WatchCore | null> }
>()

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
        : req.query.sort === "releaseDate"
          ? { "metadata.releaseDate": -1, _id: -1 }
          : { createdAt: -1, _id: -1 }
    const filter = publicVideoListFilter(req.query.sort)
    const requestedCategory =
      typeof req.query.category === "string" ? req.query.category : "all"
    const categoryId = await resolveCategoryId(requestedCategory)
    if (categoryId === null) {
      res
        .status(200)
        .json(
          paginated
            ? { items: [], nextCursor: null, total: 0 }
            : { videos: [], total: 0 }
        )
      return
    }
    if (categoryId) filter.termIds = categoryId
    const actressFilter =
      req.query.actress === "single" || req.query.actress === "multiple"
        ? req.query.actress
        : null
    if (actressFilter) {
      if (await hasMaterializedActressCounts()) {
        filter.actressCount = actressFilter === "single" ? 1 : { $gte: 2 }
      } else if (actressFilter === "single") {
        filter["actressIds.0"] = { $exists: true }
        filter["actressIds.1"] = { $exists: false }
      } else {
        filter["actressIds.1"] = { $exists: true }
      }
    }
    const cacheKey = JSON.stringify({
      locale: locale ?? "en",
      cursor,
      limit,
      sort: req.query.sort ?? "latest",
      category: requestedCategory,
      actress: actressFilter ?? "all",
      paginated,
    })
    const cached = videoPageCache.get(cacheKey)
    let pending =
      cached && cached.expiresAt > Date.now() ? cached.pending : undefined
    if (!pending) {
      pending = Promise.all([
        getPublicContentSummaries(filter, limit, cursor, sort),
        countPublicContents(filter),
        getContentMappers(locale),
      ])
        .then(([contents, total, { mapVideoSummary }]) => ({
          videos: contents.map(mapVideoSummary),
          total,
        }))
        .catch((error) => {
          videoPageCache.delete(cacheKey)
          throw error
        })
      if (videoPageCache.size >= 500) videoPageCache.clear()
      videoPageCache.set(cacheKey, {
        expiresAt: Date.now() + VIDEO_PAGE_CACHE_MS,
        pending,
      })
    }
    const { videos, total } = await pending
    res.setHeader(
      "Cache-Control",
      "public, max-age=10, stale-while-revalidate=30"
    )

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
      const [recommendations, { mapVideoSummary }] = await Promise.all([
        getRelatedVideos(video),
        getContentMappers(normalizeContentLocale(req.query.locale)),
      ])
      const total = recommendations.length
      const contents = recommendations.slice(cursor, cursor + limit)
      const items = contents.map(mapVideoSummary)
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

  const pending = findPublicVideo(idOrSlug)
    .then(async (content) => {
      if (!content) return null
      return {
        content,
        relatedContents: await getRelatedVideos(content),
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
