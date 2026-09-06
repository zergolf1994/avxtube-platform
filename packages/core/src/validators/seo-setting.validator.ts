import { z } from "zod"

export const seoLocaleSettingSchema = z.object({
  siteName: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500),
  keywords: z.array(z.string().trim().min(1).max(100)).max(50),
})

export const seoSettingSchema = z.object({
  locales: z.record(z.string().trim().min(2).max(16), seoLocaleSettingSchema),
})

export type SeoLocaleSetting = z.infer<typeof seoLocaleSettingSchema>
export type SeoSettings = z.infer<typeof seoSettingSchema>

export const DEFAULT_SEO_SETTINGS: SeoSettings = { locales: {} }
