import { mongoose } from "@workspace/db/mongoose"
import type { PipelineStage } from "mongoose"
import { ContentModel } from "@workspace/db/models"
import { getPublicContentSummaries, publicVideoFilter, stringValue } from "./content-video.service"
import { searchQuery } from "./viewer-search-text"

const schema = new mongoose.Schema({
  _id: String, scope: String, sourceId: String, kind: String,
  status: String, visibility: String, deletedAt: Date,
  titleText: String, descriptionText: String, relationText: String, codeText: String,
  createdAt: Date, updatedAt: Date, indexedAt: Date,
  stats: mongoose.Schema.Types.Mixed, metadata: mongoose.Schema.Types.Mixed,
  mediaIds: [String],
}, { collection: "viewer_search", strict: false, versionKey: false })
schema.index({ scope: 1, titleText: "text", descriptionText: "text", relationText: "text", codeText: "text" }, {
  name: "viewer_multilingual_v1", default_language: "none",
  weights: { codeText: 50, titleText: 10, relationText: 5, descriptionText: 1 },
})
export const ViewerSearch = mongoose.models.ViewerSearch ?? mongoose.model("ViewerSearch", schema)

let readiness: { until: number; ready: boolean } | undefined
export async function viewerSearchReady() {
  if (ContentModel.db.readyState !== 1) return false
  if (readiness && readiness.until > Date.now()) return readiness.ready
  const state = await ContentModel.db.collection("viewer_search_state").findOne({ _id: "build" as any })
  const ready = Boolean(state?.ready)
  readiness = { until: Date.now() + 5_000, ready }
  return ready
}

export function indexedSearchFilter(q: string, filter: Record<string, unknown>) {
  const { $text, slug, ...base } = filter
  const query = searchQuery(q)
  return { ...base, scope: "content", ...(query ? { $text: { $search: query, $language: "none" } } : { _id: { $in: [] } }) }
}

export async function indexedSearchPage(filter: Record<string, unknown>, limit: number, offset: number, sort: PipelineStage.Sort["$sort"]) {
  const hits = await ViewerSearch.aggregate([
    { $match: filter }, { $sort: sort }, { $skip: offset }, { $limit: limit }, { $project: { _id: 1 } },
  ]).exec()
  const ids = hits.map((hit) => String(hit._id))
  if (!ids.length) return []
  // Publication is always checked against the source, even during index lag.
  const rows = await getPublicContentSummaries({ ...publicVideoFilter(), kind: filter.kind, _id: { $in: ids } }, limit, 0, null)
  const byId = new Map(rows.map((row) => [stringValue(row._id), row]))
  return ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : [])
}

export async function indexedProfileIds(q: string) {
  const query = searchQuery(q)
  if (!query) return []
  const rows = await ViewerSearch.find({ scope: "channel", $text: { $search: query, $language: "none" } })
    .select("sourceId").sort({ score: { $meta: "textScore" }, _id: 1 }).limit(8).lean()
  return rows.map((row) => row.sourceId)
}
