"use client"

import * as React from "react"
import { ArrowDownWideNarrow } from "lucide-react"
import { useTranslations } from "next-intl"
import { SmartSelect } from "@workspace/ui/components"
import { cn } from "@workspace/ui/lib/utils"

import { useRouter } from "@/i18n/navigation"

export type SearchFilterState = {
  q: string
  sort: string
}

const sorts = [
  "relevance",
  "latest",
  "oldest",
  "release",
  "release-oldest",
  "views",
] as const

export function SearchFilterControls({ state }: { state: SearchFilterState }) {
  const router = useRouter()
  const t = useTranslations("video.search")
  const [pending, startTransition] = React.useTransition()

  function changeSort(value: string | string[]) {
    const sort = Array.isArray(value) ? (value[0] ?? "relevance") : value
    const params = new URLSearchParams()
    if (state.q.trim()) params.set("q", state.q.trim())
    if (sort !== "relevance") params.set("sort", sort)
    const query = params.toString()
    startTransition(() => {
      router.push(`/search${query ? `?${query}` : ""}`, { scroll: false })
    })
  }

  return (
    <section
      aria-label={t("columns.sort")}
      aria-busy={pending}
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm transition-opacity",
        pending && "opacity-65"
      )}
    >
      <div className="ml-auto max-w-80 bg-muted/20 p-4 sm:p-5">
        <label className="mb-3 flex items-center gap-2 text-sm font-bold">
          <ArrowDownWideNarrow className="size-4 text-primary" />
          {t("columns.sort")}
        </label>
        <SmartSelect
          value={state.sort}
          disabled={pending}
          className="min-h-11 bg-background font-semibold"
          options={sorts.map((sort) => ({
            value: sort,
            label: t(`options.sort.${sort}`),
          }))}
          onValueChange={changeSort}
        />
      </div>
    </section>
  )
}
