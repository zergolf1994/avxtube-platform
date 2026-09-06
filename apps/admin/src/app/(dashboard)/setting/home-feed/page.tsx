import Link from "next/link"
import { ArrowLeft, LayoutList } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { buttonVariants } from "@workspace/ui/components"
import { HomeFeedSection } from "@/components/setting/sections/home-feed-section"
import { getHomeFeedSettings } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

export default async function HomeFeedSettingsPage() {
  const [data, t] = await Promise.all([
    getHomeFeedSettings(),
    getTranslations("admin.settings"),
  ])
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutList className="size-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("homeFeed.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("homeFeed.description")}
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
      <HomeFeedSection data={data.settings} categories={data.categories} />
    </div>
  )
}
