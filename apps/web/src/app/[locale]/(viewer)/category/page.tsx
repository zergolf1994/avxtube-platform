import type { Locale } from "@workspace/i18n/config"
import { getTranslations } from "next-intl/server"

import { TermDirectory } from "@/components/term/term-directory"
import {
  getTermDirectoryPage,
  positivePage,
  TERM_DIRECTORY_PAGE_SIZE,
} from "@/components/term/term-page-data"
import { createPageMetadata } from "@/i18n/metadata"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: "video.taxonomy.category",
  })
  return createPageMetadata({
    locale,
    pathname: "/category",
    title: t("title"),
    description: t("description"),
  })
}

export default async function CategoryDirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  const page = positivePage(query.page)
  const result = await getTermDirectoryPage("category", page).catch(() => ({
    terms: [],
    total: 0,
    nextCursor: null,
  }))
  return (
    <TermDirectory
      taxonomy="category"
      locale={locale}
      page={page}
      pageSize={TERM_DIRECTORY_PAGE_SIZE}
      result={result}
    />
  )
}
