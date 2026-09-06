import { Router } from "express"
import { performance } from "node:perf_hooks"
import {
  ChannelModel,
  ContentModel,
  MediaModel,
  TermModel,
} from "@workspace/db/models"
import {
  getPublicChannels,
  mapActor,
  publicChannelFilter,
} from "../services/channel-viewer.service"
import {
  escapeRegExp,
  getPublicContents,
  getContentMappers,
  normalizeContentLocale,
  publicVideoFilter,
  stringValue,
} from "../services/content-video.service"
import { SearchCountCache } from "../services/search-count-cache"
import { searchSort } from "../services/search-sort"

const router: Router = Router()
const searchCounts = new SearchCountCache()
router.get("/", async (req, res) => {
  const startedAt = performance.now()
  const q = stringValue(req.query.q).slice(0, 200)
  const locale = normalizeContentLocale(req.query.locale)
  const type = stringValue(req.query.type) || "all"
  const page = Math.max(
    1,
    Number.parseInt(stringValue(req.query.page), 10) || 1
  )
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(stringValue(req.query.limit), 10) || 50)
  )
  const offset = (page - 1) * limit
  // Opt-in parts let the web page stream an exact count after the results.
  // Requests without a part retain the original complete response contract.
  const part = stringValue(req.query.part)
  const filter: Record<string, unknown> = {
    ...publicVideoFilter(),
    kind:
      type === "live"
        ? "live"
        : type === "video"
          ? "video"
          : type === "short"
            ? "short"
            : { $in: ["video", "short"] },
  }
  const pattern = new RegExp(escapeRegExp(q), "i")
  const channelSearch = {
    ...publicChannelFilter(),
    $or: [{ name: pattern }, { handle: pattern }],
  }
  const profileSearch = {
    ...publicChannelFilter(),
    $and: [
      { $or: [{ name: pattern }, { handle: pattern }] },
      {
        $or: [
          { kind: "person", "metadata.roles": "actor" },
          { kind: "organization", "metadata.roles": "studio" },
        ],
      },
    ],
  }
  // Resolve independent filters together instead of serial media/term scans.
  const relatedIds = q
    ? Promise.all([
        ChannelModel.distinct("_id", channelSearch),
        TermModel.distinct("_id", {
          status: "active",
          deletedAt: null,
          name: pattern,
        }),
      ])
    : Promise.resolve([[], []])
  const days: Record<string, number> = {
    today: 1,
    week: 7,
    month: 31,
    year: 366,
  }
  const age = days[stringValue(req.query.uploaded)]
  if (age) filter.createdAt = { $gte: new Date(Date.now() - age * 86400000) }
  const duration = stringValue(req.query.duration)
  const mediaFilters: Promise<string[]>[] = []
  if (["short", "medium", "long"].includes(duration)) {
    const seconds = {
      $max: [
        { $ifNull: ["$metadata.duration", 0] },
        { $ifNull: ["$metadata.hls.media.duration", 0] },
      ],
    }
    const comparison =
      duration === "short"
        ? { $lte: [seconds, 180] }
        : duration === "long"
          ? { $gt: [seconds, 1200] }
          : { $and: [{ $gt: [seconds, 180] }, { $lte: [seconds, 1200] }] }
    mediaFilters.push(
      MediaModel.distinct("_id", {
        deletedAt: null,
        error: null,
        purpose: { $in: ["video", "short"] },
        $expr: comparison,
      }).exec()
    )
  }
  const feature = stringValue(req.query.feature)
  if (feature === "4k" || feature === "captions") {
    mediaFilters.push(
      MediaModel.distinct("_id", {
        deletedAt: null,
        error: null,
        ...(feature === "4k"
          ? {
              purpose: { $in: ["video", "short"] },
              "metadata.height": { $gte: 2160 },
            }
          : { kind: "subtitle" }),
      }).exec()
    )
  }
  const [[channelIds, termIds], ...mediaIds] = await Promise.all([
    relatedIds,
    ...mediaFilters,
  ])
  if (q) {
    filter.$or = [
      { title: pattern },
      { description: pattern },
      translatedTextCondition(pattern),
      ...(channelIds.length
        ? [
            "studioIds",
            "actressIds",
            "actorIds",
            "directorIds",
            "channelIds",
          ].map((field) => ({ [field]: { $in: channelIds } }))
        : []),
      ...(termIds.length ? [{ termIds: { $in: termIds } }] : []),
    ]
  }
  if (mediaIds.length) {
    // An empty required media set makes the content intersection empty. Avoid
    // sending other, potentially huge $in arrays to MongoDB in that case.
    if (mediaIds.some((ids) => !ids.length)) filter._id = { $in: [] }
    else filter.$and = mediaIds.map((ids) => ({ mediaIds: { $in: ids } }))
  }
  const filtersReadyAt = performance.now()
  const countKey = JSON.stringify([
    q,
    filter.kind,
    age ?? null,
    ["short", "medium", "long"].includes(duration) ? duration : "",
    ["4k", "captions"].includes(feature) ? feature : "",
  ])
  if (part === "count") {
    const [count, actors] = await Promise.all([
      searchCounts.getOrLoad(countKey, () =>
        ContentModel.countDocuments(filter).exec()
      ),
      type === "all" && q ? getPublicChannels(profileSearch, 8) : [],
    ])
    res.setHeader(
      "Server-Timing",
      [
        `search_filters;dur=${(filtersReadyAt - startedAt).toFixed(1)}`,
        `search_count;dur=${(performance.now() - filtersReadyAt).toFixed(1)}`,
      ].join(", ")
    )
    res.json({ total: count + actors.length, contentTotal: count })
    return
  }
  const sort = searchSort(req.query.sort)
  const [contents, actors, { mapVideo, mapShort }] = await Promise.all([
    getPublicContents(filter, limit, offset, sort),
    page === 1 && type === "all" && q
      ? getPublicChannels(profileSearch, 8)
      : [],
    getContentMappers(locale),
  ])
  const pageReadyAt = performance.now()
  // The first page is exhaustive when it contains fewer than the requested
  // page size. Later empty/short pages still need the catalogue count.
  // particular, an empty search must not scan the entire catalogue twice.
  // Locale and sort do not change membership, so they share the same count.
  const totalContents =
    page === 1 && contents.length < limit
      ? contents.length
      : part === "results"
        ? undefined
        : Math.max(
            contents.length,
            await searchCounts.getOrLoad(countKey, () =>
              ContentModel.countDocuments(filter).exec()
            )
          )
  const countedAt = performance.now()
  res.setHeader(
    "Server-Timing",
    [
      `search_filters;dur=${(filtersReadyAt - startedAt).toFixed(1)}`,
      `search_page;dur=${(pageReadyAt - filtersReadyAt).toFixed(1)}`,
      `search_count;dur=${(countedAt - pageReadyAt).toFixed(1)}`,
    ].join(", ")
  )
  res.json({
    videos: contents.filter((item) => item.kind === "video").map(mapVideo),
    shorts: contents.filter((item) => item.kind === "short").map(mapShort),
    actors: actors.map(mapActor),
    playlists: [],
    ...(totalContents === undefined
      ? {}
      : {
          total: totalContents + actors.length,
          contentTotal: totalContents,
        }),
  })
})

function translatedTextCondition(pattern: RegExp) {
  return {
    $expr: {
      $anyElementTrue: {
        $map: {
          input: { $objectToArray: { $ifNull: ["$translated", {}] } },
          as: "translation",
          in: {
            $or: [
              {
                $regexMatch: {
                  input: { $ifNull: ["$$translation.v.title", ""] },
                  regex: pattern,
                },
              },
              {
                $regexMatch: {
                  input: { $ifNull: ["$$translation.v.description", ""] },
                  regex: pattern,
                },
              },
            ],
          },
        },
      },
    },
  }
}
export default router
