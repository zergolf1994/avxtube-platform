import { getCurrentUser } from "@workspace/auth/server"
import type { Locale } from "@workspace/i18n/config"
import { getHistory } from "@workspace/services/queries/video"
import { headers } from "next/headers"

import { HistoryPage } from "@/components/history/history-page"
import { ViewerSignInPrompt } from "@/components/viewer/viewer-sign-in-prompt"
import { PRIVATE_PAGE_METADATA } from "@/lib/private-page-metadata"

export const dynamic = "force-dynamic"
export const metadata = PRIVATE_PAGE_METADATA

export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const user = await getCurrentUser()
  if (!user.userId) return <ViewerSignInPrompt kind="history" locale={locale} />
  const requestHeaders = await headers()
  const cookie = requestHeaders.get("cookie")
  const result = await getHistory(cookie ? { cookie } : undefined).catch(
    () => ({ kind: "history" as const, videos: [], entries: [], total: 0 })
  )
  return <HistoryPage initialEntries={result.entries} locale={locale} />
}
