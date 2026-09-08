import { createHash } from "node:crypto"
import { ContentModel } from "@workspace/db/models"
import {
  getPublicContentSummaries,
  publicVideoFilter,
  stringArray,
  stringValue,
  toRecord,
} from "./content-video.service"

type Row = Record<string, unknown>
const cache = new Map<string, { expires: number; pending: Promise<Row[]> }>()
const projection = {
  _id: 1, slug: 1, actressIds: 1, actorIds: 1, studioIds: 1,
  termIds: 1, createdAt: 1,
}

function overlap(a: unknown, b: unknown) {
  const set = new Set(stringArray(a))
  return stringArray(b).filter((id) => set.has(id)).length
}

function codeFamily(row: Row) {
  return stringValue(row.slug).match(/^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-\d/i)?.[1]?.toLowerCase() ?? ""
}

export function rankRelated(source: Row, candidates: Row[], limit = 20) {
  const seen = new Set([stringValue(source._id)])
  const groups = { actor: [] as Row[], term: [] as Row[], studio: [] as Row[], other: [] as Row[] }
  const terms = Array.isArray(source.terms) ? source.terms.map(toRecord) : []
  const categories = terms.filter((t) => t.taxonomy === "category").map((t) => stringValue(t._id))
  const series = terms.filter((t) => t.taxonomy === "series").map((t) => stringValue(t._id))
  const family = codeFamily(source)
  const scored = candidates.filter((row) => {
    const id = stringValue(row._id)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  }).map((row) => {
    const actor = overlap([...stringArray(source.actressIds), ...stringArray(source.actorIds)],
      [...stringArray(row.actressIds), ...stringArray(row.actorIds)])
    const category = overlap(categories, row.termIds)
    const term = overlap(source.termIds, row.termIds)
    const studio = overlap(source.studioIds, row.studioIds)
    const score = actor * 100 + overlap(series, row.termIds) * 60 + category * 20 + term * 5 + studio * 10 + (family && family === codeFamily(row) ? 8 : 0)
    // Stable variation per source: adjacent pages do not all show the same ties.
    const tie = createHash("sha256").update(`${source._id}:${row._id}`).digest("hex")
    return { row, score, tie, group: actor ? "actor" : term ? "term" : studio ? "studio" : "other" } as const
  }).sort((a, b) => b.score - a.score || a.tie.localeCompare(b.tie))
  for (const item of scored) groups[item.group].push(item.row)
  const result: Row[] = []
  for (const [group, quota] of [["actor", 8], ["term", 6], ["studio", 4], ["other", 2]] as const)
    result.push(...groups[group].splice(0, quota))
  const chosen = new Set(result.map((row) => stringValue(row._id)))
  for (const { row } of scored) {
    if (result.length >= limit) break
    if (!chosen.has(stringValue(row._id))) result.push(row)
  }
  return result.slice(0, limit)
}

export async function getRelatedVideos(source: Row) {
  const key = stringValue(source._id)
  const existing = cache.get(key)
  if (existing && existing.expires > Date.now()) return existing.pending
  const pending = load(source).catch((error) => { cache.delete(key); throw error })
  if (cache.size >= 250) cache.delete(cache.keys().next().value!)
  cache.set(key, { expires: Date.now() + 120_000, pending })
  return pending
}

async function load(source: Row) {
  const base = { ...publicVideoFilter(), _id: { $ne: stringValue(source._id) } }
  const queries: Promise<Row[]>[] = []
  // Each branch is independently limited before combining or scoring.
  for (const field of ["actressIds", "actorIds", "studioIds", "termIds"] as const) {
    const ids = stringArray(source[field])
    if (!ids.length) continue
    const query = ContentModel.find({ ...base, [field]: { $in: ids.slice(0, 16) } }, projection)
    if (field === "termIds") query.hint({ termIds: 1, kind: 1, status: 1, visibility: 1, deletedAt: 1, createdAt: -1, _id: -1 })
    else query.hint({ [field]: 1, kind: 1, status: 1 })
    queries.push(query.limit(48).maxTimeMS(2_000).lean().exec())
  }
  const family = codeFamily(source)
  if (family) queries.push(ContentModel.find({ ...base, slug: { $regex: new RegExp(`^${family}-`), $type: "string" } }, projection)
    .hint({ kind: 1, slug: 1 }).sort({ slug: 1 }).limit(24).maxTimeMS(2_000).lean().exec())
  const results = await Promise.allSettled(queries)
  const groups = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])
  let ranked = rankRelated(source, groups.flat())
  if (ranked.length < 20) {
    const fallback = await ContentModel.find(base, projection).sort({ createdAt: -1, _id: -1 }).limit(40).lean().exec()
    ranked = rankRelated(source, [...groups.flat(), ...fallback])
  }
  const ids = ranked.map((row) => stringValue(row._id))
  if (!ids.length) return []
  const rows = await getPublicContentSummaries({ ...publicVideoFilter(), _id: { $in: ids } }, ids.length, 0, null)
  const byId = new Map(rows.map((row) => [stringValue(row._id), row]))
  return ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : [])
}
