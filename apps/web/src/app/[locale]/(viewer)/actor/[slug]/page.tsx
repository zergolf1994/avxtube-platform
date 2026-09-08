import type { Locale } from "@workspace/i18n/config"
import { getChannel } from "@workspace/services/queries/video"
import { notFound } from "next/navigation"
import { cache } from "react"

import {
  ChannelContent,
  ChannelHeader,
  ChannelTabs,
} from "@/components/channel"
import {
  createPageMetadata,
  localizedPageUrl,
  serializeJsonLd,
} from "@/i18n/metadata"
import { parseChannelTab } from "@/lib/channel-tabs"
import { channelStructuredData } from "@/lib/structured-data"

type Props = {
  params: Promise<{ locale: Locale; slug: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}

export const dynamic = "force-dynamic"
const getActorPageData = cache((slug: string) => getChannel(slug))

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params
  const data = await getActorPageData(slug).catch(() => null)
  if (!isActor(data)) return {}
  return createPageMetadata({
    locale,
    pathname: `/actor/${slug.replace(/^@/, "")}`,
    title: data.channel.name,
    description: data.channel.description,
    image: data.channel.avatarUrl,
    openGraphType: "profile",
  })
}

export default async function ActorPage({ params, searchParams }: Props) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams])
  const data = await getActorPageData(slug).catch(() => null)
  if (!isActor(data)) notFound()
  const tabValue = Array.isArray(query.tab) ? query.tab[0] : query.tab
  const activeTab = parseChannelTab(
    tabValue,
    data.channel.enabledTabs,
    data.channel.defaultTab
  )
  const basePath = `/actor/${data.channel.handle.replace(/^@/, "")}`
  const pageUrl = localizedPageUrl(locale, basePath)

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(channelStructuredData(data.channel, pageUrl)),
        }}
      />
      <ChannelHeader channel={data.channel} locale={locale} />
      <ChannelTabs
        channel={data.channel}
        activeTab={activeTab}
        locale={locale}
        basePath={basePath}
      />
      <ChannelContent data={data} activeTab={activeTab} locale={locale} />
    </article>
  )
}

function isActor(
  data: Awaited<ReturnType<typeof getChannel>>
): data is NonNullable<Awaited<ReturnType<typeof getChannel>>> {
  return Boolean(
    data?.channel.kind === "person" &&
    data.channel.metadata?.roles?.includes("actor")
  )
}
