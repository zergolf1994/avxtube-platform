import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Globe,
  LayoutList,
  Megaphone,
  Search,
  Settings,
} from "lucide-react"
import { getTranslations } from "next-intl/server"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components"
import { SETTING_GROUPS } from "@/components/setting/sections/render-group"

export default async function SettingsPage() {
  const t = await getTranslations("admin.settings")
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Settings className="mt-1 size-7 shrink-0" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SETTING_GROUPS.map((group) => {
          const Icon =
            group.id === "adverts"
              ? Megaphone
              : group.id === "seo"
                ? Search
                : group.id === "homeFeed"
                  ? LayoutList
                  : group.id === "workerScraper"
                    ? Bot
                    : Globe
          return (
            <Link
              key={group.id}
              href={group.href}
              className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <Icon className="mb-2 size-6 text-primary" />
                  <CardTitle>{t(`${group.id}.title`)}</CardTitle>
                  <CardDescription>
                    {t(`${group.id}.description`)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {t("configure")}
                    <ArrowRight className="size-4" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
