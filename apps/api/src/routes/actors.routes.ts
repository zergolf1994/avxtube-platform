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
router.get("/", async (_req, res) => {
  const [rows, total] = await Promise.all([
    getPublicChannels(actorFilter(), 100, 0, { includeContentStats: true }),
    countPublicChannels(actorFilter()),
  ])
  res.json({ actors: rows.map(mapActor), total })
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
