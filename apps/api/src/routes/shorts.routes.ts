import { Router } from "express"
import { mockComments } from "../data/mock-comments"
import {
  findPublicVideo,
  getPublicContentSummaries,
  countPublicContents,
  getContentMappers,
  publicVideoFilter,
  stringValue,
} from "../services/content-video.service"
const router: Router = Router()
router.get("/", async (req, res) => {
  const page = Math.max(
    1,
    Number.parseInt(stringValue(req.query.page), 10) || 1
  )
  const pageSize = Math.max(
    1,
    Math.min(Number.parseInt(stringValue(req.query.pageSize), 10) || 5, 10)
  )
  const start = (page - 1) * pageSize
  const filter = publicVideoFilter("short")
  const [contents, total, { mapShortSummary }] = await Promise.all([
    getPublicContentSummaries(filter, pageSize, start),
    countPublicContents(filter),
    getContentMappers(),
  ])
  const items = contents.map(mapShortSummary)
  res.json({
    items,
    shorts: items,
    page,
    pageSize,
    nextPage: start + items.length < total ? page + 1 : null,
    total,
  })
})
router.get("/:id/comments", async (req, res) => {
  const short = await findPublicVideo(req.params.id, "short")
  if (!short) {
    res.status(404).json({ error: "Short not found" })
    return
  }
  const cursor = Math.max(
    0,
    Number.parseInt(stringValue(req.query.cursor), 10) || 0
  )
  const limit = Math.max(
    1,
    Math.min(Number.parseInt(stringValue(req.query.limit), 10) || 4, 10)
  )
  const items = mockComments.slice(cursor, cursor + limit)
  res.json({
    items,
    nextCursor:
      cursor + items.length < mockComments.length
        ? String(cursor + items.length)
        : null,
    total: mockComments.length,
  })
})
router.get("/:id", async (req, res) => {
  const short = await findPublicVideo(req.params.id, "short")
  if (!short) {
    res.status(404).json({ error: "Short not found" })
    return
  }
  const { mapShort } = await getContentMappers()
  res.json({ short: mapShort(short) })
})
export default router
