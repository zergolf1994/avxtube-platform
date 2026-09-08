import "server-only"

import type { Video } from "@workspace/core/types"

const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000"
const apiVersion = process.env.API_VERSION ?? "v1"

export const sitemapPageSize = 1_000
export type SitemapDataType = "videos" | "shorts" | "channels"

export type SitemapSummary = {
  pageSize: number
  videos: SitemapCount
  shorts: SitemapCount
  channels: SitemapCount
}

export type SitemapCount = {
  count: number
  lastModified?: string
}

export type SitemapDataPage = {
  type: SitemapDataType
  page: number
  pageSize: number
  total: number
  items: Array<{
    slug: string
    lastModified?: string
    video?: Video
  }>
}

export function getSitemapSummary() {
  return fetchSitemapData<SitemapSummary>("")
}

export function getSitemapPage(type: SitemapDataType, page: number) {
  return fetchSitemapData<SitemapDataPage>(
    `/${type}?page=${encodeURIComponent(page)}`
  )
}

async function fetchSitemapData<Result>(path: string): Promise<Result> {
  const response = await fetch(
    new URL(`/${apiVersion}/sitemap${path}`, apiOrigin),
    {
      headers: { accept: "application/json" },
      next: { revalidate: 21_600 },
    }
  )
  if (!response.ok) throw new Error(`Sitemap API returned ${response.status}`)
  return response.json() as Promise<Result>
}
