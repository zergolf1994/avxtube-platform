import { DEFAULT_DOMAIN_SETTING } from "@workspace/core/config"
import { domainSettingSchema } from "@workspace/core/validators"
import { SettingModel } from "@workspace/db/models"

const name = "domain_setting"
const CACHE_MS = 60_000
type DomainSettings = ReturnType<typeof domainSettingSchema.parse>
let cached: { value: DomainSettings; expiresAt: number } | null = null
let pending: Promise<DomainSettings> | null = null
let cacheVersion = 0

export function invalidateDomainSettingsCache() {
  cached = null
  pending = null
  cacheVersion += 1
}

export async function getDomainSettings() {
  if (cached && cached.expiresAt > Date.now()) return cached.value
  if (pending) return pending
  const version = cacheVersion
  const request = SettingModel.findOne({ name })
    .lean()
    .then((setting) => {
      // Ignore retired fields on read so previously saved settings still open.
      // The next save replaces the value with only the supported fields.
      const value = domainSettingSchema
        .strip()
        .parse(setting?.value ?? DEFAULT_DOMAIN_SETTING)
      if (cacheVersion === version)
        cached = { value, expiresAt: Date.now() + CACHE_MS }
      return value
    })
    .finally(() => {
      if (pending === request) pending = null
    })
  pending = request
  return request
}

export async function saveDomainSettings(input: unknown) {
  const settings = domainSettingSchema.parse(input)
  // A single document update avoids partially saving one group of settings.
  await SettingModel.updateOne(
    { name },
    { $set: { value: settings } },
    { upsert: true, runValidators: true }
  )
  cacheVersion += 1
  pending = null
  cached = { value: settings, expiresAt: Date.now() + CACHE_MS }
  return settings
}
