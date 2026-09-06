import { Router, type NextFunction, type Request, type Response } from "express"

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

export default router
