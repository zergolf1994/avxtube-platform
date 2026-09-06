"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import {
  CircleUserRound,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Flame,
  History,
  Home,
  Library,
  LoaderCircle,
  Menu,
  PlaySquare,
  ThumbsUp,
  UsersRound,
} from "lucide-react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { authClient } from "@workspace/auth/client"

import { Link, usePathname } from "@/i18n/navigation"
import { useFollowingProfiles } from "@/hooks/use-following-profiles"

import { ViewerBrand } from "./viewer-brand"
import { ViewerAvatar } from "./viewer-avatar"
import { viewerRoutes } from "./viewer-routes"

type NavigationItem = {
  key: string
  href: string
  icon: LucideIcon
}

const primaryItems: NavigationItem[] = [
  { key: "home", href: viewerRoutes.home, icon: Home },
  { key: "shorts", href: viewerRoutes.shorts, icon: PlaySquare },
  { key: "trending", href: viewerRoutes.trending, icon: Flame },
  { key: "following", href: viewerRoutes.following, icon: UsersRound },
]

const libraryItems: NavigationItem[] = [
  { key: "library", href: viewerRoutes.library, icon: Library },
  { key: "history", href: viewerRoutes.history, icon: History },
  { key: "watchLater", href: viewerRoutes.watchLater, icon: Clock3 },
  { key: "liked", href: viewerRoutes.liked, icon: ThumbsUp },
]

const compactItems = [
  primaryItems[0]!,
  primaryItems[1]!,
  primaryItems[3]!,
  {
    key: "you",
    href: viewerRoutes.library,
    icon: CircleUserRound,
  },
]

function useIsActive() {
  const pathname = usePathname()
  return (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)
}

function NavigationLink({
  item,
  compact = false,
  onNavigate,
}: {
  item: NavigationItem
  compact?: boolean
  onNavigate?: () => void
}) {
  const t = useTranslations("viewer.navigation")
  const isActive = useIsActive()
  const Icon = item.icon
  const active = isActive(item.href)

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={
        compact
          ? `flex h-[72px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] transition-colors hover:bg-muted ${active ? "font-semibold text-foreground" : "text-foreground/80"}`
          : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`
      }
    >
      <Icon
        className={
          compact
            ? "size-6"
            : `size-[18px] ${active ? "fill-primary/15 text-primary" : ""}`
        }
      />
      <span className={compact ? "max-w-full truncate" : undefined}>
        {t(item.key)}
      </span>
    </Link>
  )
}

function NavigationContent({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("viewer.navigation")
  const auth = useTranslations("auth")
  const { data: session, isPending } = authClient.useSession()
  const visiblePrimaryItems = session?.user
    ? primaryItems.filter((item) => item.key !== "following")
    : primaryItems
  return (
    <>
      <nav className="space-y-0.5 border-b pb-3" aria-label={t("primaryLabel")}>
        {visiblePrimaryItems.map((item) => (
          <NavigationLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      {session?.user ? <FollowingNavigation onNavigate={onNavigate} /> : null}
      <nav className="space-y-0.5 border-b py-3" aria-label={t("libraryLabel")}>
        <p className="px-3 py-2 text-sm font-semibold">{t("you")}</p>
        {(session?.user ? libraryItems : libraryItems.slice(0, 2)).map(
          (item) => (
            <NavigationLink
              key={item.href}
              item={item}
              onNavigate={onNavigate}
            />
          )
        )}
      </nav>
      {!isPending && !session?.user ? (
        <section className="border-b px-3 py-5">
          <p className="text-sm leading-5">{t("guestDescription")}</p>
          <Link
            href="/login"
            onClick={onNavigate}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-blue-500 px-3 text-sm font-semibold text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
          >
            <CircleUserRound className="size-5" />
            {auth("action.login")}
          </Link>
        </section>
      ) : null}
      <footer className="px-3 py-5 text-[10px] leading-5 text-muted-foreground">
        {t("footer")}
        <br />
        {t("copyright")}
      </footer>
    </>
  )
}

function FollowingNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("viewer.navigation")
  const following = useFollowingProfiles()
  return (
    <nav className="space-y-1 border-b py-3" aria-label={t("followingLabel")}>
      <Link
        href={viewerRoutes.following}
        onClick={onNavigate}
        className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold hover:bg-muted"
      >
        <span>{t("following")}</span>
        <ChevronRight className="size-4" />
      </Link>
      {following.items.map((profile) => (
        <Link
          key={profile.id}
          href={viewerRoutes.followedProfile(profile.type, profile.handle)}
          onClick={onNavigate}
          title={t(profile.type)}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-muted"
        >
          <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground text-[9px] font-bold text-background">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt=""
                fill
                unoptimized
                sizes="28px"
                className="object-cover"
              />
            ) : (
              profile.initials
            )}
          </span>
          <span className="truncate">{profile.name}</span>
          {profile.hasNew ? (
            <span
              className="ml-auto size-1.5 shrink-0 rounded-full bg-blue-600"
              aria-label={t("newContent")}
            />
          ) : null}
        </Link>
      ))}
      {following.hasMore ? (
        <button
          type="button"
          disabled={following.loading}
          onClick={() => void following.loadMore()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {following.loading ? (
            <LoaderCircle className="size-[18px] animate-spin" />
          ) : (
            <ChevronDown className="size-[18px]" />
          )}{" "}
          {t(
            following.error
              ? "retry"
              : following.loading
                ? "loading"
                : "showMore"
          )}
        </button>
      ) : following.expanded ? (
        <button
          type="button"
          onClick={following.collapse}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <ChevronUp className="size-[18px]" />
          {t("showLess")}
        </button>
      ) : null}
    </nav>
  )
}

export function ViewerSidebar({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <aside
        id="viewer-navigation"
        className="fixed inset-y-16 left-0 z-30 hidden w-[88px] bg-background px-1 py-2 lg:block"
      >
        <nav className="space-y-1">
          {compactItems.map((item) => (
            <NavigationLink key={item.href} item={item} compact />
          ))}
        </nav>
      </aside>
    )
  }

  return (
    <aside
      id="viewer-navigation"
      className="fixed inset-y-16 left-0 z-30 hidden w-60 overflow-y-auto bg-background px-3 py-3 [scrollbar-width:none] lg:block [&::-webkit-scrollbar]:hidden"
    >
      <NavigationContent />
    </aside>
  )
}

export function ViewerDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations("viewer.navigation")
  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="fixed inset-0 z-[45] cursor-default bg-black/50"
      />
      <aside
        id="viewer-navigation"
        aria-label={t("primaryLabel")}
        className="fixed inset-y-0 left-0 z-50 w-60 bg-background shadow-2xl"
      >
        <div className="flex h-16 items-center gap-4 px-4">
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <Menu className="size-5" />
          </button>
          <ViewerBrand />
        </div>
        <div className="h-[calc(100svh-4rem)] overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <NavigationContent onNavigate={onClose} />
        </div>
      </aside>
    </>
  )
}

export function ViewerMobileNavigation() {
  const t = useTranslations("viewer.navigation")
  const isActive = useIsActive()
  const { data: session } = authClient.useSession()
  const mounted = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    React.useCallback(() => true, []),
    React.useCallback(() => false, [])
  )
  const items = [primaryItems[0]!, primaryItems[1]!, primaryItems[3]!]
  const youActive = [
    viewerRoutes.library,
    viewerRoutes.history,
    viewerRoutes.watchLater,
    viewerRoutes.liked,
  ].some(isActive)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      {items.map(({ key, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] ${isActive(href) ? "text-primary" : "text-muted-foreground"}`}
        >
          <Icon className="size-5" />
          {t(key)}
        </Link>
      ))}
      <Link
        href={viewerRoutes.library}
        aria-current={youActive ? "page" : undefined}
        className={`flex flex-col items-center justify-center gap-1 text-[10px] ${youActive ? "text-primary" : "text-muted-foreground"}`}
      >
        {mounted && session?.user ? (
          <ViewerAvatar
            user={session.user}
            className={`size-6 ${youActive ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
          />
        ) : (
          <CircleUserRound className="size-5" />
        )}
        {t("you")}
      </Link>
    </nav>
  )
}
