import { z } from "zod"

export const HOME_FEED_TYPES = ["videos", "shorts", "playlists"] as const
export const HOME_FEED_SORTS = ["latest", "releaseDate", "trending"] as const
export const HOME_FEED_LOAD_MODES = ["none", "button", "auto"] as const

export const homeFeedTypeSchema = z.enum(HOME_FEED_TYPES)
export const homeFeedSortSchema = z.enum(HOME_FEED_SORTS)
export const homeFeedLoadModeSchema = z.enum(HOME_FEED_LOAD_MODES)

export const homeFeedItemSchema = z.preprocess(
  (input) => {
    if (!input || typeof input !== "object" || Array.isArray(input))
      return input
    const record = input as Record<string, unknown>
    if (Array.isArray(record.categories)) return input
    const legacyCategory =
      typeof record.category === "string" ? record.category.trim() : ""
    return {
      ...record,
      categories:
        legacyCategory && legacyCategory !== "all" ? [legacyCategory] : [],
    }
  },
  z.object({
    id: z.string().trim().min(1).max(128),
    enabled: z.boolean(),
    type: homeFeedTypeSchema,
    title: z.string().trim().max(120),
    categories: z.array(z.string().trim().min(1).max(200)).max(50),
    showViewAll: z.boolean().default(false),
    viewAllHref: z
      .string()
      .trim()
      .max(500)
      .refine(
        (value) => !value || (value.startsWith("/") && !value.startsWith("//")),
        "View-all link must be an internal path"
      )
      .default(""),
    sort: homeFeedSortSchema,
    pageSize: z.number().int().min(1).max(48),
    startPage: z.number().int().min(1).max(100_000),
    loadMore: homeFeedLoadModeSchema,
    maxPages: z.number().int().min(1).max(10_000).nullable(),
  })
)

export const homeFeedSettingSchema = z
  .object({
    feeds: z.array(homeFeedItemSchema).max(50),
  })
  .superRefine((value, context) => {
    const ids = value.feeds.map((feed) => feed.id)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["feeds"],
        message: "Home feed IDs must be unique",
      })
    }
  })

export type HomeFeedType = z.infer<typeof homeFeedTypeSchema>
export type HomeFeedSort = z.infer<typeof homeFeedSortSchema>
export type HomeFeedLoadMode = z.infer<typeof homeFeedLoadModeSchema>
export type HomeFeedItem = z.infer<typeof homeFeedItemSchema>
export type HomeFeedSettings = z.infer<typeof homeFeedSettingSchema>

export const DEFAULT_HOME_FEED_SETTINGS: HomeFeedSettings = {
  feeds: [
    {
      id: "videos",
      enabled: true,
      type: "videos",
      title: "",
      categories: [],
      showViewAll: false,
      viewAllHref: "",
      sort: "latest",
      pageSize: 12,
      startPage: 1,
      loadMore: "none",
      maxPages: 1,
    },
    {
      id: "playlists",
      enabled: true,
      type: "playlists",
      title: "",
      categories: [],
      showViewAll: false,
      viewAllHref: "",
      sort: "latest",
      pageSize: 6,
      startPage: 1,
      loadMore: "none",
      maxPages: 1,
    },
    {
      id: "shorts",
      enabled: true,
      type: "shorts",
      title: "",
      categories: [],
      showViewAll: true,
      viewAllHref: "/shorts",
      sort: "latest",
      pageSize: 10,
      startPage: 1,
      loadMore: "none",
      maxPages: 1,
    },
    {
      id: "latest-videos",
      enabled: true,
      type: "videos",
      title: "",
      categories: [],
      showViewAll: true,
      viewAllHref: "/latest",
      sort: "latest",
      pageSize: 12,
      startPage: 2,
      loadMore: "none",
      maxPages: 1,
    },
  ],
}
