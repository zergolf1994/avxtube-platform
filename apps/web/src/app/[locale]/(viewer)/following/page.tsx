import type { Locale } from "@workspace/i18n/config"
import {
  getFollowingFeed,
  getFollowingProfiles,
} from "@workspace/services/queries/video"
import { UsersRound } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { headers } from "next/headers"
import { getCurrentUser } from "@workspace/auth/server"
import { FollowingProfileCarousel } from "@/components/following/following-profile-carousel"
import { FollowingVideoFeed } from "@/components/following/following-video-feed"
import { ViewerSignInPrompt } from "@/components/viewer/viewer-sign-in-prompt"
import { PRIVATE_PAGE_METADATA } from "@/lib/private-page-metadata"

export const dynamic = "force-dynamic"
export const metadata = PRIVATE_PAGE_METADATA

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const user = await getCurrentUser()
  if (!user.userId)
    return <ViewerSignInPrompt kind="following" locale={locale} />
  const requestHeaders = await headers()
  const cookie = requestHeaders.get("cookie")
  const [profiles, feed, t] = await Promise.all([
    getFollowingProfiles(0, 100, cookie ? { cookie } : undefined).catch(() => ({
      items: [],
      nextCursor: null,
      total: 0,
    })),
    getFollowingFeed(0, 20, cookie ? { cookie } : undefined).catch(() => ({
      items: [],
      nextCursor: null,
      total: 0,
    })),
    getTranslations({ locale, namespace: "video.following" }),
  ])
  return (
    <div className="space-y-10 pb-8">
      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <UsersRound className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("description", { count: profiles.total })}
          </p>
        </div>
      </header>
      {profiles.items.length ? (
        <FollowingProfileCarousel profiles={profiles.items} />
      ) : (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {t("emptyProfiles")}
        </p>
      )}
      <FollowingVideoFeed initialPage={feed} />
    </div>
  )
}
