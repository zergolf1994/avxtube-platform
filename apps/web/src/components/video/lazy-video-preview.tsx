"use client"

import * as React from "react"

type LazyVideoPreviewProps = {
  posterUrl?: string | null
  previewUrl?: string | null
  active: boolean
  onPlayingChange?: (playing: boolean) => void
  imageClassName?: string
}

export function LazyVideoPreview({
  posterUrl,
  previewUrl,
  active,
  onPlayingChange,
  imageClassName = "",
}: LazyVideoPreviewProps) {
  const viewportRef = React.useRef<HTMLSpanElement>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [canLoadPoster, setCanLoadPoster] = React.useState(false)
  const [posterLoaded, setPosterLoaded] = React.useState(false)
  const [previewCreated, setPreviewCreated] = React.useState(false)
  const [previewPlaying, setPreviewPlaying] = React.useState(false)
  const [previewFailed, setPreviewFailed] = React.useState(false)

  const updatePlaying = React.useCallback(
    (playing: boolean) => {
      setPreviewPlaying(playing)
      onPlayingChange?.(playing)
    },
    [onPlayingChange]
  )

  React.useEffect(() => {
    const target = viewportRef.current
    if (!target) return
    if (!("IntersectionObserver" in window)) {
      setCanLoadPoster(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setCanLoadPoster(true)
        observer.disconnect()
      },
      { threshold: 0.01 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (active && previewUrl && !previewFailed) setPreviewCreated(true)
  }, [active, previewFailed, previewUrl])

  React.useEffect(() => {
    const player = videoRef.current
    if (!player) return
    if (!active || previewFailed) {
      player.pause()
      updatePlaying(false)
      return
    }
    void player.play().catch(() => updatePlaying(false))
  }, [active, previewCreated, previewFailed, updatePlaying])

  React.useEffect(() => {
    setPosterLoaded(false)
    setPreviewCreated(false)
    setPreviewFailed(false)
    updatePlaying(false)
  }, [posterUrl, previewUrl, updatePlaying])

  return (
    <span ref={viewportRef} className="absolute inset-0 block">
      {canLoadPoster && posterUrl ? (
        // Media can come from configured storage or a remote provider.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt=""
          loading="eager"
          decoding="async"
          onLoad={() => setPosterLoaded(true)}
          onError={() => setPosterLoaded(true)}
          className={`size-full object-cover transition-[transform,opacity] duration-300 ${imageClassName} ${previewPlaying ? "opacity-0" : "opacity-100"}`}
        />
      ) : null}

      {canLoadPoster && posterUrl && !posterLoaded ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted-foreground/10 to-muted"
        />
      ) : null}

      {previewCreated && previewUrl && !previewFailed ? (
        <video
          ref={videoRef}
          src={previewUrl}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          onPlaying={() => updatePlaying(true)}
          onPause={() => updatePlaying(false)}
          onError={() => {
            setPreviewFailed(true)
            updatePlaying(false)
          }}
          className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-200 ${previewPlaying ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}
    </span>
  )
}
