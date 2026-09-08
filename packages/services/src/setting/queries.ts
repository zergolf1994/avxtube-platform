import "server-only"

import { DEFAULT_AUTH_SETTING } from "@workspace/core/config"
import type {
  AdvertSettings,
  HomeFeedSettings,
  SeoSettings,
} from "@workspace/core/validators"
import { cache } from "react"

type KnownSettings = {
  auth_setting: typeof DEFAULT_AUTH_SETTING
  advert_hobby: AdvertSettings
  seo_setting: SeoSettings
  home_feed_setting: HomeFeedSettings
}

type Settings = Record<string, unknown>

type SettingsByNames<Names extends readonly string[]> = {
  [Name in Names[number]]?: Name extends keyof KnownSettings
    ? KnownSettings[Name]
    : unknown
}

type SettingResponse = {
  setting: unknown
}

type SettingsResponse = {
  settings: Settings
}

const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000"
const apiVersion = process.env.API_VERSION ?? "v1"

function createSettingsApiUrl(path = ""): URL {
  return new URL(`/${apiVersion}/settings${path}`, apiOrigin)
}

async function fetchJson<ResponseBody>(url: URL): Promise<ResponseBody> {
  const request: RequestInit = {
    method: "GET",
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
  } as RequestInit
  const response = await fetch(url, request)

  if (!response.ok) {
    throw new Error(
      `Settings API returned ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<ResponseBody>
}

const getSettingCached = cache(
  async (name: string): Promise<unknown | null> => {
    try {
      const response = await fetchJson<SettingResponse>(
        createSettingsApiUrl(`/${encodeURIComponent(name)}`)
      )
      return response.setting
    } catch (error) {
      console.error(`[Settings] Failed to fetch "${name}"`, error)
      return null
    }
  }
)

const getSettingsByNamesCached = cache(
  async (serializedNames: string): Promise<Settings> => {
    try {
      const names = JSON.parse(serializedNames) as string[]
      const url = createSettingsApiUrl()

      for (const name of names) {
        url.searchParams.append("names", name)
      }

      const response = await fetchJson<SettingsResponse>(url)
      return response.settings
    } catch (error) {
      console.error("[Settings] Failed to fetch settings by name", error)
      return {}
    }
  }
)

const getSettingsCached = cache(async (): Promise<Settings> => {
  try {
    const response = await fetchJson<SettingsResponse>(createSettingsApiUrl())
    return response.settings
  } catch (error) {
    console.error("[Settings] Failed to fetch public settings", error)
    return {}
  }
})

/** Fetch one public setting from the API. */
export async function getSetting<Name extends string>(
  name: Name
): Promise<
  Name extends keyof KnownSettings ? KnownSettings[Name] | null : unknown | null
> {
  return getSettingCached(name) as Promise<
    Name extends keyof KnownSettings
      ? KnownSettings[Name] | null
      : unknown | null
  >
}

/** Fetch selected public settings from the API. */
export async function getSettingsByNames<const Names extends readonly string[]>(
  names: Names
): Promise<SettingsByNames<Names>> {
  const uniqueNames = [...new Set(names)].sort()
  return getSettingsByNamesCached(JSON.stringify(uniqueNames)) as Promise<
    SettingsByNames<Names>
  >
}

/** Fetch every public setting exposed by the API. */
export async function getSettings(): Promise<Partial<KnownSettings>> {
  return getSettingsCached() as Promise<Partial<KnownSettings>>
}
