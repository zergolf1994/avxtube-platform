"use client"

import { SmartSelect } from "@workspace/ui/components"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowDownWideNarrow,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import * as React from "react"

import { useRouter } from "@/i18n/navigation"

type ReleaseSort = "releaseDate" | "latest" | "trending"
type ActressFilter = "all" | "single" | "multiple"

export function ReleaseControls({
  actress,
  sort,
  labels,
}: {
  actress: ActressFilter
  sort: ReleaseSort
  labels: {
    filter: string
    all: string
    singleActress: string
    multipleActresses: string
    sort: string
    releaseDate: string
    latest: string
    trending: string
    resultCount: string
  }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  const navigate = React.useCallback(
    (patch: { actress?: ActressFilter; sort?: ReleaseSort }) => {
      const params = new URLSearchParams(searchParams.toString())
      const nextActress = patch.actress ?? actress
      const nextSort = patch.sort ?? sort
      if (nextActress === "all") params.delete("actress")
      else params.set("actress", nextActress)
      if (nextSort === "releaseDate") params.delete("sort")
      else params.set("sort", nextSort)
      params.delete("page")
      const query = params.toString()
      startTransition(() => {
        router.push(`/release${query ? `?${query}` : ""}`)
      })
    },
    [actress, router, searchParams, sort]
  )

  const filters = [
    { value: "all" as const, label: labels.all, icon: SlidersHorizontal },
    {
      value: "single" as const,
      label: labels.singleActress,
      icon: UserRound,
    },
    {
      value: "multiple" as const,
      label: labels.multipleActresses,
      icon: UsersRound,
    },
  ]

  return (
    <section
      aria-label={labels.filter}
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm transition-opacity",
        pending && "opacity-65"
      )}
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <SlidersHorizontal className="size-4 text-primary" />
              {labels.filter}
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground lg:hidden">
              {labels.resultCount}
            </span>
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1">
            {filters.map((filter) => {
              const Icon = filter.icon
              const active = actress === filter.value
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={active}
                  disabled={pending}
                  onClick={() => navigate({ actress: filter.value })}
                  className={cn(
                    "flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-all",
                    active
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4", active && "text-primary")} />
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t bg-muted/20 p-4 sm:p-5 lg:border-t-0 lg:border-l">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ArrowDownWideNarrow className="size-4 text-primary" />
              {labels.sort}
            </div>
            <span className="hidden text-xs font-medium text-muted-foreground lg:block">
              {labels.resultCount}
            </span>
          </div>
          <SmartSelect
            value={sort}
            disabled={pending}
            className="min-h-10 bg-background font-semibold"
            options={[
              { value: "releaseDate", label: labels.releaseDate },
              { value: "latest", label: labels.latest },
              { value: "trending", label: labels.trending },
            ]}
            onValueChange={(value) =>
              navigate({
                sort:
                  value === "latest" || value === "trending"
                    ? value
                    : "releaseDate",
              })
            }
          />
        </div>
      </div>
    </section>
  )
}
