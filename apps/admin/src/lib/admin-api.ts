import "server-only"

import { headers } from "next/headers"

import type {
  AdminContent,
  ContentKind,
  ContentListResponse,
  ContentRelations,
} from "./content"
import type { AdminStorage } from "./storage"
import type { QueueImportListResponse, QueueImportStatus } from "./queue-import"
import type { AdminWorkersResponse } from "./worker"
import type {
  AdminChannel,
  AdminChannelKind,
  AdminChannelStatus,
  AdminTerm,
  EntityListResponse,
  EntityStatus,
  TermTaxonomy,
} from "./entity"
import type {
  AdvertSettings,
  DomainSettings,
  HomeFeedSettings,
  SeoSettings,
  WorkerScraperSettings,
} from "@workspace/core/validators"

const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000"

export type HourlyContentStats = {
  date: string
  timeZone: "Asia/Bangkok"
  currentDate: string
  currentHour: number
  total: number
  hours: Array<{ hour: number; count: number }>
}

export async function getHourlyContentStats(
  date: string
): Promise<HourlyContentStats> {
  const url = new URL("/v1/admin/contents/stats/hourly", apiUrl)
  url.searchParams.set("date", date)
  return fetchAdmin<HourlyContentStats>(url)
}

export async function getDomainSettings(): Promise<DomainSettings> {
  const result = await fetchAdmin<{ settings: DomainSettings }>(
    new URL("/v1/admin/settings/domain", apiUrl)
  )
  return result.settings
}

export async function getAdvertSettings(): Promise<AdvertSettings> {
  const result = await fetchAdmin<{ settings: AdvertSettings }>(
    new URL("/v1/admin/settings/adverts", apiUrl)
  )
  return result.settings
}

export async function getWorkerScraperSettings(): Promise<WorkerScraperSettings> {
  const result = await fetchAdmin<{ settings: WorkerScraperSettings }>(
    new URL("/v1/admin/settings/worker-scraper", apiUrl)
  )
  return result.settings
}

export async function getSeoSettings(): Promise<SeoSettings> {
  const result = await fetchAdmin<{ settings: SeoSettings }>(
    new URL("/v1/admin/settings/seo", apiUrl)
  )
  return result.settings
}

export async function getHomeFeedSettings(): Promise<{
  settings: HomeFeedSettings
  categories: string[]
}> {
  return fetchAdmin<{ settings: HomeFeedSettings; categories: string[] }>(
    new URL("/v1/admin/settings/home-feed", apiUrl)
  )
}

export async function getContents(
  input: {
    kind?: ContentKind
    query?: string
    status?: string
    page?: number
    limit?: number
  } = {}
): Promise<ContentListResponse> {
  const url = new URL("/v1/admin/contents", apiUrl)
  if (input.kind) url.searchParams.set("kind", input.kind)
  if (input.query) url.searchParams.set("query", input.query)
  if (input.status) url.searchParams.set("status", input.status)
  if (input.page) url.searchParams.set("page", String(input.page))
  if (input.limit) url.searchParams.set("limit", String(input.limit))
  return fetchAdmin<ContentListResponse>(url)
}

export async function getContent(id: string): Promise<AdminContent | null> {
  const response = await fetchAdmin<{
    content: AdminContent
    relations: ContentRelations
  } | null>(
    new URL(`/v1/admin/contents/${encodeURIComponent(id)}`, apiUrl),
    true
  )
  return response
    ? { ...response.content, relations: response.relations }
    : null
}

export async function getStorages(): Promise<AdminStorage[]> {
  const response = await fetchAdmin<{ storages: AdminStorage[] }>(
    new URL("/v1/admin/storages", apiUrl)
  )
  return response.storages
}

export async function getQueueImports({
  page = 1,
  limit = 50,
  status,
  query,
}: {
  page?: number
  limit?: number
  status?: QueueImportStatus
  query?: string
} = {}): Promise<QueueImportListResponse> {
  const url = new URL("/v1/admin/imports/queue", apiUrl)
  url.searchParams.set("page", String(page))
  url.searchParams.set("limit", String(limit))
  if (status) url.searchParams.set("status", status)
  if (query) url.searchParams.set("q", query)
  return fetchAdmin<QueueImportListResponse>(url)
}

export async function getAdminWorkers(): Promise<AdminWorkersResponse> {
  return fetchAdmin<AdminWorkersResponse>(new URL("/v1/admin/workers", apiUrl))
}

export async function getAdminTerms({
  taxonomy,
  query,
  status,
  page = 1,
  limit = 50,
}: {
  taxonomy: TermTaxonomy
  query?: string
  status?: EntityStatus | "all"
  page?: number
  limit?: number
}): Promise<EntityListResponse<AdminTerm>> {
  const url = new URL("/v1/admin/terms", apiUrl)
  url.searchParams.set("taxonomy", taxonomy)
  if (query) url.searchParams.set("q", query)
  if (status) url.searchParams.set("status", status)
  url.searchParams.set("page", String(page))
  url.searchParams.set("limit", String(limit))
  return fetchAdmin<EntityListResponse<AdminTerm>>(url)
}

export async function getAdminChannels({
  query,
  kind,
  status,
  page = 1,
  limit = 50,
}: {
  query?: string
  kind?: AdminChannelKind
  status?: AdminChannelStatus | "all"
  page?: number
  limit?: number
} = {}): Promise<EntityListResponse<AdminChannel>> {
  const url = new URL("/v1/admin/channels/manage", apiUrl)
  if (query) url.searchParams.set("q", query)
  if (kind) url.searchParams.set("kind", kind)
  if (status) url.searchParams.set("status", status)
  url.searchParams.set("page", String(page))
  url.searchParams.set("limit", String(limit))
  return fetchAdmin<EntityListResponse<AdminChannel>>(url)
}

async function fetchAdmin<T>(url: URL, allowNotFound = false): Promise<T> {
  const requestHeaders = await headers()
  const response = await fetch(url, {
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
    cache: "no-store",
  })

  if (allowNotFound && response.status === 404) return null as T
  if (!response.ok)
    throw new Error(`Admin API request failed (${response.status})`)
  return (await response.json()) as T
}
