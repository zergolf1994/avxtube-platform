import type { PublicTermTaxonomy, TermsResponse } from "@workspace/core/types"
import type { Locale } from "@workspace/i18n/config"
import { FolderOpen, Hash } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { PathPager } from "@/components/pagination/path-pager"

export async function TermDirectory({
  taxonomy,
  locale,
  page,
  pageSize,
  result,
}: {
  taxonomy: PublicTermTaxonomy
  locale: Locale
  page: number
  pageSize: number
  result: TermsResponse
}) {
  const t = await getTranslations({ locale, namespace: "video.taxonomy" })
  const Icon = taxonomy === "category" ? FolderOpen : Hash
  const path = `/${taxonomy}`
  const pageCount = Math.max(1, Math.ceil(result.total / pageSize))

  return (
    <div className="space-y-7 pb-10">
      <header className="relative isolate overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background px-5 py-7 sm:px-7 sm:py-9">
        <div className="absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Icon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {t(`${taxonomy}.title`)}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {t(`${taxonomy}.description`)}
            </p>
            <p className="mt-3 text-xs font-semibold text-primary">
              {t("termCount", { count: result.total })}
            </p>
          </div>
        </div>
      </header>

      {result.terms.length ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.terms.map((term) => (
            <Link
              key={term.id}
              href={`${path}/${term.slug}`}
              className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-bold">{term.name}</h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    /{term.slug}
                  </p>
                </div>
              </div>
              {term.description ? (
                <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {term.description}
                </p>
              ) : null}
            </Link>
          ))}
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed px-6 py-20 text-center text-sm text-muted-foreground">
          {t("emptyTerms")}
        </div>
      )}

      {pageCount > 1 ? (
        <div className="rounded-2xl border bg-card px-3 py-4 sm:px-5">
          <PathPager
            path={path}
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
          />
        </div>
      ) : null}
    </div>
  )
}
