"use client"

import * as React from "react"
import { DataTablePager } from "@workspace/data-table"
import { useSearchParams } from "next/navigation"

import { useRouter } from "@/i18n/navigation"

export function PathPager({
  path,
  page,
  pageCount,
  pageSize,
}: {
  path: string
  page: number
  pageCount: number
  pageSize: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  const changePage = React.useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("_rsc")
      if (nextPage <= 1) params.delete("page")
      else params.set("page", String(nextPage))
      const query = params.toString()
      startTransition(() => {
        router.push(`${path}${query ? `?${query}` : ""}`)
      })
    },
    [path, router, searchParams]
  )

  return (
    <div aria-busy={pending}>
      <DataTablePager
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        onPageChange={changePage}
        className={pending ? "pointer-events-none opacity-60" : undefined}
      />
    </div>
  )
}
