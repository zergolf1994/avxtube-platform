import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/styles/globals.css"
import "@workspace/ui/styles/view-transition.css"
import "@workspace/ui/styles/flags.css"

import { ThemeProvider } from "@/components/theme-provider"
import { IntlProvider } from "@/components/i18n/intl-provider"
import { cn } from "@workspace/ui/lib/utils"
import { hasLocale } from "next-intl"
import { routing } from "@/i18n/routing"
import { notFound } from "next/navigation"
import { getMessages, setRequestLocale } from "next-intl/server"
import { defaultTimeZone, localeDirections, localeTags } from "@workspace/i18n"
import { Metadata } from "next"
import { selectClientMessages } from "@/i18n/client-messages"
import { siteUrl } from "@/i18n/metadata"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
}

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages({ locale })

  return (
    <html
      lang={localeTags[locale]}
      dir={localeDirections[locale]}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <ThemeProvider>
          <IntlProvider
            locale={locale}
            timeZone={defaultTimeZone}
            messages={selectClientMessages(messages)}
          >
            {children}
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
