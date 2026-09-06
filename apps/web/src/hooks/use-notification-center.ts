"use client"

import * as React from "react"
import type {
  NotificationsResponse,
  ViewerNotification,
} from "@workspace/core/types"

async function fetchNotifications(cursor = "0") {
  const url = new URL("/api/v1/notifications", window.location.origin)
  url.searchParams.set("cursor", cursor)
  url.searchParams.set("limit", "6")
  const response = await fetch(url, { headers: { accept: "application/json" } })
  if (!response.ok)
    throw new Error(`Notifications API returned ${response.status}`)
  const data = (await response.json()) as NotificationsResponse
  const notifications = data.notifications.filter(
    (item) => item.type !== "live"
  )
  return {
    ...data,
    notifications,
    unreadCount: notifications.filter((item) => item.unread).length,
  }
}

export function useNotificationCenter() {
  const [notifications, setNotifications] = React.useState<
    ViewerNotification[]
  >([])
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(() => new Set())
  const [mutedActorIds, setMutedActorIds] = React.useState<Set<string>>(
    () => new Set()
  )
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [loadMoreError, setLoadMoreError] = React.useState(false)
  const loadingMoreRef = React.useRef(false)

  const applyFirstPage = React.useCallback((data: NotificationsResponse) => {
    setNotifications(data.notifications)
    setNextCursor(data.nextCursor)
    setUnreadCount(data.unreadCount)
  }, [])

  const reload = React.useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      applyFirstPage(await fetchNotifications())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [applyFirstPage])

  React.useEffect(() => {
    let active = true
    void fetchNotifications()
      .then((data) => {
        if (active) applyFirstPage(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [applyFirstPage])

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const data = await fetchNotifications(nextCursor)
      setNotifications((current) => {
        const ids = new Set(current.map((item) => item.id))
        return [
          ...current,
          ...data.notifications.filter((item) => !ids.has(item.id)),
        ]
      })
      setNextCursor(data.nextCursor)
    } catch {
      setLoadMoreError(true)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [nextCursor])

  const visibleNotifications = notifications.filter(
    (item) => !hiddenIds.has(item.id) && !mutedActorIds.has(item.actorId)
  )
  const markRead = React.useCallback(
    (id: string) => {
      const item = notifications.find((entry) => entry.id === id)
      if (item?.unread) setUnreadCount((count) => Math.max(0, count - 1))
      setNotifications((items) =>
        items.map((entry) =>
          entry.id === id ? { ...entry, unread: false } : entry
        )
      )
    },
    [notifications]
  )
  const markAllRead = React.useCallback(() => {
    setNotifications((items) =>
      items.map((item) => ({ ...item, unread: false }))
    )
    setUnreadCount(0)
  }, [])
  const hide = React.useCallback(
    (id: string) => {
      const item = notifications.find((entry) => entry.id === id)
      if (item?.unread) setUnreadCount((count) => Math.max(0, count - 1))
      setHiddenIds((current) => new Set(current).add(id))
    },
    [notifications]
  )
  const muteActor = React.useCallback(
    (actorId: string) => {
      const unreadFromActor = notifications.filter(
        (item) => item.actorId === actorId && item.unread
      ).length
      if (unreadFromActor)
        setUnreadCount((count) => Math.max(0, count - unreadFromActor))
      setMutedActorIds((current) => new Set(current).add(actorId))
    },
    [notifications]
  )

  return {
    notifications: visibleNotifications,
    unreadCount,
    loading,
    loadingMore,
    error,
    loadMoreError,
    hasMore: nextCursor !== null,
    reload,
    loadMore,
    markRead,
    markAllRead,
    hide,
    muteActor,
  }
}
