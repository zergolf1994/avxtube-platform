import {
  DEFAULT_HOME_FEED_SETTINGS,
  homeFeedSettingSchema,
} from "@workspace/core/validators"
import { SettingModel } from "@workspace/db/models"

const name = "home_feed_setting"

export async function getHomeFeedSettings() {
  const setting = await SettingModel.findOne({ name }).lean()
  return normalizeHomeFeedSettings(setting?.value)
}

export function normalizeHomeFeedSettings(value: unknown) {
  const parsed = homeFeedSettingSchema.safeParse(value)
  if (parsed.success) return parsed.data

  const record = isRecord(value) ? value : {}
  const sections = Array.isArray(record.sections) ? record.sections : []
  if (!sections.length) return DEFAULT_HOME_FEED_SETTINGS
  const byId = new Map(
    sections
      .filter(isRecord)
      .map(
        (section) => [String(section.id), section.enabled !== false] as const
      )
  )
  const idMap: Record<string, string> = {
    videos: "videos",
    playlists: "playlists",
    shorts: "shorts",
    latestVideos: "latest-videos",
  }
  const feeds = sections
    .map((section) => (isRecord(section) ? idMap[String(section.id)] : null))
    .filter((id): id is string => Boolean(id))
    .map((id) => {
      const fallback = DEFAULT_HOME_FEED_SETTINGS.feeds.find(
        (feed) => feed.id === id
      )
      return fallback
        ? {
            ...fallback,
            enabled:
              byId.get(id === "latest-videos" ? "latestVideos" : id) ?? true,
          }
        : null
    })
    .filter((feed): feed is NonNullable<typeof feed> => Boolean(feed))
  return feeds.length ? { feeds } : DEFAULT_HOME_FEED_SETTINGS
}

export async function saveHomeFeedSettings(input: unknown) {
  const settings = homeFeedSettingSchema.parse(input)
  await SettingModel.updateOne(
    { name },
    { $set: { value: settings } },
    { upsert: true, runValidators: true }
  )
  return settings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
