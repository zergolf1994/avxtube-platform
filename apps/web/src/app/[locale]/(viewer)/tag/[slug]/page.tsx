import type { Locale } from "@workspace/i18n/config"
import { notFound } from "next/navigation"

import {
  getTermPageData,
  positivePage,
  TERM_PAGE_SIZE,
} from "@/components/term/term-page-data"
import { TermVideos } from "@/components/term/term-videos"
import { createPageMetadata } from "@/i18n/metadata"

type Props = {
  params: Promise<{ locale: Locale; slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params
  const result = await getTermPageData("tag", slug, 1, locale).catch(() => null)
  if (!result) return {}
  return createPageMetadata({
    locale,
    pathname: `/tag/${result.term.slug}`,
    title: result.term.name,
    description: result.term.description || undefined,
  })
}

export default async function TagPage({ params, searchParams }: Props) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams])
  const page = positivePage(query.page)
  const result = await getTermPageData("tag", slug, page, locale).catch(
    () => null
  )
  if (!result) notFound()
  return (
    <TermVideos
      taxonomy="tag"
      locale={locale}
      page={page}
      pageSize={TERM_PAGE_SIZE}
      result={result}
    />
  )
}
