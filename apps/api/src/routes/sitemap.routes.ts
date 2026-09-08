import { Router } from "express"
import { ChannelModel, ContentModel } from "@workspace/db/models"

import {
  getContentMappers,
  getPublicContentSummaries,
  publicVideoFilter,
  stringValue,
} from "../services/content-video.service"
import { publicChannelFilter } from "../services/channel-viewer.service"

const router: Router = Router()
const pageSize = 1_000
const sitemapTypes = ["videos", "shorts", "channels"] as const
type SitemapType = (typeof sitemapTypes)[number]

router.get("/", async (_req, res, next) => {
  try {
    const [videos, shorts, channels] = await Promise.all([
      contentSummary("video"),
      contentSummary("short"),
      channelSummary(),
    ])
    res.json({ pageSize, videos, shorts, channels })
  } catch (error) {
    next(error)
  }
})

router.get("/:type", async (req, res, next) => {
  try {
    const type = sitemapTypes.find((item) => item === req.params.type)
    if (!type) {
      res.status(404).json({ error: "Sitemap type not found" })
      return
    }
    const page = Math.max(
      1,
      Number.parseInt(stringValue(req.query.page), 10) || 1
    )
    const offset = (page - 1) * pageSize

    if (type === "channels") {
      const filter = {
        ...publicChannelFilter(),
        handle: { $type: "string" as const, $ne: "" },
      }
      const [rows, total] = await Promise.all([
        ChannelModel.find(filter)
          .select("handle updatedAt")
          .sort({ updatedAt: -1, _id: -1 })
          .skip(offset)
          .limit(pageSize)
          .lean(),
        ChannelModel.countDocuments(filter),
      ])
      res.json({
        type,
        page,
        pageSize,
        total,
        items: rows.map((row) => ({
          slug: row.handle,
          lastModified: row.updatedAt,
        })),
      })
      return
    }

    const kind = type === "videos" ? "video" : "short"
    const filter = {
      ...publicVideoFilter(kind),
      slug: { $type: "string" as const, $ne: "" },
    }
    const [rows, total, { mapVideoSummary, mapShortSummary }] =
      await Promise.all([
        getPublicContentSummaries(filter, pageSize, offset, {
          updatedAt: -1,
          _id: -1,
        }),
        ContentModel.countDocuments(filter),
        getContentMappers(),
      ])
    const mapper = kind === "video" ? mapVideoSummary : mapShortSummary
    res.json({
      type,
      page,
      pageSize,
      total,
      items: rows.map((row) => ({
        slug: stringValue(row.slug),
        lastModified: row.updatedAt,
        video: mapper(row),
      })),
    })
  } catch (error) {
    next(error)
  }
})

async function contentSummary(kind: "video" | "short") {
  const [summary] = await ContentModel.aggregate<{
    count: number
    lastModified?: Date
  }>([
    {
      $match: {
        ...publicVideoFilter(kind),
        slug: { $type: "string", $ne: "" },
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        lastModified: { $max: "$updatedAt" },
      },
    },
  ]).exec()
  return { count: summary?.count ?? 0, lastModified: summary?.lastModified }
}

async function channelSummary() {
  const [summary] = await ChannelModel.aggregate<{
    count: number
    lastModified?: Date
  }>([
    {
      $match: {
        ...publicChannelFilter(),
        handle: { $type: "string", $ne: "" },
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        lastModified: { $max: "$updatedAt" },
      },
    },
  ]).exec()
  return { count: summary?.count ?? 0, lastModified: summary?.lastModified }
}

export default router
