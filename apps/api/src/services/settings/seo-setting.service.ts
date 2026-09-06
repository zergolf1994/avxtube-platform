import {
  DEFAULT_SEO_SETTINGS,
  seoSettingSchema,
} from "@workspace/core/validators"
import { SettingModel } from "@workspace/db/models"

const name = "seo_setting"

export async function getSeoSettings() {
  const setting = await SettingModel.findOne({ name }).lean()
  return seoSettingSchema.parse(setting?.value ?? DEFAULT_SEO_SETTINGS)
}

export async function saveSeoSettings(input: unknown) {
  const settings = seoSettingSchema.parse(input)
  await SettingModel.updateOne(
    { name },
    { $set: { value: settings } },
    { upsert: true, runValidators: true }
  )
  return settings
}
