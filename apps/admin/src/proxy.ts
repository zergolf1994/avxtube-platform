import { NextRequest, NextResponse } from "next/server"

import {
  defaultLocale,
  localeCookieMaxAge,
  localeCookieName,
  normalizeLocale,
} from "@workspace/i18n/config"

import { localeCookieDomain } from "@/i18n/locale-cookie"

export function proxy(req: NextRequest) {
  // Authentication is enforced once by the protected dashboard layout. Doing
  // the same remote session lookup here doubled auth traffic on every page.
  return withLocaleCookie(req, NextResponse.next())
}

function withLocaleCookie(req: NextRequest, response: NextResponse) {
  if (req.cookies.has(localeCookieName)) return response

  const locale =
    normalizeLocale(req.headers.get("accept-language")) ?? defaultLocale
  response.cookies.set(localeCookieName, locale, {
    ...(localeCookieDomain ? { domain: localeCookieDomain } : {}),
    path: "/",
    maxAge: localeCookieMaxAge,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return response
}

export const config = {
  matcher: [
    "/((?!api|assets|_next|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|opengraph-image|twitter-image|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)",
  ],
}
