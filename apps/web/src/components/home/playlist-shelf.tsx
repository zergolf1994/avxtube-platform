"use client"

import type { Playlist } from "@workspace/core/types"
import { ListMusic, ListVideo, Play } from "lucide-react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { SectionHeading } from "./section-heading"

export function PlaylistShelf({
  playlists,
  title,
  bare = false,
  viewAllHref,
  viewAllLabel,
}: {
  playlists: Playlist[]
  title?: string
  bare?: boolean
  viewAllHref?: string
  viewAllLabel?: string
}) {
  const t = useTranslations("video.home")
  const content = (
    <>
      <div className="relative">
        <span className="pointer-events-none absolute top-1 left-0">
          <ListMusic className="size-6 text-primary" />
        </span>
        <div className="pl-8">
          <SectionHeading
            title={title || t("playlists")}
            href={viewAllHref}
            actionLabel={viewAllLabel}
          />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {playlists.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} />
        ))}
      </div>
    </>
  )
  return bare ? (
    content
  ) : (
    <section className="mt-9 border-t pt-7">{content}</section>
  )
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const t = useTranslations("video.home")
  const first = playlist.items[0]
  if (!first) return null
  const playHref = `/watch/${first.id}?list=${encodeURIComponent(playlist.id)}&index=1`
  return (
    <article className="group min-w-0">
      <Link
        href={playHref}
        aria-label={playlist.title}
        className="relative block"
      >
        <div className="absolute -top-2 right-3 left-3 h-full rounded-xl bg-muted ring-1 ring-border" />
        <div className="relative aspect-video overflow-hidden rounded-xl bg-muted transition-transform group-hover:-translate-y-0.5">
          <Image
            src={first.thumbnailUrl}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/80 px-2 py-1 text-xs font-semibold text-white">
            <ListVideo className="size-3.5" />
            {t("videoCount", { count: playlist.items.length })}
          </span>
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-sm font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="mr-2 size-4 fill-current" />
            {t("playAll")}
          </span>
        </div>
      </Link>
      <Link href={playHref}>
        <h3 className="mt-3 line-clamp-1 font-bold group-hover:text-primary">
          {playlist.title}
        </h3>
      </Link>
      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
        {playlist.owner} • {playlist.description}
      </p>
      <Link
        href={`/playlist/${playlist.id}`}
        className="mt-2 inline-block text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {t("viewPlaylist")}
      </Link>
    </article>
  )
}
