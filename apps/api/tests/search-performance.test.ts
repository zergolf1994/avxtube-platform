import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"
import express from "express"
import {
  ChannelModel,
  ContentModel,
  MediaModel,
  SettingModel,
} from "@workspace/db/models"
import searchRouter from "../src/routes/search.routes"
import { SearchCountCache } from "../src/services/search-count-cache"
import { searchSort } from "../src/services/search-sort"
import { invalidateDomainSettingsCache } from "../src/services/settings/domain-setting.service"

afterEach(() => {
  invalidateDomainSettingsCache()
  mock.restoreAll()
})

test("sorts use real fields and deterministic ties, including reverse index scans", () => {
  assert.deepEqual(searchSort("relevance"), searchSort("latest"))
  assert.deepEqual(searchSort("unknown"), searchSort("latest"))
  assert.deepEqual(searchSort("relevance", true), {
    __searchScore: { $meta: "textScore" },
    _id: -1,
  })
  assert.deepEqual(searchSort("oldest"), { createdAt: 1, _id: 1 })
  assert.deepEqual(searchSort("release"), {
    "metadata.releaseDate": -1,
    _id: -1,
  })
  assert.deepEqual(searchSort("release-oldest"), {
    "metadata.releaseDate": 1,
    _id: 1,
  })
  assert.deepEqual(searchSort("views"), {
    "stats.viewCount": -1,
    createdAt: -1,
    _id: -1,
  })
})

test("count cache coalesces concurrent requests, expires and retries failures", async () => {
  let now = 0
  let loads = 0
  const cache = new SearchCountCache(30, 2, () => now)
  const load = async () => ++loads
  assert.deepEqual(
    await Promise.all([cache.getOrLoad("a", load), cache.getOrLoad("a", load)]),
    [1, 1]
  )
  now = 29
  assert.equal(await cache.getOrLoad("a", load), 1)
  now = 30
  assert.equal(await cache.getOrLoad("a", load), 2)
  await assert.rejects(
    cache.getOrLoad("b", async () => {
      throw new Error("database unavailable")
    })
  )
  assert.equal(await cache.getOrLoad("b", load), 3)
  await cache.getOrLoad("c", load)
  assert.equal(
    await cache.getOrLoad("a", load),
    5,
    "oldest entry must be evicted at capacity"
  )
})

function fixture(id: number) {
  return {
    _id: String(id),
    slug: `video-${id}`,
    title: "Current title",
    kind: "video",
    createdAt: new Date(0),
  }
}

function mockDatabase(initialRows: Record<string, unknown>[]) {
  let rows = initialRows
  const pipelines: Record<string, any>[][] = []
  mock.method(ContentModel, "aggregate", (pipeline: Record<string, any>[]) => {
    pipelines.push(pipeline)
    return { exec: async () => rows }
  })
  const count = mock.method(ContentModel, "countDocuments", () => ({
    exec: async () => 75,
  }))
  mock.method(ChannelModel, "aggregate", () => ({ exec: async () => [] }))
  mock.method(SettingModel, "findOne", () => ({ lean: async () => null }))
  return {
    pipelines,
    count,
    setRows: (value: typeof rows) => {
      rows = value
    },
  }
}

async function withServer(run: (url: string) => Promise<void>) {
  const server = express().use("/search", searchRouter).listen(0, "127.0.0.1")
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const port = (server.address() as { port: number }).port
  try {
    await run(`http://127.0.0.1:${port}/search`)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
}

test("empty and short first pages return exact counts without a second catalogue scan", async () => {
  const db = mockDatabase([])
  await withServer(async (url) => {
    for (const size of [0, 3, 49]) {
      db.setRows(Array.from({ length: size }, (_, i) => fixture(i)))
      const response = await fetch(`${url}?q=short-page&type=video`)
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.total, size)
      assert.equal(body.videos.length, size)
    }
  })
  assert.equal(db.count.mock.callCount(), 0)
})

test("full pages reuse counts across locale/sort but read fresh rows and keep filters", async () => {
  const db = mockDatabase(Array.from({ length: 50 }, (_, i) => fixture(i)))
  await withServer(async (url) => {
    const first = await (
      await fetch(`${url}?q=full-page&type=video&locale=th`)
    ).json()
    assert.equal(first.total, 75)
    db.setRows(
      Array.from({ length: 50 }, (_, i) => ({
        ...fixture(i),
        title: "Updated title",
      }))
    )
    const response = await fetch(
      `${url}?q=full-page&type=video&locale=en&sort=views`
    )
    const second = await response.json()
    assert.equal(second.total, 75)
    assert.equal(second.videos[0].title, "Updated title")
    assert.match(response.headers.get("server-timing") ?? "", /search_count/)
    assert.equal(db.count.mock.callCount(), 1)
    await fetch(`${url}?q=full-page&type=short`)
    assert.equal(
      db.count.mock.callCount(),
      2,
      "different membership must use a different count"
    )
  })
  const filter = db.pipelines[0]![0]!.$match
  assert.equal(filter.visibility, "public")
  assert.equal(filter.status, "published")
  assert.equal(filter.deletedAt, null)
  assert.deepEqual(filter.$text, { $search: "full-page" })
  assert.equal(filter.$or, undefined)
  assert.equal(filter.$expr, undefined)
  assert.deepEqual(db.pipelines[1]![1]!.$sort, {
    "stats.viewCount": -1,
    createdAt: -1,
    _id: -1,
  })
})

test("hyphenated DVD IDs use an indexed slug prefix", async () => {
  const db = mockDatabase([])
  await withServer(async (url) => {
    await fetch(`${url}?q=fct-206&type=video&part=results`)
  })
  const filter = db.pipelines[0]![0]!.$match
  assert.equal(filter.$text, undefined)
  assert.equal(filter.slug.$regex.source, "^fct-206")
  assert.equal(filter.slug.$type, "string")
  assert.deepEqual(db.pipelines[0]![1]!.$sort, { slug: 1, _id: 1 })
})

test("bare FC2 numbers use an indexed slug prefix", async () => {
  const db = mockDatabase([])
  await withServer(async (url) => {
    await fetch(`${url}?q=497240&type=video&part=results`)
  })
  const filter = db.pipelines[0]![0]!.$match
  assert.equal(filter.$text, undefined)
  assert.equal(filter.slug.$regex.source, "^fc2-ppv-497240")
  assert.equal(filter.slug.$type, "string")
  assert.deepEqual(db.pipelines[0]![1]!.$sort, { slug: 1, _id: 1 })
})

test("duration and feature can match different media; empty required media short-circuits", async () => {
  const db = mockDatabase([])
  let emptyFeature = false
  const mediaFilters: any[] = []
  mock.method(MediaModel, "distinct", (_field: string, filter: any) => {
    mediaFilters.push(filter)
    return {
      exec: async () =>
        filter.kind === "subtitle"
          ? emptyFeature
            ? []
            : ["subtitle-id"]
          : ["video-id"],
    }
  })
  await withServer(async (url) => {
    await fetch(
      `${url}?q=media&type=video&duration=medium&feature=captions&uploaded=week`
    )
    const filter = db.pipelines[0]![0]!.$match
    assert.deepEqual(filter.$and, [
      { mediaIds: { $in: ["video-id"] } },
      { mediaIds: { $in: ["subtitle-id"] } },
    ])
    assert.ok(filter.createdAt.$gte instanceof Date)
    assert.deepEqual(mediaFilters[0].$expr.$and[0].$gt[1], 180)
    assert.deepEqual(mediaFilters[0].$expr.$and[1].$lte[1], 1200)
    emptyFeature = true
    await fetch(`${url}?q=media&type=video&duration=long&feature=captions`)
    assert.deepEqual(db.pipelines[1]![0]!.$match._id, { $in: [] })
    assert.equal(db.pipelines[1]![0]!.$match.$and, undefined)
  })
  assert.equal(db.count.mock.callCount(), 0)
})

test("results omit a deferred count only for full pages; count-only does not load video relations", async () => {
  const db = mockDatabase(Array.from({ length: 50 }, (_, i) => fixture(i)))
  await withServer(async (url) => {
    const result = await (
      await fetch(`${url}?q=deferred&type=video&part=results`)
    ).json()
    assert.equal(result.videos.length, 50)
    assert.equal("total" in result, false)
    assert.equal(db.count.mock.callCount(), 0)
    const count = await (
      await fetch(`${url}?q=deferred&type=video&part=count`)
    ).json()
    assert.deepEqual(count, { total: 75, contentTotal: 75 })
    assert.equal(
      db.pipelines.length,
      1,
      "count-only must not join page relations"
    )
    const full = await (await fetch(`${url}?q=deferred&type=video`)).json()
    assert.equal(full.total, 75)
    assert.equal(
      db.count.mock.callCount(),
      1,
      "count-only and full responses share cache"
    )
    db.setRows([fixture(1)])
    const short = await (
      await fetch(`${url}?q=deferred&type=video&part=results`)
    ).json()
    assert.equal(
      short.total,
      1,
      "an exhaustive page wins over a stale cached count"
    )
  })
})
