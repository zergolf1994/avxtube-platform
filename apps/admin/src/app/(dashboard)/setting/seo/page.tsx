import Link from "next/link"
import { ArrowLeft, Search } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "@workspace/ui/components"
import { SeoSection } from "@/components/setting/sections/seo-section"
import { getSeoSettings } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

export default async function SeoSettingsPage() {
  const [data, t] = await Promise.all([
    getSeoSettings(),
    getTranslations("admin.settings"),
  ])
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Search className="size-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("seo.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("seo.description")}
            </p>
          </div>
        </div>
        <Link
          href="/setting"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft />
          {t("back")}
        </Link>
      </div>
      <SeoSection data={data} />
    </div>
  )
}
