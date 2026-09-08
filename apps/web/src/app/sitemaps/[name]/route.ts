import { getSitemapPage, getSitemapSummary } from "@/lib/sitemap-data"
import {
  dataPageSitemapXml,
  parseSitemapName,
  staticPagesSitemapXml,
} from "@/lib/sitemap-xml"

export const revalidate = 21_600

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const target = parseSitemapName(name)
  if (!target) return new Response("Sitemap not found", { status: 404 })

  try {
    if (target.kind === "pages") {
      const summary = await getSitemapSummary()
      const lastModified = [
        summary.videos.lastModified,
        summary.shorts.lastModified,
        summary.channels.lastModified,
      ]
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1)
      return xmlResponse(staticPagesSitemapXml(lastModified))
    }

    const page = await getSitemapPage(target.type, target.page)
    if (!page.items.length)
      return new Response("Sitemap not found", { status: 404 })
    return xmlResponse(dataPageSitemapXml(page))
  } catch (error) {
    console.error(`[Sitemap] Failed to build ${name}`, error)
    return new Response("Sitemap is temporarily unavailable", { status: 503 })
  }
}

function xmlResponse(body: string) {
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=21600",
      "cdn-cache-control":
        "public, max-age=21600, stale-while-revalidate=86400",
    },
  })
}
