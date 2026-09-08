import assert from "node:assert/strict"
import { test } from "node:test"
import { contentSearchDocument, searchQuery, entityNames } from "../src/services/viewer-search-text"
import { rankRelated } from "../src/services/related-videos.service"

test("search indexes Thai/Japanese translations and entity aliases independently of display locale", () => {
  const doc = contentSearchDocument({ _id: "one", title: "A mountain journey", slug: "abc-4972405",
    translated: new Map([
      ["th", { title: "เดินทางท่องเที่ยวภูเขา", description: "วิวทะเลสวยงาม" }],
      ["ja", { title: "東京の旅行" }],
    ]),
  }, [{ name: "Alice", aliases: ["Alicia"], metadata: { aliases: ["อริสา"] } }])
  for (const q of ["ท่องเที่ยว", "東京", "Alicia", "อริสา", "497240", "abc-497240"])
    for (const token of searchQuery(q).split(" "))
      assert.ok([doc.titleText, doc.descriptionText, doc.relationText, doc.codeText].join(" ").split(" ").includes(token), q)
  assert.equal(entityNames({ metadata: { secret: "not-searchable" } }).includes("not-searchable"), false)
})

test("numeric codes are not restricted to FC2 and fullwidth input normalizes", () => {
  const doc = contentSearchDocument({ _id: "one", slug: "juq-901-uncensored-leak" }, [])
  assert.ok(doc.codeText.split(" ").includes(searchQuery("９０１")))
  assert.ok(doc.codeText.split(" ").includes(searchQuery("JUQ 90")))
  assert.ok(doc.codeText.split(" ").includes(searchQuery("juq-901-uncensored-leak")))
  assert.equal(searchQuery("<b></b>"), "")
})

test("recommendations prefer shared actors, include other groups, exclude source and duplicates", () => {
  const source = { _id: "source", actressIds: ["a"], studioIds: ["s"], termIds: ["t"], terms: [{ _id: "t", taxonomy: "category" }] }
  const rows = [source,
    ...Array.from({ length: 20 }, (_, i) => ({ _id: `actor-${i}`, actressIds: ["a"] })),
    ...Array.from({ length: 10 }, (_, i) => ({ _id: `term-${i}`, termIds: ["t"] })),
    ...Array.from({ length: 5 }, (_, i) => ({ _id: `studio-${i}`, studioIds: ["s"] })),
    ...Array.from({ length: 5 }, (_, i) => ({ _id: `other-${i}` })),
  ]
  const ranked = rankRelated(source, [...rows, ...rows])
  assert.equal(ranked.length, 20)
  assert.equal(new Set(ranked.map((r) => r._id)).size, 20)
  assert.equal(ranked.some((r) => r._id === source._id), false)
  assert.deepEqual(["actor", "term", "studio", "other"].map((prefix) => ranked.filter((r) => String(r._id).startsWith(prefix)).length), [8, 6, 4, 2])
  assert.deepEqual(rankRelated(source, rows), ranked)
})

test("sparse recommendation groups fill remaining places without duplicates", () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ _id: String(i), actressIds: ["a"] }))
  assert.equal(rankRelated({ _id: "source", actressIds: ["a"] }, rows).length, 20)
  assert.equal(rankRelated({ _id: "source" }, rows.slice(0, 3)).length, 3)
})
