import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { dbConnect, dbDisconnect } from "@workspace/db/mongoose"
import { ContentModel } from "@workspace/db/models"
import { ViewerSearch, indexedSearchFilter } from "../src/services/viewer-search-index"
import { contentSearchDocument } from "../src/services/viewer-search-text"

test("Mongo multilingual index: aliases, partial codes, visibility, score and pagination", {
  skip: process.env.VIEWER_SEARCH_DB_TEST !== "1",
}, async () => {
  await dbConnect()
  // Only this uniquely owned test collection is written/deleted; no content rows change.
  const collection = ContentModel.db.collection<any>(`viewer_search_test_${randomUUID().replaceAll("-", "")}`)
  try {
    for (const [keys, options] of ViewerSearch.schema.indexes())
      await collection.createIndex(keys as any, options as any)
    const common = { kind: "video", status: "published", visibility: "public", createdAt: new Date() }
    await collection.insertMany([
      contentSearchDocument({ ...common, _id: "a", slug: "abc-4972405", title: "Mountain", translated: {
        th: { title: "ท่องเที่ยวภูเขา" }, ja: { title: "東京の旅行" },
      } }, [{ name: "Alice", aliases: ["Alicia"] }]),
      contentSearchDocument({ ...common, _id: "b", slug: "xyz-4972406", title: "River", description: "Mountain" }, []),
      contentSearchDocument({ ...common, _id: "private", visibility: "private", slug: "abc-4972407", title: "Mountain" }, []),
    ])
    const filter = (q: string) => indexedSearchFilter(q, { kind: "video", status: "published", visibility: "public", deletedAt: null })
    for (const q of ["ท่องเที่ยว", "東京", "Alicia", "abc-497240", "４９７２４０５"])
      assert.deepEqual((await collection.find(filter(q)).toArray()).map((r) => r._id), ["a"], q)
    assert.equal(await collection.countDocuments(filter("497240")), 2)
    const sorted = () => collection.find(filter("Mountain")).sort({ score: { $meta: "textScore" }, _id: 1 })
    assert.deepEqual((await sorted().toArray()).map((r) => r._id), ["a", "b"])
    assert.deepEqual((await sorted().skip(1).limit(1).toArray()).map((r) => r._id), ["b"])
  } finally {
    await collection.drop()
    await dbDisconnect()
  }
})
