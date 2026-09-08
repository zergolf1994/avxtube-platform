import { Router } from "express"
import { performance } from "node:perf_hooks"
import { ContentModel, MediaModel } from "@workspace/db/models"
import {
  getPublicChannels,
  mapActor,
  publicChannelFilter,
} from "../services/channel-viewer.service"
import {
  getPublicContentSummaries,
  getContentMappers,
  normalizeContentLocale,
  publicVideoFilter,
  stringValue,
} from "../services/content-video.service"
import { SearchCountCache } from "../services/search-count-cache"
import { searchSort } from "../services/search-sort"
import {
  ViewerSearch, viewerSearchReady, indexedSearchFilter,
  indexedSearchPage, indexedProfileIds,
} from "../services/viewer-search-index"

const router: Router = Router()
const searchCounts = new SearchCountCache()

function contentTextSearch(q: string) {
  const normalizedCode = q
    .toLocaleLowerCase("en")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
  return /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+[a-z0-9-]*$/.test(normalizedCode)
    ? `"${normalizedCode}"`
    : q
}

function contentSlugPrefix(q: string) {
  if (/^\d{5,}$/.test(q)) return `fc2-ppv-${q}`
  const normalized = q
    .toLocaleLowerCase("en")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
  return /^[a-z][a-z0-9]{1,11}(?:-[a-z0-9]+)*-\d{2,}$/.test(normalized)
    ? normalized
    : ""
}

router.get("/", async (req, res) => {
  const startedAt = performance.now()
  const q = stringValue(req.query.q).trim().slice(0, 200)
  const slugPrefix = contentSlugPrefix(q)
  const useIndex = Boolean(q) && await viewerSearchReady()
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
  const profileSearch: Record<string, unknown> = {
    ...publicChannelFilter(),
    ...(q && !slugPrefix ? { $text: { $search: q } } : {}),
    $or: [
      { kind: "person", "metadata.roles": "actor" },
      { kind: "organization", "metadata.roles": "studio" },
    ],
  }
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
  const mediaIds = await Promise.all(mediaFilters)
  // Product codes are often pasted incompletely, and bare FC2 numbers commonly
  // omit `fc2-ppv-`. Text search only matches complete tokens, so use the
  // indexed slug prefix for these forms instead of a catalogue-wide regex.
  if (slugPrefix) {
    filter.slug = {
      $regex: new RegExp(`^${slugPrefix}`),
      $type: "string",
    }
  }
  // Keep the catalogue query on the compound text index. Combining text,
  // channel and term branches in one $or made MongoDB scan and score several
  // large candidate sets before it could paginate. Actor/studio matches are
  // still returned by the separate indexed profile search below.
  else if (q) filter.$text = { $search: contentTextSearch(q) }
  if (mediaIds.length) {
    // An empty required media set makes the content intersection empty. Avoid
    // sending other, potentially huge $in arrays to MongoDB in that case.
    if (mediaIds.some((ids) => !ids.length)) filter._id = { $in: [] }
    else filter.$and = mediaIds.map((ids) => ({ mediaIds: { $in: ids } }))
  }
  const queryFilter = useIndex ? indexedSearchFilter(q, filter) : filter
  if (useIndex && type === "all" && (page === 1 || part === "count")) {
    delete profileSearch.$text
    profileSearch._id = { $in: await indexedProfileIds(q) }
  }
  const loadCount = () => useIndex
    ? ViewerSearch.countDocuments(queryFilter).exec()
    : ContentModel.countDocuments(filter).exec()
  const filtersReadyAt = performance.now()
  const countKey = JSON.stringify([
    useIndex ? "multilingual-v1" : "legacy",
    q,
    filter.kind,
    age ?? null,
    ["short", "medium", "long"].includes(duration) ? duration : "",
    ["4k", "captions"].includes(feature) ? feature : "",
  ])
  if (part === "count") {
    const [count, actors] = await Promise.all([
      searchCounts.getOrLoad(countKey, loadCount),
      type === "all" && q && (!slugPrefix || useIndex)
        ? getPublicChannels(profileSearch, 8)
        : [],
    ])
    res.setHeader(
      "Server-Timing",
      [
        `search_filters;dur=${(filtersReadyAt - startedAt).toFixed(1)}`,
        `search_count;dur=${(performance.now() - filtersReadyAt).toFixed(1)}`,
      ].join(", ")
    )
    res.setHeader(
      "Cache-Control",
      "public, max-age=30, stale-while-revalidate=300"
    )
    res.json({ total: count + actors.length, contentTotal: count })
    return
  }
  const requestedSort = stringValue(req.query.sort)
  const sort =
    !useIndex && slugPrefix && (!requestedSort || requestedSort === "relevance")
      ? { slug: 1 as const, _id: 1 as const }
      : searchSort(requestedSort, Boolean(q) && (useIndex || !slugPrefix))
  const [contents, actors, { mapVideoSummary, mapShortSummary }] =
    await Promise.all([
      useIndex ? indexedSearchPage(queryFilter, limit, offset, sort) : getPublicContentSummaries(filter, limit, offset, sort),
      page === 1 && type === "all" && q && (!slugPrefix || useIndex)
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
    !useIndex && page === 1 && contents.length < limit
      ? contents.length
      : part === "results"
        ? undefined
        : Math.max(
            contents.length,
            await searchCounts.getOrLoad(countKey, loadCount)
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
  res.setHeader(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=300"
  )
  res.json({
    videos: contents
      .filter((item) => item.kind === "video")
      .map(mapVideoSummary),
    shorts: contents
      .filter((item) => item.kind === "short")
      .map(mapShortSummary),
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
export default router
