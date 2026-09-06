import { defaultLocale, locales, type Locale } from "@workspace/i18n/config"

import { absoluteUrl, siteUrl } from "@/i18n/metadata"
import type {
  SitemapDataPage,
  SitemapDataType,
  SitemapSummary,
} from "@/lib/sitemap-data"

type SitemapEntry = {
  path: string
  locale?: Locale
  lastModified?: string
  changeFrequency?: "daily" | "weekly" | "monthly"
  priority?: number
  video?: SitemapDataPage["items"][number]["video"]
}

export function sitemapIndexXml(summary: SitemapSummary) {
  const entries: Array<{ url: string; lastModified?: string }> = [
    {
      url: absoluteUrl("/sitemaps/pages.xml"),
      lastModified: latestDate(summary),
    },
  ]
  for (const type of ["videos", "shorts", "channels"] as const) {
    const group = summary[type]
    const pages = Math.ceil(group.count / summary.pageSize)
    for (let page = 1; page <= pages; page += 1) {
      entries.push({
        url: absoluteUrl(`/sitemaps/${type}-${page}.xml`),
        lastModified: group.lastModified,
      })
    }
  }
  return xmlDocument(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
      .map(
        (entry) =>
          `  <sitemap>\n    <loc>${escapeXml(entry.url)}</loc>${entry.lastModified ? `\n    <lastmod>${escapeXml(isoDate(entry.lastModified))}</lastmod>` : ""}\n  </sitemap>`
      )
      .join("\n")}\n</sitemapindex>`
  )
}

export function staticPagesSitemapXml(lastModified?: string) {
  return urlSetXml(
    [
      { path: "/", changeFrequency: "daily", priority: 1 },
      { path: "/latest", changeFrequency: "daily", priority: 0.9 },
      { path: "/release", changeFrequency: "daily", priority: 0.9 },
      { path: "/trending", changeFrequency: "daily", priority: 0.9 },
      { path: "/actors", changeFrequency: "weekly", priority: 0.8 },
    ],
    lastModified
  )
}

export function dataPageSitemapXml(page: SitemapDataPage) {
  const entries: SitemapEntry[] = page.items.map((item) => ({
    path:
      page.type === "videos"
        ? `/watch/${encodeURIComponent(item.slug)}`
        : page.type === "shorts"
          ? `/shorts/${encodeURIComponent(item.slug)}`
          : `/channel/${encodeURIComponent(item.slug.replace(/^@/, ""))}`,
    lastModified: item.lastModified,
    changeFrequency: page.type === "channels" ? "weekly" : "monthly",
    priority: page.type === "videos" ? 0.8 : 0.7,
    video: item.video,
  }))
  return urlSetXml(entries)
}

export function parseSitemapName(
  name: string
):
  | { kind: "pages" }
  | { kind: "data"; type: SitemapDataType; page: number }
  | null {
  if (name === "pages.xml") return { kind: "pages" }
  const match = /^(videos|shorts|channels)-(\d+)\.xml$/.exec(name)
  if (!match) return null
  const page = Number.parseInt(match[2] ?? "", 10)
  if (!Number.isSafeInteger(page) || page < 1) return null
  return {
    kind: "data",
    type: match[1] as SitemapDataType,
    page,
  }
}

function urlSetXml(entries: SitemapEntry[], fallbackLastModified?: string) {
  const localizedEntries = entries.flatMap((entry) =>
    locales.map((locale) => ({ ...entry, locale }))
  )
  return xmlDocument(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${localizedEntries
      .map((entry) => urlEntryXml(entry, fallbackLastModified))
      .join("\n")}\n</urlset>`
  )
}

function urlEntryXml(entry: SitemapEntry, fallbackLastModified?: string) {
  const canonical = localizedUrl(entry.path, entry.locale ?? defaultLocale)
  const alternates = locales
    .map(
      (locale) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(localizedUrl(entry.path, locale))}"/>`
    )
    .join("\n")
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(localizedUrl(entry.path, defaultLocale))}"/>`
  const lastModified = entry.lastModified ?? fallbackLastModified
  const video = entry.video ? videoXml(entry.video, canonical) : ""
  return `  <url>\n    <loc>${escapeXml(canonical)}</loc>\n${alternates}\n${xDefault}${lastModified ? `\n    <lastmod>${escapeXml(isoDate(lastModified))}</lastmod>` : ""}${entry.changeFrequency ? `\n    <changefreq>${entry.changeFrequency}</changefreq>` : ""}${entry.priority !== undefined ? `\n    <priority>${entry.priority.toFixed(1)}</priority>` : ""}${video ? `\n${video}` : ""}\n  </url>`
}

function videoXml(
  video: NonNullable<SitemapEntry["video"]>,
  canonical: string
) {
  if (!video.thumbnailUrl) return ""
  const tags = [...(video.tags ?? []), ...(video.categories ?? [])]
    .map((item) => item.name)
    .filter(Boolean)
    .slice(0, 32)
  const duration = Math.round(video.durationSeconds)
  return `    <video:video>\n      <video:thumbnail_loc>${escapeXml(absoluteUrl(video.thumbnailUrl))}</video:thumbnail_loc>\n      <video:title>${escapeXml(limit(video.title, 100))}</video:title>\n      <video:description>${escapeXml(limit(video.description || video.title, 2048))}</video:description>\n      <video:player_loc allow_embed="yes">${escapeXml(canonical)}</video:player_loc>${duration > 0 && duration <= 28800 ? `\n      <video:duration>${duration}</video:duration>` : ""}${video.publishedAt ? `\n      <video:publication_date>${escapeXml(isoDate(video.publishedAt))}</video:publication_date>` : ""}${tags.map((tag) => `\n      <video:tag>${escapeXml(limit(tag, 256))}</video:tag>`).join("")}\n    </video:video>`
}

function localizedUrl(path: string, locale: Locale) {
  const localizedPath =
    locale === defaultLocale
      ? path
      : path === "/"
        ? `/${locale}`
        : `/${locale}${path}`
  return new URL(localizedPath, siteUrl).toString()
}

function latestDate(summary: SitemapSummary) {
  return [
    summary.videos.lastModified,
    summary.shorts.lastModified,
    summary.channels.lastModified,
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
}

function isoDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function limit(value: string, length: number) {
  return Array.from(value).slice(0, length).join("")
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function xmlDocument(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemaps/style.xsl"?>\n${body}\n`
}
