import type { Channel, Video } from "@workspace/core/types"

import { absoluteUrl } from "@/i18n/metadata"

export function videoStructuredData(video: Video, pageUrl: string) {
  const duration = isoDuration(video.durationSeconds)

  return compact({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": pageUrl,
    url: pageUrl,
    name: video.title,
    description: video.description || undefined,
    thumbnailUrl: video.thumbnailUrl
      ? [absoluteUrl(video.thumbnailUrl)]
      : undefined,
    uploadDate: video.publishedAt || undefined,
    duration,
    genre: video.categories?.map((item) => item.name) ?? video.category,
    actor: video.actors?.map((actor) => ({
      "@type": "Person",
      name: actor.name,
      url: absoluteUrl(
        `/channel/${encodeURIComponent(actor.handle.replace(/^@/, ""))}`
      ),
    })),
    director: video.directors?.map((director) => ({
      "@type": "Person",
      name: director.name,
      url: absoluteUrl(
        `/channel/${encodeURIComponent(director.handle.replace(/^@/, ""))}`
      ),
    })),
    productionCompany: video.studios?.map((studio) => ({
      "@type": "Organization",
      name: studio.name,
      url: absoluteUrl(
        `/channel/${encodeURIComponent(studio.handle.replace(/^@/, ""))}`
      ),
    })),
    interactionStatistic:
      video.viewCount > 0
        ? {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/WatchAction",
            userInteractionCount: video.viewCount,
          }
        : undefined,
    publisher: {
      "@type": "Organization",
      name: "AVXTUBE",
      url: absoluteUrl("/"),
    },
  })
}

export function websiteStructuredData({
  pageUrl,
  siteName,
  description,
  language,
}: {
  pageUrl: string
  siteName: string
  description?: string
  language: string
}) {
  const organizationId = `${absoluteUrl("/")}#organization`
  const websiteId = `${pageUrl}#website`

  return {
    "@context": "https://schema.org",
    "@graph": [
      compact({
        "@type": "Organization",
        "@id": organizationId,
        name: siteName,
        url: absoluteUrl("/"),
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/favicon.png"),
        },
      }),
      compact({
        "@type": "WebSite",
        "@id": websiteId,
        url: pageUrl,
        name: siteName,
        description,
        inLanguage: language,
        publisher: { "@id": organizationId },
      }),
    ],
  }
}

export function channelStructuredData(channel: Channel, pageUrl: string) {
  const type =
    channel.kind === "person"
      ? "Person"
      : channel.kind === "organization"
        ? "Organization"
        : "ProfilePage"

  return compact({
    "@context": "https://schema.org",
    "@type": type,
    "@id": pageUrl,
    url: pageUrl,
    name: channel.name,
    alternateName: `@${channel.handle.replace(/^@/, "")}`,
    description: channel.description || undefined,
    image: channel.avatarUrl ? absoluteUrl(channel.avatarUrl) : undefined,
    sameAs: channel.links.map((link) => link.url).filter(isHttpUrl),
    ...(channel.kind === "person"
      ? {
          gender: channel.metadata?.gender,
          nationality: channel.metadata?.nationality ?? channel.country,
        }
      : {}),
  })
}

function isoDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined
  const rounded = Math.round(seconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const remainingSeconds = rounded % 60
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${remainingSeconds || (!hours && !minutes) ? `${remainingSeconds}S` : ""}`
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === undefined || item === null || item === "") return false
      return !Array.isArray(item) || item.length > 0
    })
  )
}
