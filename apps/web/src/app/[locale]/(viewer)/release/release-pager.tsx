"use client"

import { DataTablePager } from "@workspace/data-table"
import { useSearchParams } from "next/navigation"
import * as React from "react"

import { useRouter } from "@/i18n/navigation"

export function ReleasePager({
  page,
  pageCount,
  pageSize,
}: {
  page: number
  pageCount: number
  pageSize: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const changePage = React.useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextPage <= 1) params.delete("page")
      else params.set("page", String(nextPage))
      const query = params.toString()
      router.push(`/release${query ? `?${query}` : ""}`)
    },
    [router, searchParams]
  )

  return (
    <DataTablePager
      page={page}
      pageCount={pageCount}
      pageSize={pageSize}
      onPageChange={changePage}
    />
  )
}
