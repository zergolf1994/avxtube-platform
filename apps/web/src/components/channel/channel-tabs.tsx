import { getTranslations } from "next-intl/server"
import type { Channel } from "@workspace/core/types"

import { Link } from "@/i18n/navigation"
import type { ChannelTabId } from "@/lib/channel-tabs"

export async function ChannelTabs({
  channel,
  activeTab,
  locale,
  basePath = `/channel/${channel.handle}`,
}: {
  channel: Channel
  activeTab: ChannelTabId
  locale: string
  basePath?: string
}) {
  const t = await getTranslations({ locale, namespace: "video.channel.tabs" })

  return (
    <nav
      className="mt-7 flex gap-7 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={t("label")}
    >
      {channel.enabledTabs
        .filter((tab) => tab !== "live")
        .map((tab) => (
          <Link
            key={tab}
            href={
              tab === channel.defaultTab ? basePath : `${basePath}?tab=${tab}`
            }
            scroll={false}
            aria-current={activeTab === tab ? "page" : undefined}
            className={`shrink-0 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t(tab)}
          </Link>
        ))}
    </nav>
  )
}
