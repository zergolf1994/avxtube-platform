import { HomeFeed } from "@/components/home/home-feed"
import {
  createPageMetadata,
  localizedPageUrl,
  serializeJsonLd,
  type LocalizedPageProps,
} from "@/i18n/metadata"
import { websiteStructuredData } from "@/lib/structured-data"
import { loadMetadataMockup } from "@/mock-up/loadMockup"
import { getHomeFeed } from "@workspace/services/queries/video"
import { getSettingsByNames } from "@workspace/services/queries/setting"
import { localeTags, type Locale } from "@workspace/i18n/config"
import { DEFAULT_HOME_FEED_SETTINGS } from "@workspace/core/validators"
import { cache } from "react"

export const dynamic = "force-dynamic"
// Retain this dynamic page in Next's in-tab router cache. A reload or a new
// tab still requests a fresh feed, while returning from Watch can reuse the
// exact Home payload that the viewer already saw.
export const unstable_dynamicStaleTime = 31_536_000

const getHomePageSettings = cache(async (locale: Locale) => {
  const [fallback, settings] = await Promise.all([
    loadMetadataMockup(locale),
    getSettingsByNames(["seo_setting", "home_feed_setting"]),
  ])
  return {
    seo: settings.seo_setting?.locales[locale] ?? fallback,
    homeFeed: settings.home_feed_setting ?? DEFAULT_HOME_FEED_SETTINGS,
  }
})

export async function generateMetadata({ params }: LocalizedPageProps) {
  const { locale } = await params
  const { seo: data } = await getHomePageSettings(locale)
  return createPageMetadata({
    locale,
    pathname: "/",
    title: data.title,
    description: data.description,
    keywords: data.keywords,
    siteName: data.siteName,
  })
}

export default async function Page({ params }: LocalizedPageProps) {
  const { locale } = await params
  const [feed, settings] = await Promise.all([
    getHomeFeed(locale).catch((error) => {
      console.error("[Home] Failed to fetch feed", error)
      return { categories: [], videos: [], shorts: [], playlists: [] }
    }),
    getHomePageSettings(locale),
  ])
  const { seo } = settings
  const pageUrl = localizedPageUrl(locale, "/")
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            websiteStructuredData({
              pageUrl,
              siteName: seo.siteName,
              description: seo.description,
              language: localeTags[locale],
            })
          ),
        }}
      />
      <HomeFeed {...feed} locale={locale} feeds={settings.homeFeed.feeds} />
    </>
  )
}
