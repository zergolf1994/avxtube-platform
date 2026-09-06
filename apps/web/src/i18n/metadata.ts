import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { localeTags, locales, type Locale } from "@workspace/i18n/config"

import { contentMessageKey } from "./content-key"
import { getPathname } from "./navigation"

export const siteUrl = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "https://avxtube.com"
)

type PageMetadata = {
  locale: Locale
  pathname: string
  title: string
  description?: string
  keywords?: string[]
  image?: string | null
  video?: string | null
  openGraphType?: "website" | "profile" | "video.other"
}

export type LocalizedPageProps = {
  params: Promise<{ locale: Locale }>
}

export async function getContentTranslator(locale: Locale) {
  const t = await getTranslations({ locale, namespace: "content" })

  return (text: string) => {
    const key = contentMessageKey(text)
    return t.has(key) ? (t.raw(key) as string) : text
  }
}

export async function createPageMetadata({
  locale,
  pathname,
  title,
  description,
  keywords,
  image,
  video,
  openGraphType = "website",
}: PageMetadata): Promise<Metadata> {
  const translate = await getContentTranslator(locale)

  const englishPath = getPathname({ locale: "en", href: pathname })
  const localizedPath = getPathname({ locale, href: pathname })
  const languages = Object.fromEntries(
    locales.map((item) => [item, getPathname({ locale: item, href: pathname })])
  )
  const localizedTitle = translate(title)
  const localizedDescription = description ? translate(description) : undefined

  return {
    metadataBase: new URL(siteUrl),
    title: localizedTitle,
    description: localizedDescription,
    keywords: keywords?.map(translate),
    alternates: {
      canonical: localizedPath,
      languages: { ...languages, "x-default": englishPath },
    },
    openGraph: {
      type: openGraphType,
      url: localizedPath,
      siteName: "AVXTUBE",
      locale: localeTags[locale].replace("-", "_"),
      title: localizedTitle,
      description: localizedDescription,
      ...(image ? { images: [absoluteUrl(image)] } : {}),
      ...(video ? { videos: [absoluteUrl(video)] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: localizedTitle,
      description: localizedDescription,
      ...(image ? { images: [absoluteUrl(image)] } : {}),
    },
  }
}

export function localizedPageUrl(locale: Locale, pathname: string) {
  return new URL(getPathname({ locale, href: pathname }), siteUrl).toString()
}

export function absoluteUrl(value: string) {
  if (value.startsWith("//")) return `https:${value}`
  return new URL(value, siteUrl).toString()
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

function normalizeSiteUrl(value: string) {
  return new URL(value).origin
}
