import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"
import express from "express"
import { ContentModel, SettingModel } from "@workspace/db/models"
import { DEFAULT_DOMAIN_SETTING } from "@workspace/core/config"
import {
  channelPagePipeline,
  mapChannel,
} from "../src/services/channel-viewer.service"
import {
  contentPagePipeline,
  mapContentToShort,
  mapContentToVideo,
  getContentMappers,
  getPublicContentSummaries,
  mediaUrl,
  publicVideoFilter,
  publicVideoListFilter,
} from "../src/services/content-video.service"
import videosRouter from "../src/routes/videos.routes"
import { invalidateDomainSettingsCache } from "../src/services/settings/domain-setting.service"

afterEach(() => {
  invalidateDomainSettingsCache()
  mock.restoreAll()
})

function fixture() {
  return {
    _id: "content-id",
    slug: "example-video",
    kind: "video",
    title: "Example video",
    description: "<p>A description</p>",
    createdAt: new Date("2026-09-03T00:00:00Z"),
    stats: { viewCount: 5, likeCount: 2 },
    // Lookup results are not necessarily returned in reference order.
    studioIds: ["studio"],
    actressIds: ["actor-b"],
    actorIds: ["actor-a"],
    directorIds: ["director"],
    channels: [
      {
        _id: "actor-a",
        name: "Actor A",
        handle: "actora",
        metadata: { roles: ["actor"], gender: "male" },
      },
      {
        _id: "studio",
        name: "Studio",
        handle: "studio",
        metadata: { roles: ["studio"] },
      },
      {
        _id: "actor-b",
        name: "Actor B",
        handle: "actorb",
        metadata: { roles: ["actor"], gender: "female" },
      },
      {
        _id: "director",
        name: "Director",
        handle: "director",
        metadata: { roles: ["director"] },
      },
    ],
    mediaIds: ["thumb", "poster", "trailer", "low", "high"],
    media: [
      {
        _id: "thumb",
        kind: "image",
        purpose: "thumbnail",
        metadata: {
          sprite: { col: 6 },
          directUrl: "https://cdn.example/sprite.jpg",
        },
      },
      {
        _id: "poster",
        kind: "image",
        purpose: "poster",
        metadata: { directUrl: "https://cdn.example/poster.webp" },
      },
      {
        _id: "trailer",
        kind: "video",
        purpose: "trailer",
        metadata: { directUrl: "https://cdn.example/trailer.mp4" },
      },
      {
        _id: "low",
        kind: "video",
        purpose: "video",
        quality: "360",
        metadata: { directUrl: "https://cdn.example/360.mp4", duration: 100 },
      },
      {
        _id: "high",
        kind: "video",
        purpose: "video",
        quality: "1080",
        metadata: {
          directUrl: "https://cdn.example/master.m3u8",
          hls: {
            uri: "https://cdn.example/1080.m3u8",
            media: { duration: 123.25, token: "private-token" },
          },
          referrerUrl: "https://source.example",
        },
      },
    ],
    termIds: ["tag", "category-b", "category-a"],
    terms: [
      { _id: "category-a", taxonomy: "category", name: "A" },
      { _id: "tag", taxonomy: "tag", name: "Tag" },
      { _id: "category-b", taxonomy: "category", name: "B" },
    ],
  }
}

test("public filter uses current schema, excludes non-public or unpublished contents", () => {
  assert.deepEqual(publicVideoFilter(), {
    kind: "video",
    status: "published",
    visibility: "public",
    deletedAt: null,
  })
  assert.equal(publicVideoFilter("short").kind, "short")
})
test("trending video filter requires a real view count", () => {
  assert.deepEqual(publicVideoListFilter("trending"), {
    ...publicVideoFilter(),
    "stats.viewCount": { $gt: 0 },
  })
  assert.deepEqual(publicVideoListFilter(), publicVideoFilter())
})
test("pagination happens before indexed reference lookups, and sorting has an ID tie-breaker", () => {
  const pipeline = contentPagePipeline(publicVideoFilter(), 8, 16)
  assert.deepEqual(pipeline.slice(0, 4), [
    { $match: publicVideoFilter() },
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: 16 },
    { $limit: 8 },
  ])
  const joins = pipeline
    .filter((stage) => "$lookup" in stage)
    .map((stage) => stage.$lookup)
  assert.deepEqual(
    joins.map((join) => [join.from, join.localField, join.foreignField]),
    [
      ["channels", "__viewerRelationIds", "_id"],
      ["medias", "mediaIds", "_id"],
      ["terms", "termIds", "_id"],
    ]
  )
  for (const join of joins)
    assert.ok(JSON.stringify(join.pipeline).includes('"deletedAt":null'))
  assert.ok(JSON.stringify(joins[1]?.pipeline).includes('"error"'))
})
test("deep latest pages seek covered IDs before hydrating page relations", async () => {
  let pipeline: any[] = []
  let hint: unknown
  const aggregate = mock.method(ContentModel, "aggregate", (value: any[]) => {
    pipeline = value
    const query = {
      hint(value: unknown) {
        hint = value
        return query
      },
      exec: async () => [
        { _id: "first", title: "First" },
        { _id: "second", title: "Second" },
      ],
    }
    return query
  })

  const rows = await getPublicContentSummaries(publicVideoFilter(), 2, 24_000, {
    createdAt: -1,
    _id: -1,
  })

  assert.deepEqual(
    rows.map((row) => row._id),
    ["first", "second"],
    "the hydrated aggregation must preserve the covering-index page order"
  )
  assert.deepEqual(hint, {
    kind: 1,
    status: 1,
    visibility: 1,
    deletedAt: 1,
    createdAt: -1,
    _id: -1,
  })
  assert.equal(aggregate.mock.callCount(), 1)
  assert.deepEqual(pipeline.slice(0, 5), [
    { $match: publicVideoFilter() },
    { $sort: { createdAt: -1, _id: -1 } },
    { $project: { _id: 1 } },
    { $skip: 24_000 },
    { $limit: 2 },
  ])
  assert.equal(pipeline[5].$lookup.from, ContentModel.collection.name)
  assert.deepEqual(pipeline[5].$lookup.pipeline, [
    { $match: publicVideoFilter() },
  ])
  assert.deepEqual(pipeline[6], { $unwind: "$__pageContent" })
  assert.deepEqual(pipeline[7], { $replaceWith: "$__pageContent" })
})
test("maps poster, trailer and highest video rendition from media only", () => {
  const video = mapContentToVideo(
    fixture(),
    "static.example",
    "playlist.example"
  )
  assert.equal(video.thumbnailUrl, "//static.example/example-video/poster.jpg")
  assert.equal(video.previewUrl, "//static.example/example-video/preview.mp4")
  assert.equal(video.playbackUrl, undefined)
  assert.deepEqual(video.player, {
    vdoId: "example-video",
    node: { static: "//static.example", playlist: "//playlist.example" },
  })
  assert.equal(video.durationSeconds, 123.25)
  assert.equal(video.category, "B")
  assert.equal(video.description, "A description")
  assert.equal(video.channel?.id, "studio")
  assert.deepEqual(
    video.directors?.map((item) => item.id),
    ["director"]
  )
  assert.equal(video.id, "example-video")
  assert.equal(JSON.stringify(video).includes("private-token"), false)
  assert.equal(JSON.stringify(video).includes("referrerUrl"), false)
})
test("falls back to the first performer in explicit relation order", () => {
  const content = fixture()
  content.studioIds = []
  assert.equal(mapContentToVideo(content).channel?.id, "actor-b")
})
test("legacy channelIds remain readable", () => {
  const content = fixture()
  content.studioIds = []
  content.actressIds = []
  content.actorIds = []
  content.directorIds = []
  Object.assign(content, { channelIds: ["actor-a"] })
  assert.equal(mapContentToVideo(content).channel?.id, "actor-a")
})
test("missing and unrelated references do not fabricate an AVXTUBE channel or URL", () => {
  const content = fixture()
  content.studioIds = ["missing"]
  content.actressIds = []
  content.actorIds = []
  content.directorIds = []
  content.mediaIds = []
  const video = mapContentToVideo(content)
  assert.equal(video.channel, undefined)
  assert.equal(video.thumbnailUrl, "")
  assert.equal(video.playbackUrl, undefined)
  assert.equal(video.previewUrl, undefined)
})
test("sprite thumbnail is not displayed as the poster", () => {
  const content = fixture()
  content.mediaIds = ["thumb"]
  assert.equal(mapContentToVideo(content).thumbnailUrl, "")
})
test("local media paths work and unsafe or missing URLs remain absent", () => {
  assert.equal(
    mediaUrl({
      provider: "s3",
      storageId: "storage",
      metadata: {
        directUrl: "https://storage.example/video.mp4",
        hls: { uri: "https://remote.example/old.m3u8" },
      },
    }),
    "https://storage.example/video.mp4"
  )
  assert.equal(
    mediaUrl({ metadata: { directUrl: "/api/v1/media/files/poster.webp" } }),
    "/api/v1/media/files/poster.webp"
  )
  assert.equal(mediaUrl({ metadata: { directUrl: "javascript:alert(1)" } }), "")
  assert.equal(
    mediaUrl({ metadata: { directUrl: "//another.example/file" } }),
    ""
  )
  assert.equal(mediaUrl(), "")
})
test("minimal content and shorts with no channel are valid", () => {
  const video = mapContentToVideo({ _id: "plain-id" })
  assert.equal(video.id, "plain-id")
  assert.equal(video.durationSeconds, 0)
  assert.equal(video.channel, undefined)
  const short = mapContentToShort({
    _id: "short-id",
    stats: { likeCount: 10 },
    metadata: { commentPolicy: "disabled" },
  })
  assert.equal(short.channel, undefined)
  assert.equal(short.likeCount, 10)
  assert.equal(short.commentPolicy, "disabled")
})
test("video details expose release date, channels, and every term taxonomy", () => {
  const video = mapContentToVideo({
    _id: "video-id",
    metadata: { releaseDate: "2025-04-03" },
    studioIds: ["studio-id"],
    actorIds: ["actor-id"],
    directorIds: ["director-id"],
    channels: [
      {
        _id: "studio-id",
        name: "Studio",
        handle: "studio",
        kind: "organization",
        metadata: { roles: ["studio"] },
      },
      {
        _id: "actor-id",
        name: "Actor",
        handle: "actor",
        kind: "person",
        metadata: { roles: ["actor"] },
      },
      {
        _id: "director-id",
        name: "Director",
        handle: "director",
        kind: "person",
        metadata: { roles: ["director"] },
      },
    ],
    termIds: ["category-id", "tag-id", "label-id", "series-id"],
    terms: [
      {
        _id: "tag-id",
        name: "Tag",
        slug: "tag",
        taxonomy: "tag",
      },
      {
        _id: "category-id",
        name: "Category",
        slug: "category",
        taxonomy: "category",
      },
      {
        _id: "label-id",
        name: "Label",
        slug: "label",
        taxonomy: "label",
      },
      {
        _id: "series-id",
        name: "Series",
        slug: "series",
        taxonomy: "series",
      },
    ],
  })
  assert.equal(video.releaseDate, "2025-04-03T00:00:00.000Z")
  assert.deepEqual(
    video.actors?.map((item) => item.name),
    ["Actor"]
  )
  assert.deepEqual(
    video.studios?.map((item) => item.name),
    ["Studio"]
  )
  assert.deepEqual(
    video.directors?.map((item) => item.name),
    ["Director"]
  )
  assert.deepEqual(
    video.categories?.map((item) => item.name),
    ["Category"]
  )
  assert.deepEqual(
    video.tags?.map((item) => item.name),
    ["Tag"]
  )
  assert.deepEqual(
    video.labels?.map((item) => item.name),
    ["Label"]
  )
  assert.deepEqual(
    video.series?.map((item) => item.name),
    ["Series"]
  )
  assert.equal(video.channel?.name, "Studio")
})
test("channel statistics use the batched public-content result", () => {
  const row = {
    _id: "person-id",
    name: "Actor",
    handle: "actor",
    kind: "person",
    stats: { videoCount: 999, subscriberCount: 10 },
    metadata: { roles: ["actor"], gender: "female", secret: "do-not-expose" },
    contentStats: [
      { _id: "video", count: 2, views: 20 },
      { _id: "short", count: 1, views: 3 },
    ],
  }
  const channel = mapChannel(row)
  assert.equal(channel.kind, "person")
  assert.equal(channel.videoCount, 2)
  assert.equal(channel.shortCount, 1)
  assert.equal(channel.viewCount, 23)
  assert.equal(channel.subscriberCount, 10)
  assert.deepEqual(channel.metadata?.roles, ["actor"])
  assert.equal(channel.metadata?.secret, undefined)
  const pipeline = channelPagePipeline({ status: "active", deletedAt: null })
  assert.equal(
    pipeline.some((stage) => "$lookup" in stage),
    false
  )
  assert.ok(pipeline.some((stage) => "$limit" in stage))
})

test("video endpoint returns accurate pagination without N+1 relation queries", async () => {
  const aggregate = mock.method(ContentModel, "aggregate", () => ({
    exec: async () => [fixture()],
  }))
  mock.method(ContentModel, "countDocuments", async () => 2)
  const settings = mock.method(SettingModel, "findOne", () => ({
    lean: async () => ({
      value: {
        ...DEFAULT_DOMAIN_SETTING,
        domain_static: "static.example",
        domain_playlist: "playlist.example",
      },
    }),
  }))
  const app = express().use("/videos", videosRouter)
  const server = app.listen(0, "127.0.0.1")
  await new Promise<void>((resolve) => server.once("listening", resolve))
  try {
    const address = server.address()
    assert.ok(address && typeof address !== "string")
    const response = await fetch(
      `http://127.0.0.1:${address.port}/videos?cursor=1&limit=1`
    )
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.items.length, 1)
    assert.equal(result.total, 2)
    assert.equal(result.nextCursor, null)
    assert.equal(result.items[0].channel.id, "studio")
    assert.equal(
      result.items[0].thumbnailUrl,
      "//static.example/example-video/poster.jpg"
    )
    assert.equal(
      result.items[0].previewUrl,
      "//static.example/example-video/preview.mp4"
    )
    assert.deepEqual(result.items[0].player, {
      vdoId: "example-video",
      node: { static: "//static.example", playlist: "//playlist.example" },
    })
    assert.equal(settings.mock.callCount(), 1)
    assert.equal(aggregate.mock.callCount(), 1)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test("missing static domain does not expose original poster/trailer URLs", () => {
  const video = mapContentToVideo(fixture())
  assert.equal(video.thumbnailUrl, "")
  assert.equal(video.previewUrl, undefined)
  assert.equal(JSON.stringify(video).includes("poster.webp"), false)
  assert.equal(JSON.stringify(video).includes("trailer.mp4"), false)
})

test("static paths use content slugs, even for stored files or descriptor-only media", () => {
  const content = {
    ...fixture(),
    _id: "actual-id",
    slug: "different-slug",
    media: [
      {
        _id: "poster",
        purpose: "poster",
        provider: "s3",
        metadata: { directUrl: "https://bucket.example/source.webp" },
      },
      { _id: "trailer", purpose: "trailer", provider: "remote", metadata: {} },
    ],
  }
  const video = mapContentToVideo(content, "static.example:8443")
  assert.equal(
    video.thumbnailUrl,
    "//static.example:8443/different-slug/poster.jpg"
  )
  assert.equal(
    video.previewUrl,
    "//static.example:8443/different-slug/preview.mp4"
  )
  const short = mapContentToShort(content, "static.example")
  assert.equal(short.thumbnailUrl, "//static.example/different-slug/poster.jpg")
  assert.equal(
    content.media[0]?.metadata.directUrl,
    "https://bucket.example/source.webp"
  )
  const missing = mapContentToVideo(
    { ...content, mediaIds: [] },
    "static.example"
  )
  assert.equal(missing.thumbnailUrl, "")
  assert.equal(missing.previewUrl, undefined)
})

test("watch player config requires a video slug and both database domains", () => {
  assert.equal(mapContentToVideo(fixture(), "static.example").player, undefined)
  assert.equal(
    mapContentToVideo(fixture(), "", "playlist.example").player,
    undefined
  )
  assert.equal(
    mapContentToVideo(
      { ...fixture(), slug: undefined },
      "static.example",
      "playlist.example"
    ).player,
    undefined
  )
  const short = mapContentToShort(
    { ...fixture(), kind: "short" },
    "static.example",
    "playlist.example"
  )
  assert.equal(short.player, undefined)
  assert.equal(short.playbackUrl, "https://cdn.example/1080.m3u8")
})

test("domain settings are shared across responses until invalidated", async () => {
  invalidateDomainSettingsCache()
  let domain = "static.example"
  const settings = mock.method(SettingModel, "findOne", () => ({
    lean: async () => ({
      value: {
        ...DEFAULT_DOMAIN_SETTING,
        domain_static: domain,
        domain_playlist: "playlist.example",
      },
    }),
  }))
  const first = await getContentMappers()
  first.mapVideo(fixture())
  first.mapShort(fixture())
  assert.equal(settings.mock.callCount(), 1)
  domain = "changed.example"
  const second = await getContentMappers()
  assert.equal(
    second.mapVideo(fixture()).previewUrl,
    "//static.example/example-video/preview.mp4"
  )
  assert.equal(
    first.mapVideo(fixture()).previewUrl,
    "//static.example/example-video/preview.mp4"
  )
  assert.equal(settings.mock.callCount(), 1)
  invalidateDomainSettingsCache()
  const third = await getContentMappers()
  assert.equal(
    third.mapVideo(fixture()).previewUrl,
    "//changed.example/example-video/preview.mp4"
  )
  assert.equal(settings.mock.callCount(), 2)
})

test("missing slugs do not fall back to IDs and slug path segments are encoded", () => {
  const missing = mapContentToVideo(
    { ...fixture(), slug: undefined },
    "static.example"
  )
  assert.equal(missing.thumbnailUrl, "")
  assert.equal(missing.previewUrl, undefined)
  const encoded = mapContentToVideo(
    { ...fixture(), slug: "example/video name" },
    "static.example"
  )
  assert.equal(
    encoded.thumbnailUrl,
    "//static.example/example%2Fvideo%20name/poster.jpg"
  )
})
