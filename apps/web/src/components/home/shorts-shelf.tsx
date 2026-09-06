"use client"

import type { Short } from "@workspace/core/types"
import { EllipsisVertical, PlaySquare } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { SectionHeading } from "./section-heading"

export function ShortsShelf({
  shorts,
  limit = 5,
  title = "Shorts",
  bare = false,
  viewAllHref,
  viewAllLabel,
}: {
  shorts: Short[]
  limit?: number
  title?: string
  bare?: boolean
  viewAllHref?: string
  viewAllLabel?: string
}) {
  const t = useTranslations("video.home")
  const locale = useLocale()
  const number = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  })
  const content = (
    <>
      <div className="relative">
        <span className="pointer-events-none absolute top-1 left-0">
          <PlaySquare className="size-6 fill-primary/15 text-primary" />
        </span>
        <div className="pl-8">
          <SectionHeading
            title={title}
            href={viewAllHref}
            actionLabel={viewAllLabel}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {shorts.slice(0, limit).map((short) => (
          <article key={short.id} className="group min-w-0">
            <Link href={`/shorts/${short.id}`}>
              <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
                <Image
                  src={short.thumbnailUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <p className="absolute right-4 bottom-5 left-4 line-clamp-3 text-base leading-5 font-black text-white drop-shadow-lg">
                  {short.title}
                </p>
              </div>
            </Link>
            <div className="mt-2 flex gap-1">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-sm font-semibold">
                  {short.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("shortViews", { count: number.format(short.viewCount) })}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("moreOptions")}
                className="h-8 text-muted-foreground"
              >
                <EllipsisVertical className="size-4" />
              </button>
            </div>
          </article>
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
