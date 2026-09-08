/* eslint-disable @next/next/no-img-element */
"use client"

import type { Video } from "@workspace/core/types"
import * as React from "react"

import { Link } from "@/i18n/navigation"
import { LazyVideoPreview } from "./lazy-video-preview"

export function VideoListCard({
  video,
  viewsLabel,
  action,
  variant = "default",
  publishedLabel,
}: {
  video: Video
  viewsLabel: string
  action?: React.ReactNode
  variant?: "default" | "search"
  publishedLabel?: string
}) {
  const [previewActive, setPreviewActive] = React.useState(false)
  const [previewPlaying, setPreviewPlaying] = React.useState(false)
  const canPreview = Boolean(video.previewUrl)

  return (
    <article
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && canPreview) setPreviewActive(true)
      }}
      onPointerLeave={() => {
        setPreviewPlaying(false)
        setPreviewActive(false)
      }}
      className={
        variant === "search"
          ? "group grid grid-cols-[112px_minmax(0,1fr)] items-start gap-3 bg-background py-4 min-[400px]:grid-cols-[136px_minmax(0,1fr)] sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-5 sm:py-5"
          : "group block bg-background sm:flex sm:gap-3"
      }
    >
      <Link
        href={`/watch/${video.id}`}
        aria-label={video.title}
        className={
          variant === "search"
            ? "relative block aspect-video w-full overflow-hidden rounded-lg bg-muted sm:rounded-xl"
            : "relative block aspect-video w-full shrink-0 overflow-hidden bg-muted sm:w-40 sm:rounded-lg"
        }
      >
        <LazyVideoPreview
          posterUrl={video.thumbnailUrl}
          previewUrl={video.previewUrl}
          active={previewActive}
          onPlayingChange={setPreviewPlaying}
          imageClassName="group-hover:scale-105"
        />
        <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white">
          {formatDuration(video.durationSeconds)}
        </span>
      </Link>
      <div
        className={
          variant === "search"
            ? "flex min-w-0 items-start gap-2"
            : "flex min-w-0 flex-1 items-start gap-2 p-3 sm:p-0"
        }
      >
        <div className="min-w-0 flex-1">
          <Link href={`/watch/${video.id}`}>
            <h3
              className={
                variant === "search"
                  ? "line-clamp-3 text-sm leading-snug font-semibold group-hover:text-primary sm:line-clamp-2 sm:text-lg"
                  : "line-clamp-2 text-sm font-semibold group-hover:text-primary"
              }
            >
              {video.title}
            </h3>
          </Link>
          {video.channel ? (
            <Link
              href={`/channel/${video.channel.handle.replace(/^@/, "")}`}
              className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground"
            >
              {video.channel.name}
            </Link>
          ) : null}
          <p className="text-xs text-muted-foreground">{viewsLabel}</p>
          {publishedLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {publishedLabel}
            </p>
          ) : null}
          {variant === "search" && video.description ? (
            <p className="mt-3 hidden text-sm leading-relaxed text-muted-foreground sm:line-clamp-2">
              {video.description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
    </article>
  )
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(
    0,
    Math.floor(Number.isFinite(seconds) ? seconds : 0)
  )
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const rest = totalSeconds % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`
}
