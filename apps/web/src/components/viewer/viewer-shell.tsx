"use client"

import * as React from "react"

import { usePathname } from "@/i18n/navigation"

import { ViewerHeader } from "./viewer-header"
import {
  ViewerDrawer,
  ViewerMobileNavigation,
  ViewerSidebar,
} from "./viewer-navigation"

function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener("change", onChange)
      return () => mediaQuery.removeEventListener("change", onChange)
    },
    [query]
  )
  const getSnapshot = React.useCallback(
    () => window.matchMedia(query).matches,
    [query]
  )
  const getServerSnapshot = React.useCallback(() => false, [])
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function ViewerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isWatchPage = pathname === "/watch" || pathname.startsWith("/watch/")
  const isShortsPage = pathname === "/shorts" || pathname.startsWith("/shorts/")
  const isShortsViewerPage = pathname.startsWith("/shorts/")
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const usesDrawer = isWatchPage || !isDesktop
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [drawerPathname, setDrawerPathname] = React.useState<string | null>(
    null
  )
  const [watchHeaderVisible, setWatchHeaderVisible] = React.useState(true)
  const drawerOpen = usesDrawer && drawerPathname === pathname

  React.useEffect(() => {
    if (!isWatchPage || isDesktop) return

    let previousY = window.scrollY
    let ticking = false
    let direction = 0
    let directionDistance = 0
    const initialFrame = window.requestAnimationFrame(() => {
      previousY = window.scrollY
      if (previousY <= 8) setWatchHeaderVisible(true)
    })
    const updateVisibility = () => {
      const currentY = window.scrollY
      const delta = currentY - previousY
      const nextDirection = Math.sign(delta)

      if (nextDirection && nextDirection !== direction) {
        direction = nextDirection
        directionDistance = 0
      }
      directionDistance += Math.abs(delta)

      if (currentY <= 8 || (direction < 0 && directionDistance >= 16)) {
        setWatchHeaderVisible(true)
      } else if (direction > 0 && directionDistance >= 24 && currentY > 64) {
        setWatchHeaderVisible(false)
      }

      previousY = currentY
      ticking = false
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(updateVisibility)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.cancelAnimationFrame(initialFrame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [isDesktop, isWatchPage])

  React.useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerPathname(null)
    }
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [drawerOpen])

  const closeDrawer = React.useCallback(() => setDrawerPathname(null), [])
  const toggleNavigation = React.useCallback(() => {
    if (usesDrawer) {
      setDrawerPathname((current) => (current === pathname ? null : pathname))
    } else {
      setDrawerPathname(null)
      setSidebarCollapsed((current) => !current)
    }
  }, [pathname, usesDrawer])

  const watchNavbarVisible = watchHeaderVisible || drawerOpen

  return (
    <div
      className="min-h-svh bg-background"
      style={
        isWatchPage
          ? ({
              "--watch-player-top": watchNavbarVisible ? "4rem" : "0rem",
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className={isShortsPage ? "hidden lg:block" : ""}>
        <ViewerHeader
          watchMode={isWatchPage}
          mobileHidden={isWatchPage && !watchHeaderVisible && !drawerOpen}
          menuExpanded={usesDrawer ? drawerOpen : !sidebarCollapsed}
          onMenuToggle={toggleNavigation}
        />
      </div>
      {!isWatchPage && <ViewerSidebar collapsed={sidebarCollapsed} />}
      <ViewerDrawer open={drawerOpen} onClose={closeDrawer} />
      <main
        className={`transition-[padding] duration-200 ${isShortsPage ? `pt-0 ${isShortsViewerPage ? "pb-0" : "pb-[calc(4rem+env(safe-area-inset-bottom))]"} lg:pt-16 lg:pb-0 ${sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-60"}` : isWatchPage ? "pt-16 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-6" : `pt-16 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 ${sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-60"}`}`}
      >
        <div
          className={`mx-auto w-full ${isWatchPage ? "max-w-[1800px] px-0 py-0 sm:px-6 sm:py-4 lg:px-8" : isShortsPage ? "max-w-[1700px] px-0 py-0 lg:px-7 lg:py-4" : "max-w-[1700px] px-4 py-4 sm:px-6 lg:px-7"}`}
        >
          {children}
        </div>
      </main>
      {!isShortsViewerPage && <ViewerMobileNavigation />}
    </div>
  )
}
