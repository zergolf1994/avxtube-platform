import { Router, type NextFunction, type Request, type Response } from "express"
import { mockPlaylists } from "../data/mock-playlists"

import {
  getPublicVideoCategories,
  getPublicContents,
  getContentMappers,
  normalizeContentLocale,
  publicVideoFilter,
  resolveCategoryId,
} from "../services/content-video.service"

const router: Router = Router()
const HOME_CACHE_MS = 30_000
const homeCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>()

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locale = normalizeContentLocale(req.query.locale)
    const requestedCategory =
      typeof req.query.category === "string" ? req.query.category : "all"
    const cacheKey = `${locale ?? "en"}:${requestedCategory.trim().toLowerCase()}`
    const cached = homeCache.get(cacheKey)
    res.setHeader(
      "Cache-Control",
      "public, max-age=10, stale-while-revalidate=30"
    )
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader("X-Home-Cache", "HIT")
      res.status(200).json(cached.payload)
      return
    }
    const categoryId = await resolveCategoryId(requestedCategory)
    const categories = await getPublicVideoCategories()

    if (categoryId === null) {
      const payload = { categories, videos: [], shorts: [], playlists: [] }
      homeCache.set(cacheKey, {
        expiresAt: Date.now() + HOME_CACHE_MS,
        payload,
      })
      res.setHeader("X-Home-Cache", "MISS")
      res.status(200).json(payload)
      return
    }

    const filter: Record<string, unknown> = publicVideoFilter()
    if (categoryId) filter.termIds = categoryId
    const [contents, shortContents, { mapVideo, mapShort }] = await Promise.all(
      [
        getPublicContents(filter, requestedCategory === "all" ? 24 : 48),
        requestedCategory === "all"
          ? getPublicContents(publicVideoFilter("short"), 10)
          : [],
        getContentMappers(locale),
      ]
    )
    const videos = contents.map(mapVideo)

    const payload = {
      categories,
      videos,
      shorts: shortContents.map(mapShort),
      playlists: [],
    }
    if (homeCache.size > 500) homeCache.clear()
    homeCache.set(cacheKey, {
      expiresAt: Date.now() + HOME_CACHE_MS,
      payload,
    })
    res.setHeader("X-Home-Cache", "MISS")
    res.status(200).json(payload)
  } catch (error) {
    next(error)
  }
})

router.get("/feed", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type =
      req.query.type === "shorts" || req.query.type === "playlists"
        ? req.query.type
        : "videos"
    const page = positiveInteger(req.query.page, 1, 100_000)
    const pageSize = positiveInteger(req.query.pageSize, 12, 48)
    const start = (page - 1) * pageSize
    res.setHeader(
      "Cache-Control",
      "public, max-age=10, stale-while-revalidate=30"
    )

    if (type === "playlists") {
      const items = mockPlaylists.slice(start, start + pageSize)
      res.json({
        type,
        page,
        items,
        nextPage: start + items.length < mockPlaylists.length ? page + 1 : null,
      })
      return
    }

    const requestedCategories = queryStrings(req.query.category).filter(
      (category) => category !== "all"
    )
    const resolvedCategories = await Promise.all(
      requestedCategories.map(resolveCategoryId)
    )
    if (resolvedCategories.some((categoryId) => categoryId === null)) {
      res.json({ type, page, items: [], nextPage: null })
      return
    }
    const filter: Record<string, unknown> = publicVideoFilter(
      type === "shorts" ? "short" : "video"
    )
    const categoryIds = resolvedCategories.filter(
      (categoryId): categoryId is string => Boolean(categoryId)
    )
    if (categoryIds.length) filter.termIds = { $in: categoryIds }
    const sort: Record<string, 1 | -1> =
      req.query.sort === "trending"
        ? { "stats.viewCount": -1, createdAt: -1, _id: -1 }
        : req.query.sort === "releaseDate"
          ? { "metadata.releaseDate": -1, _id: -1 }
          : { createdAt: -1, _id: -1 }
    const locale = normalizeContentLocale(req.query.locale)
    const [{ mapVideo, mapShort }, rows] = await Promise.all([
      getContentMappers(locale),
      getPublicContents(filter, pageSize + 1, start, sort),
    ])
    const hasMore = rows.length > pageSize
    const mapper = type === "shorts" ? mapShort : mapVideo
    res.json({
      type,
      page,
      items: rows.slice(0, pageSize).map(mapper),
      nextPage: hasMore ? page + 1 : null,
    })
  } catch (error) {
    next(error)
  }
})

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10)
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback
}

function queryStrings(value: unknown) {
  const values = Array.isArray(value) ? value : [value]
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

export default router
