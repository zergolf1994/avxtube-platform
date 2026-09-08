import { cache } from "react"
import type { PublicTermTaxonomy } from "@workspace/core/types"
import { getTerm, getTerms } from "@workspace/services/queries/video"

export const TERM_PAGE_SIZE = 24
export const TERM_DIRECTORY_PAGE_SIZE = 48

export const getTermPageData = cache(
  (taxonomy: PublicTermTaxonomy, slug: string, page: number, locale: string) =>
    getTerm(taxonomy, slug, (page - 1) * TERM_PAGE_SIZE, TERM_PAGE_SIZE, locale)
)

export function getTermDirectoryPage(
  taxonomy: PublicTermTaxonomy,
  page: number
) {
  return getTerms(
    taxonomy,
    (page - 1) * TERM_DIRECTORY_PAGE_SIZE,
    TERM_DIRECTORY_PAGE_SIZE
  )
}

export function positivePage(value?: string | string[]) {
  const first = Array.isArray(value) ? value[0] : value
  return Math.max(1, Number.parseInt(first ?? "1", 10) || 1)
}
