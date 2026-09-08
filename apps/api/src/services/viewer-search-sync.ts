import { createHash, randomUUID } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import { ChannelModel, ContentModel, TermModel } from "@workspace/db/models"
import { ViewerSearch } from "./viewer-search-index"
import { contentSearchDocument, entityNames, searchableText } from "./viewer-search-text"

const BATCH = 250
const fields = ["actressIds", "actorIds", "studioIds", "directorIds", "channelIds", "termIds"]
const contentProjection = { title: 1, description: 1, translated: 1, slug: 1, metadata: 1,
  kind: 1, status: 1, visibility: 1, deletedAt: 1, createdAt: 1, updatedAt: 1,
  stats: 1, mediaIds: 1, actressIds: 1, actorIds: 1, studioIds: 1, directorIds: 1, channelIds: 1, termIds: 1 }
const entityProjection = { name: 1, slug: 1, handle: 1, aliases: 1, keywords: 1, translated: 1, metadata: 1, status: 1, deletedAt: 1 }
const stateCollection = () => ContentModel.db.collection<any>("viewer_search_state")

async function ensureSourceIndex(collection: typeof ContentModel.collection, key: Record<string, 1>, name: string) {
  const indexes = await collection.listIndexes().toArray()
  if (!indexes.some((index) => JSON.stringify(index.key) === JSON.stringify(key) && !index.partialFilterExpression))
    await collection.createIndex(key, { name })
}

async function writeContents(rows: Record<string, any>[], initial = false) {
  if (!rows.length) return
  const channelIds = [...new Set(rows.flatMap((row) => fields.filter((f) => f !== "termIds").flatMap((field) => row[field] ?? [])))]
  const termIds = [...new Set(rows.flatMap((row) => row.termIds ?? []))]
  const [channels, terms] = await Promise.all([
    channelIds.length ? ChannelModel.collection.find({ _id: { $in: channelIds } }, { projection: entityProjection }).toArray() : [],
    termIds.length ? TermModel.collection.find({ _id: { $in: termIds } }, { projection: entityProjection }).toArray() : [],
  ])
  const entities = new Map([...channels, ...terms].filter((e) => e.status === "active" && !e.deletedAt).map((e) => [String(e._id), e]))
  const existing = initial ? [] : await ViewerSearch.find({ _id: { $in: rows.map((r) => String(r._id)) } }).select("sourceHash").lean()
  const hashes = new Map(existing.map((row) => [String(row._id), row.sourceHash]))
  await ViewerSearch.bulkWrite(rows.map((row) => {
    const related = fields.flatMap((field) => row[field] ?? []).flatMap((id) => entities.has(id) ? [entities.get(id)!] : [])
    const { stats, updatedAt, ...searchFields } = row
    const sourceHash = createHash("sha256").update(JSON.stringify([searchFields, related])).digest("hex")
    if (hashes.get(String(row._id)) === sourceHash) return { updateOne: {
      filter: { _id: String(row._id) }, update: { $set: { stats, updatedAt, indexedAt: new Date() } },
    } }
    return { replaceOne: { filter: { _id: String(row._id) }, upsert: true,
      replacement: { ...contentSearchDocument(row, related), sourceHash },
    } }
  }), { ordered: false })
}

async function writeChannels(rows: Record<string, any>[]) {
  if (!rows.length) return
  await ViewerSearch.bulkWrite(rows.map((row) => ({ replaceOne: {
    filter: { _id: `channel:${row._id}` }, upsert: true,
    replacement: { _id: `channel:${row._id}`, scope: "channel", sourceId: String(row._id),
      titleText: row.status === "active" && !row.deletedAt ? searchableText(entityNames(row)) : "",
      indexedAt: new Date(),
    },
  } })), { ordered: false })
}

async function changedEntityIds(source: string, rows: Record<string, any>[], force: boolean) {
  const states = stateCollection()
  const keys = rows.map((row) => `entity:${source}:${row._id}`)
  const previous = await states.find({ _id: { $in: keys } }, { projection: { hash: 1 } }).toArray()
  const hashes = new Map(previous.map((row) => [row._id, row.hash]))
  const changed: string[] = []
  const writes = rows.map((row) => {
    const key = `entity:${source}:${row._id}`
    const hash = createHash("sha256").update(JSON.stringify([row.status, row.deletedAt, entityNames(row)])).digest("hex")
    if (force || hashes.get(key) !== hash) changed.push(String(row._id))
    return { updateOne: { filter: { _id: key }, update: { $set: { hash } }, upsert: true } }
  })
  // Commit fingerprints only after all dependent content writes succeed.
  return { ids: changed, commit: async () => { if (writes.length) await states.bulkWrite(writes) } }
}

async function reconcileDeletedRows(after: string) {
  // Incrementally remove hard-deleted sources without scanning the full catalogue.
  const rows = await ViewerSearch.find({ _id: { $gt: after } }).select("scope sourceId").sort({ _id: 1 }).limit(1_000).lean()
  if (!rows.length) return ""
  const contentIds = rows.filter((r) => r.scope === "content").map((r) => String(r.sourceId))
  const channelIds = rows.filter((r) => r.scope === "channel").map((r) => String(r.sourceId))
  const [contents, channels] = await Promise.all([
    ContentModel.find({ _id: { $in: contentIds } }).select("_id").lean(),
    ChannelModel.find({ _id: { $in: channelIds } }).select("_id").lean(),
  ])
  const existingContents = new Set(contents.map((r) => String(r._id)))
  const existingChannels = new Set(channels.map((r) => String(r._id)))
  const missing = rows.filter((r) => r.scope === "content" ? !existingContents.has(String(r.sourceId))
    : r.scope === "channel" && !existingChannels.has(String(r.sourceId))).map((r) => r._id)
  if (missing.length) await ViewerSearch.deleteMany({ _id: { $in: missing } })
  return String(rows.at(-1)!._id)
}

/** Resumable single-writer sync, including imports made outside the API. */
export async function syncViewerSearch(log: (message: string) => void = console.log) {
  const states = stateCollection()
  const owner = randomUUID()
  await states.updateOne({ _id: "lease" }, { $setOnInsert: { until: new Date(0) } }, { upsert: true })
  const lease = await states.findOneAndUpdate({ _id: "lease", until: { $lt: new Date() } },
    { $set: { owner, until: new Date(Date.now() + 120_000) } }, { returnDocument: "after" })
  if (!lease) return
  const renew = async () => {
    const result = await states.updateOne({ _id: "lease", owner }, { $set: { until: new Date(Date.now() + 120_000) } })
    if (!result.matchedCount) throw new Error("Search sync lease lost")
  }
  // Long index builds can outlive a batch; keep the lease alive meanwhile.
  const heartbeat = setInterval(() => { void renew().catch((error) => log(`[Search index] Lease renewal failed: ${error}`)) }, 30_000)
  heartbeat.unref()
  try {
    await ViewerSearch.createIndexes()
    await renew()
    for (const model of [ContentModel, ChannelModel, TermModel]) {
      await ensureSourceIndex(model.collection, { updatedAt: 1, _id: 1 }, "viewer_search_sync_updated")
      await renew()
    }
    await ensureSourceIndex(ContentModel.collection, { channelIds: 1 }, "viewer_search_channel_refs")
    let state = await states.findOne({ _id: "build" })
    if (!state) {
      await states.updateOne({ _id: "build" }, { $setOnInsert: { since: new Date(), ready: false, contentsAfter: "", channelsAfter: "", scanned: 0 } }, { upsert: true })
      state = await states.findOne({ _id: "build" })
    }
    if (!state!.ready) {
      for (const source of ["contents", "channels"] as const) {
        const model = source === "contents" ? ContentModel : ChannelModel
        const checkpoint = `${source}After`
        if (state![`${source}Done`]) continue
        let after = state![checkpoint] ?? ""
        while (true) {
          await renew()
          const rows = await model.collection.find({ _id: { $gt: after } }, {
            projection: source === "contents" ? contentProjection : entityProjection,
          }).sort({ _id: 1 }).hint({ _id: 1 }).limit(BATCH).toArray()
          if (!rows.length) break
          if (source === "contents") await writeContents(rows, true)
          else {
            await writeChannels(rows)
            // Initial catch-up must also propagate names changed during the build.
          }
          after = String(rows.at(-1)!._id)
          await states.updateOne({ _id: "build" }, { $set: { [checkpoint]: after }, $inc: { scanned: rows.length } })
          log(`[Search index] ${source}: ${rows.length} indexed; cursor ${after}`)
          await delay(150)
        }
        await states.updateOne({ _id: "build" }, { $set: { [`${source}Done`]: true } })
      }
    }
    // Fixed upper bound + overlap prevents losing writes while a batch runs.
    const until = new Date()
    const since = new Date(new Date(state!.since).getTime() - 5_000)
    for (const source of ["contents", "channels", "terms"] as const) {
      const model = source === "contents" ? ContentModel : source === "channels" ? ChannelModel : TermModel
      const cursor = model.collection.find({ updatedAt: { $gte: since, $lte: until } }, {
        projection: source === "contents" ? contentProjection : entityProjection,
      }).sort({ updatedAt: 1, _id: 1 }).hint({ updatedAt: 1, _id: 1 }).batchSize(BATCH)
      let batch: Record<string, any>[] = []
      const flush = async () => {
        await renew()
        if (source === "contents") await writeContents(batch)
        else {
          if (source === "channels") await writeChannels(batch)
          const changes = await changedEntityIds(source, batch, !state!.ready)
          const ids = changes.ids
          if (!ids.length) { batch = []; return }
          // Walk references through each existing multikey index, in bounded batches.
          for (const field of source === "terms" ? ["termIds"] : fields.filter((f) => f !== "termIds")) {
            const refs = ContentModel.collection.find({ [field]: { $in: ids } }, { projection: contentProjection }).batchSize(BATCH)
            let contents: Record<string, any>[] = []
            for await (const row of refs) {
              contents.push(row)
              if (contents.length >= BATCH) { await renew(); await writeContents(contents); contents = []; await delay(150) }
            }
            await writeContents(contents)
          }
          await changes.commit()
        }
        batch = []
      }
      for await (const row of cursor) {
        batch.push(row)
        if (batch.length >= BATCH) { await flush(); await delay(150) }
      }
      if (batch.length) await flush()
    }
    const reconcileAfter = await reconcileDeletedRows(state!.reconcileAfter ?? "")
    await states.updateOne({ _id: "build" }, { $set: { ready: true, since: until, reconcileAfter, lastSyncedAt: new Date() } })
    if (!state!.ready) log("[Search index] Build and catch-up complete; multilingual search enabled")
  } finally {
    clearInterval(heartbeat)
    await states.updateOne({ _id: "lease", owner }, { $set: { until: new Date(0) } })
  }
}

let started = false
export function startViewerSearchSync() {
  if (started || process.env.VIEWER_SEARCH_SYNC === "off") return
  started = true
  const run = async () => {
    try { await syncViewerSearch() } catch (error) { console.error("[Search index] Sync failed; will retry", error) }
    setTimeout(run, 60_000).unref()
  }
  setTimeout(run, 5_000).unref()
}
