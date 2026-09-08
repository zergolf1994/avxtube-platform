"use client"

import * as React from "react"
import type { Video } from "@workspace/core/types"
import type { AdvertSettings } from "@workspace/core/validators"
import { useTranslations } from "next-intl"
import { createPortal, flushSync } from "react-dom"

import { usePathname, useRouter } from "@/i18n/navigation"
import { EmbeddedPlayer, type PlayerPlaybackState } from "./embedded-player"

type PlayerState = {
  video: Video | null
  playlist: { id: string; index: number } | null
  currentTime: number
  isPlaying: boolean
  muted: boolean
  volume: number
  speed: number
  started: boolean
}

type PlayerSurface = "watch" | "mini"

type WatchPlayerContextValue = PlayerState & {
  activate: (
    video: Video,
    playlist?: { id: string; index: number } | null
  ) => void
  dismiss: () => void
  openMiniPlayer: () => void
  restoreMiniPlayer: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  setVolume: (volume: number) => void
  toggleMuted: () => void
  togglePlaying: () => void
  syncPlayback: (state: PlayerPlaybackState, surface: PlayerSurface) => void
  registerWatchHost: (node: HTMLDivElement | null) => void
}

const initialState: PlayerState = {
  video: null,
  playlist: null,
  currentTime: 0,
  isPlaying: false,
  muted: false,
  volume: 0.8,
  speed: 1,
  started: false,
}
const WatchPlayerContext = React.createContext<WatchPlayerContextValue | null>(
  null
)

export function useWatchPlayer() {
  const value = React.useContext(WatchPlayerContext)
  if (!value)
    throw new Error("useWatchPlayer must be used inside WatchPlayerProvider")
  return value
}

export function WatchPlayerProvider({
  children,
  adverts,
}: {
  children: React.ReactNode
  adverts: AdvertSettings
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [state, setState] = React.useState(initialState)
  const [watchHost, setWatchHost] = React.useState<HTMLDivElement | null>(null)
  const [miniRequested, setMiniRequested] = React.useState(false)
  const [playerSurface, setPlayerSurface] = React.useState<HTMLElement | null>(
    null
  )
  const latestPlaybackRef = React.useRef<PlayerPlaybackState>({
    currentTime: initialState.currentTime,
    isPlaying: initialState.isPlaying,
    muted: initialState.muted,
    volume: initialState.volume,
    speed: initialState.speed,
    started: initialState.started,
  })
  const playerSurfaceRef = React.useRef<HTMLElement | null>(null)
  const homePrefetchedRef = React.useRef(false)
  const miniHistoryModeRef = React.useRef<"back" | "push" | null>(null)
  const currentPathRef = React.useRef(pathname)
  const previousPathRef = React.useRef<string | null>(null)
  const activeSurface: PlayerSurface =
    pathname.startsWith("/watch") && !miniRequested ? "watch" : "mini"

  React.useEffect(() => {
    const surface = document.createElement("aside")
    surface.dataset.watchPlayerSurface = ""
    surface.style.display = "none"
    document.body.append(surface)
    playerSurfaceRef.current = surface
    // The portal target can only be created in the browser after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerSurface(surface)

    return () => {
      if (playerSurfaceRef.current === surface) playerSurfaceRef.current = null
      surface.remove()
    }
  }, [])

  React.useEffect(() => {
    if (!pathname.startsWith("/watch") || homePrefetchedRef.current) return
    homePrefetchedRef.current = true
    // Warm the Home route while the viewer watches. Opening the miniplayer can
    // then swap to the already prepared route instead of waiting for HomeFeed.
    router.prefetch("/")
  }, [pathname, router])

  React.useEffect(() => {
    if (currentPathRef.current !== pathname) {
      previousPathRef.current = currentPathRef.current
      currentPathRef.current = pathname
    }
    if (!miniHistoryModeRef.current) return
    if (pathname === "/" || pathname.startsWith("/watch")) return
    // The viewer continued browsing after opening the miniplayer, so Back no
    // longer necessarily points at the originating Watch route.
    miniHistoryModeRef.current = null
  }, [pathname])

  const activate = React.useCallback(
    (video: Video, playlist: { id: string; index: number } | null = null) =>
      setState((current) => {
        if (current.video?.id !== video.id) {
          latestPlaybackRef.current = {
            currentTime: 0,
            isPlaying: false,
            muted: current.muted,
            volume: current.volume,
            speed: current.speed,
            started: false,
          }
          return {
            ...initialState,
            video,
            playlist,
            muted: current.muted,
            volume: current.volume,
            speed: current.speed,
          }
        }
        if (
          current.playlist?.id === playlist?.id &&
          current.playlist?.index === playlist?.index
        )
          return current
        return { ...current, playlist }
      }),
    []
  )
  const togglePlaying = React.useCallback(
    () =>
      setState((current) => {
        if (!current.video) return current
        const isPlaying = !current.isPlaying
        latestPlaybackRef.current = {
          ...latestPlaybackRef.current,
          isPlaying,
          started: true,
        }
        return { ...current, started: true, isPlaying }
      }),
    []
  )
  const toggleMuted = React.useCallback(
    () =>
      setState((current) => {
        const muted = !current.muted
        latestPlaybackRef.current = { ...latestPlaybackRef.current, muted }
        return { ...current, muted }
      }),
    []
  )
  const seek = React.useCallback(
    (time: number) =>
      setState((current) => {
        const currentTime = Math.max(
          0,
          Math.min(current.video?.durationSeconds ?? 0, time)
        )
        latestPlaybackRef.current = {
          ...latestPlaybackRef.current,
          currentTime,
        }
        return { ...current, currentTime }
      }),
    []
  )
  const setVolume = React.useCallback(
    (volume: number) =>
      setState((current) => {
        const muted = volume === 0
        latestPlaybackRef.current = {
          ...latestPlaybackRef.current,
          volume,
          muted,
        }
        return { ...current, volume, muted }
      }),
    []
  )
  const setSpeed = React.useCallback((speed: number) => {
    latestPlaybackRef.current = { ...latestPlaybackRef.current, speed }
    setState((current) => ({ ...current, speed }))
  }, [])
  const syncPlayback = React.useCallback(
    (patch: PlayerPlaybackState, surface: PlayerSurface) => {
      if (surface !== activeSurface) return
      const previous = latestPlaybackRef.current
      const latest: PlayerPlaybackState = {
        ...previous,
        ...patch,
        started: previous.started === true || patch.started === true,
      }
      latestPlaybackRef.current = latest
      setState((current) => {
        if (!current.video) return current
        const semanticChange =
          (typeof patch.isPlaying === "boolean" &&
            patch.isPlaying !== current.isPlaying) ||
          (typeof patch.muted === "boolean" && patch.muted !== current.muted) ||
          (typeof patch.volume === "number" &&
            patch.volume !== current.volume) ||
          (typeof patch.speed === "number" && patch.speed !== current.speed) ||
          (patch.started === true && !current.started)
        const nextTime =
          typeof latest.currentTime === "number"
            ? latest.currentTime
            : current.currentTime
        // Keep an exact mutable snapshot for route/mini transitions, but avoid
        // rerendering the entire viewer four times per second for time events.
        if (!semanticChange && Math.abs(nextTime - current.currentTime) < 1)
          return current
        return {
          ...current,
          currentTime: nextTime,
          isPlaying:
            typeof latest.isPlaying === "boolean"
              ? latest.isPlaying
              : current.isPlaying,
          muted:
            typeof latest.muted === "boolean" ? latest.muted : current.muted,
          volume:
            typeof latest.volume === "number" ? latest.volume : current.volume,
          speed:
            typeof latest.speed === "number" ? latest.speed : current.speed,
          started: current.started || latest.started === true,
        }
      })
    },
    [activeSurface]
  )
  const dismiss = React.useCallback(() => {
    latestPlaybackRef.current = {
      currentTime: 0,
      isPlaying: false,
      muted: latestPlaybackRef.current.muted,
      volume: latestPlaybackRef.current.volume,
      speed: latestPlaybackRef.current.speed,
      started: false,
    }
    setState((current) => ({
      ...initialState,
      muted: current.muted,
      volume: current.volume,
      speed: current.speed,
    }))
    setMiniRequested(false)
  }, [])
  const registerWatchHost = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      const surface = playerSurfaceRef.current
      // Keep the persistent player alive when React removes the watch page.
      // Moving it first prevents the media element from being detached with
      // its host during a route transition.
      if (surface?.isConnected && surface.parentElement !== document.body)
        document.body.append(surface)
    }
    setWatchHost(node)
    if (node) setMiniRequested(false)
  }, [])
  const openMiniPlayer = React.useCallback(() => {
    // Commit the playback snapshot before navigation swaps the watch surface
    // for the miniplayer surface. Without this, a fast route transition can
    // render the destination from the previous (not-started) snapshot.
    flushSync(() => {
      setState((current) => ({
        ...current,
        ...(typeof latestPlaybackRef.current.currentTime === "number"
          ? { currentTime: latestPlaybackRef.current.currentTime }
          : {}),
        ...(typeof latestPlaybackRef.current.isPlaying === "boolean"
          ? { isPlaying: latestPlaybackRef.current.isPlaying }
          : {}),
        started: true,
      }))
      setMiniRequested(true)
    })
    const surface = playerSurfaceRef.current
    if (surface?.isConnected && surface.parentElement !== document.body)
      document.body.append(surface)
    if (previousPathRef.current === "/") {
      miniHistoryModeRef.current = "back"
      router.back()
    } else {
      miniHistoryModeRef.current = "push"
      router.push("/")
    }
  }, [router])
  const restoreMiniPlayer = React.useCallback(() => {
    if (!state.video) return
    setMiniRequested(false)
    if (pathname === "/" && miniHistoryModeRef.current) {
      const historyMode = miniHistoryModeRef.current
      miniHistoryModeRef.current = null
      if (historyMode === "back") router.forward()
      else router.back()
      return
    }
    const watchHref = state.playlist
      ? `/watch/${state.video.id}?list=${encodeURIComponent(state.playlist.id)}&index=${state.playlist.index}`
      : `/watch/${state.video.id}`
    router.push(watchHref)
  }, [pathname, router, state.playlist, state.video])
  const value = React.useMemo(
    () => ({
      ...state,
      activate,
      dismiss,
      openMiniPlayer,
      restoreMiniPlayer,
      registerWatchHost,
      seek,
      setSpeed,
      setVolume,
      syncPlayback,
      toggleMuted,
      togglePlaying,
    }),
    [
      activate,
      dismiss,
      openMiniPlayer,
      restoreMiniPlayer,
      registerWatchHost,
      seek,
      setSpeed,
      setVolume,
      syncPlayback,
      state,
      toggleMuted,
      togglePlaying,
    ]
  )
  const showMiniPlayer = Boolean(
    state.video &&
    state.started &&
    !pathname.startsWith("/watch") &&
    !pathname.startsWith("/shorts")
  )
  const isWatchPage = pathname.startsWith("/watch")
  const useWatchSurface = Boolean(isWatchPage && watchHost && !miniRequested)
  const showPersistentPlayer = Boolean(
    state.video &&
    !pathname.startsWith("/shorts") &&
    (isWatchPage || showMiniPlayer)
  )

  React.useLayoutEffect(() => {
    if (!playerSurface || showPersistentPlayer) return
    const surface = playerSurfaceRef.current
    if (!surface) return
    surface.style.display = "none"
    surface.removeAttribute("aria-label")
    if (surface.isConnected && surface.parentElement !== document.body)
      document.body.append(surface)
  }, [playerSurface, showPersistentPlayer])

  return (
    <WatchPlayerContext.Provider value={value}>
      {children}
      {showPersistentPlayer && state.video ? (
        <PersistentPlayer
          adverts={adverts}
          video={state.video}
          state={value}
          surface={playerSurface}
          watchHost={watchHost}
          watchMode={useWatchSurface}
          visible={
            useWatchSurface ||
            Boolean(
              state.started && (miniRequested || !isWatchPage || !watchHost)
            )
          }
        />
      ) : null}
    </WatchPlayerContext.Provider>
  )
}

function PersistentPlayer({
  adverts,
  video,
  state,
  surface,
  watchHost,
  watchMode,
  visible,
}: {
  adverts: AdvertSettings
  video: Video
  state: WatchPlayerContextValue
  surface: HTMLElement | null
  watchHost: HTMLDivElement | null
  watchMode: boolean
  visible: boolean
}) {
  const t = useTranslations("video")
  const syncPlayback = state.syncPlayback
  const syncCurrentPlayback = React.useCallback(
    (patch: PlayerPlaybackState) =>
      syncPlayback(patch, watchMode ? "watch" : "mini"),
    [syncPlayback, watchMode]
  )
  const dismiss = state.dismiss
  const restoreMiniPlayer = state.restoreMiniPlayer
  const handleMiniPlayerAction = React.useCallback(
    (action: "restore" | "close") => {
      if (action === "restore") restoreMiniPlayer()
      else dismiss()
    },
    [dismiss, restoreMiniPlayer]
  )
  const playerPlaybackState = React.useMemo<PlayerPlaybackState>(
    () => ({
      currentTime: state.currentTime,
      isPlaying: state.isPlaying,
      muted: state.muted,
      volume: state.volume,
      speed: state.speed,
      started: state.started,
    }),
    [
      state.currentTime,
      state.isPlaying,
      state.muted,
      state.speed,
      state.started,
      state.volume,
    ]
  )

  React.useLayoutEffect(() => {
    if (!surface) return
    surface.style.removeProperty("display")
    surface.setAttribute("aria-label", t("nowPlaying", { title: video.title }))
    // This HTMLElement is an imperative portal host, not React-owned markup.
    // eslint-disable-next-line react-hooks/immutability
    surface.className = watchMode
      ? `absolute inset-0 z-10 overflow-hidden bg-black sm:rounded-xl ${visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`
      : `fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] w-[calc(100vw-24px)] max-w-[400px] overflow-hidden rounded-xl border bg-background shadow-2xl lg:right-5 lg:bottom-5 ${visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`

    const destination = watchMode ? watchHost : document.body
    if (destination && surface.parentElement !== destination)
      destination.append(surface)

    return () => {
      surface.style.display = "none"
      surface.removeAttribute("aria-label")
    }
  }, [surface, t, video.title, visible, watchHost, watchMode])

  if (!surface) return null

  return createPortal(
    <>
      <div className="group relative aspect-video overflow-hidden bg-black text-white">
        <EmbeddedPlayer
          adverts={adverts}
          key={video.id}
          video={video}
          playbackState={playerPlaybackState}
          miniPlayerMode={watchMode ? "inline" : "active"}
          miniPlayerRestoreLabel={t("returnToVideo")}
          miniPlayerCloseLabel={t("closeVideo")}
          miniPlayerMuteLabel={t("mute")}
          miniPlayerUnmuteLabel={t("unmute")}
          onStateChange={syncCurrentPlayback}
          onMiniPlayerRequest={state.openMiniPlayer}
          onMiniPlayerAction={handleMiniPlayerAction}
        />
      </div>
      {!watchMode ? (
        <div className="flex min-h-16 items-center bg-background px-4 py-2.5 text-foreground">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{video.title}</p>
            {video.channel?.name ? (
              <p className="truncate text-xs text-muted-foreground">
                {video.channel.name}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>,
    surface
  )
}
