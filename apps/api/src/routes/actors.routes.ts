import { Router } from "express"
import {
  getPublicChannels,
  countPublicChannels,
  mapActor,
  publicChannelFilter,
} from "../services/channel-viewer.service"
import {
  getPublicContentSummaries,
  getContentMappers,
  publicVideoFilter,
  contentChannelFilter,
} from "../services/content-video.service"

const router: Router = Router()
const actorFilter = (): Record<string, unknown> => ({
  ...publicChannelFilter(),
  kind: "person",
  "metadata.roles": "actor",
})
router.get("/", async (req, res) => {
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.limit ?? "100"), 10) || 100)
  )
  const offset = Math.max(
    0,
    Number.parseInt(String(req.query.cursor ?? "0"), 10) || 0
  )
  const [rows, total] = await Promise.all([
    getPublicChannels(actorFilter(), limit, offset, {
      includeContentStats: true,
    }),
    countPublicChannels(actorFilter()),
  ])
  res.setHeader(
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=300"
  )
  res.json({
    actors: rows.map(mapActor),
    total,
    nextCursor:
      offset + rows.length < total ? String(offset + rows.length) : null,
  })
})
router.get("/:handle", async (req, res) => {
  const [row] = await getPublicChannels(
    {
      ...actorFilter(),
      handle: req.params.handle.replace(/^@/, "").toLowerCase(),
    },
    1,
    0,
    { includeContentStats: true }
  )
  if (!row) {
    res.status(404).json({ error: "Actor not found" })
    return
  }
  const actor = mapActor(row)
  const contents = await getPublicContentSummaries(
    { ...publicVideoFilter(), ...contentChannelFilter(actor.id) },
    48
  )
  const { mapVideoSummary } = await getContentMappers()
  res.json({ actor, videos: contents.map(mapVideoSummary) })
})
export default router
