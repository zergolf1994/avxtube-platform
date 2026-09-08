import { getSitemapSummary } from "@/lib/sitemap-data"
import { sitemapIndexXml } from "@/lib/sitemap-xml"

export const revalidate = 21_600

export async function GET() {
  try {
    const summary = await getSitemapSummary()
    return xmlResponse(sitemapIndexXml(summary))
  } catch (error) {
    console.error("[Sitemap] Failed to build sitemap index", error)
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
