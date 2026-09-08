"use client"

import * as React from "react"
import { FileVideo, Pencil } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import {
  DataTable,
  DataTablePager,
  type ColumnDef,
  useTable,
} from "@workspace/data-table"
import { buttonVariants } from "@workspace/ui/components"

import type { AdminContent, ContentKind } from "@/lib/content"

export function ContentsTable({
  kind,
  items,
  page,
  pageCount,
  pageSize,
  emptyLabel,
}: {
  kind: ContentKind
  items: AdminContent[]
  page: number
  pageCount: number
  pageSize: number
  emptyLabel: string
}) {
  const t = useTranslations("admin")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const columns = React.useMemo<ColumnDef<AdminContent, unknown>[]>(
    () => createColumns({ kind, locale, t }),
    [kind, locale, t]
  )
  const { table } = useTable({
    data: items,
    columns,
    pageCount,
    pagination: { pageIndex: Math.max(0, page - 1), pageSize },
    manualPagination: true,
    manualSorting: true,
  })

  function changePage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) params.delete("page")
    else params.set("page", String(nextPage))
    const query = params.toString()
    router.push(`/contents/${kind}${query ? `?${query}` : ""}`)
  }

  return (
    <section className="space-y-2">
      <DataTable
        table={table}
        className="overflow-hidden rounded-xl border bg-card shadow-xs"
        empty={
          <div className="grid min-h-64 place-items-center rounded-xl border bg-card px-6 text-center">
            <div className="space-y-3">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <FileVideo className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            </div>
          </div>
        }
      />
      {pageCount > 1 ? (
        <DataTablePager
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          onPageChange={changePage}
        />
      ) : null}
    </section>
  )
}

type AdminTranslator = ReturnType<typeof useTranslations<"admin">>

function createColumns({
  kind,
  locale,
  t,
}: {
  kind: ContentKind
  locale: string
  t: AdminTranslator
}): ColumnDef<AdminContent, unknown>[] {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return [
    {
      id: "poster",
      header: "",
      enableSorting: false,
      enableHiding: false,
      meta: {
        headProps: { className: "w-[76px]" },
        cellProps: { className: "w-[76px] py-2 pr-0" },
      },
      cell: ({ row }) => <Poster content={row.original} />,
    },
    {
      id: "title",
      header: t("title"),
      enableSorting: false,
      meta: {
        headProps: { className: "min-w-52" },
        cellProps: { className: "min-w-52 max-w-0 w-full" },
      },
      cell: ({ row }) => (
        <ContentInformation kind={kind} content={row.original} />
      ),
    },
    {
      accessorKey: "visibility",
      header: t("visibility"),
      enableSorting: false,
      meta: {
        headProps: { className: "hidden lg:table-cell w-32" },
        cellProps: {
          className:
            "hidden lg:table-cell whitespace-nowrap text-muted-foreground",
        },
      },
      cell: ({ row }) => t(`visibilities.${row.original.visibility}`),
    },
    {
      accessorKey: "updatedAt",
      header: t("updated"),
      enableSorting: false,
      meta: {
        headProps: { className: "hidden md:table-cell w-48" },
        cellProps: {
          className:
            "hidden md:table-cell whitespace-nowrap text-muted-foreground",
        },
      },
      cell: ({ row }) => dateFormatter.format(new Date(row.original.updatedAt)),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("actions")}</span>,
      enableSorting: false,
      enableHiding: false,
      meta: {
        headProps: { className: "w-14" },
        cellProps: { className: "w-14 text-right" },
      },
      cell: ({ row }) => (
        <Link
          href={`/contents/${kind}/${row.original._id}/edit`}
          aria-label={t("editAction")}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <Pencil className="size-4" />
        </Link>
      ),
    },
  ]
}

function ContentInformation({
  kind,
  content,
}: {
  kind: ContentKind
  content: AdminContent
}) {
  const t = useTranslations("admin")
  const title =
    content.title ||
    plainText(content.description).slice(0, 90) ||
    `#${content._id}`

  return (
    <div className="min-w-0 space-y-1 py-1">
      <div className="flex min-w-0 items-center gap-2">
        <StatusBadge
          status={content.status}
          label={t(`statuses.${content.status}`)}
        />
        <Link
          href={`/contents/${kind}/${content._id}/edit`}
          className="truncate font-semibold hover:text-primary"
        >
          {title}
        </Link>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {content.slug ? `/${content.slug}` : plainText(content.description)}
      </p>
      <p className="text-xs text-muted-foreground md:hidden">
        {t(`visibilities.${content.visibility}`)}
      </p>
    </div>
  )
}

function Poster({ content }: { content: AdminContent }) {
  const source = mediaUrl(content)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    const target = viewportRef.current
    if (!target) return
    if (!("IntersectionObserver" in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      setVisible(true)
      observer.disconnect()
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={viewportRef}
      className="relative aspect-video w-16 overflow-hidden rounded-md bg-muted"
    >
      {source && visible ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={content.title || content.slug || content._id}
          loading="eager"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center text-muted-foreground">
          <FileVideo className="size-4" />
        </div>
      )}
      {source && visible && !loaded ? (
        <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted-foreground/10 to-muted" />
      ) : null}
    </div>
  )
}

function mediaUrl(content: AdminContent) {
  const value =
    content.thumbnailUrl ??
    content.metadata?.thumbnailUrl ??
    content.metadata?.posterUrl
  return typeof value === "string" ? value : ""
}

function plainText(value?: string) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === "published"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : status === "failed"
        ? "bg-destructive/10 text-destructive"
        : status === "scheduled"
          ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
          : "bg-muted text-muted-foreground"
  return (
    <span
      className={`inline-flex shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${tone}`}
    >
      {label}
    </span>
  )
}
