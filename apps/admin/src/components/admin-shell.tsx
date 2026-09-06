"use client"

import * as React from "react"
import {
  Clapperboard,
  ChevronDown,
  Cpu,
  ExternalLink,
  FileText,
  HardDrive,
  Languages,
  LayoutDashboard,
  Moon,
  Plus,
  Radio,
  Sun,
  Settings,
  Tags,
  Users,
  Video,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"

import {
  localeCookieMaxAge,
  localeCookieName,
  type Locale,
} from "@workspace/i18n/config"
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@workspace/ui/components"

import { writeLocaleCookie } from "@/i18n/locale-cookie"

const navigation = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/contents/video", key: "video", icon: Video },
  { href: "/contents/short", key: "short", icon: Clapperboard },
  { href: "/contents/post", key: "post", icon: FileText },
  { href: "/contents/live", key: "live", icon: Radio },
] as const

type AdminUser = { name?: string; email?: string; role?: string }

export function AdminShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: AdminUser
}) {
  const t = useTranslations("admin")

  return (
    <SidebarProvider>
      <AdminSidebar user={user} />
      <SidebarInset className="min-w-0 bg-muted/25">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur-xl sm:px-6">
          <SidebarTrigger aria-label={t("menu")} />
          <Separator orientation="vertical" className="mx-1 h-5!" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {t("adminDashboard")}
          </p>
          <CreateContentButton />
          <LanguageButton />
          <ThemeButton />
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            className="hidden sm:inline-flex"
            render={
              <a
                href={
                  process.env.NEXT_PUBLIC_WEB_URL ??
                  process.env.NEXT_PUBLIC_URL?.replace("://admin.", "://") ??
                  "http://localhost:3000"
                }
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <ExternalLink />
            {t("openSite")}
          </Button>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function CreateContentButton() {
  const t = useTranslations("admin")
  const items = navigation.filter((item) => item.key !== "dashboard")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" size="sm" variant="outline" />}
      >
        <Plus />
        <span className="hidden sm:inline">{t("createMenu")}</span>
        <ChevronDown className="hidden size-3.5 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("createAction")}</DropdownMenuLabel>
          {items.map(({ key, icon: Icon }) => (
            <DropdownMenuItem
              key={key}
              render={<Link href={`/contents/${key}/new`} />}
            >
              <Icon />
              {t(`kindSingular.${key}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AdminSidebar({ user }: { user: AdminUser }) {
  const t = useTranslations("admin")
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const userLabel = user.name ?? user.email ?? "Admin"

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={t("adminDashboard")}
              render={<Link href="/" onClick={closeMobileSidebar} />}
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Video className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{t("brand")}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t("adminDashboard")}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("content")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(({ href, key, icon: Icon }) => {
                const active =
                  href === "/" ? pathname === "/" : pathname.startsWith(href)
                const label =
                  key === "dashboard" ? t("dashboard") : t(`kinds.${key}`)

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={label}
                      render={<Link href={href} onClick={closeMobileSidebar} />}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/entity")}
                  tooltip={t("entities.title")}
                  render={
                    <Link
                      href="/entity/category"
                      onClick={closeMobileSidebar}
                    />
                  }
                >
                  <Tags />
                  <span>{t("entities.title")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/channels")}
                  tooltip={t("channels.title")}
                  render={
                    <Link href="/channels" onClick={closeMobileSidebar} />
                  }
                >
                  <Users />
                  <span>{t("channels.title")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t("infrastructure")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/workers")}
                  tooltip={t("workers.title")}
                  render={<Link href="/workers" onClick={closeMobileSidebar} />}
                >
                  <Cpu />
                  <span>{t("workers.title")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/storage")}
                  tooltip={t("storage.title")}
                  render={<Link href="/storage" onClick={closeMobileSidebar} />}
                >
                  <HardDrive />
                  <span>{t("storage.title")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/setting")}
                  tooltip={t("settings.title")}
                  render={<Link href="/setting" onClick={closeMobileSidebar} />}
                >
                  <Settings />
                  <span>{t("settings.title")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={userLabel}>
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg font-semibold">
                  {initials(userLabel)}
                </AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{userLabel}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t("role", { role: user.role ?? "-" })}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function LanguageButton() {
  const t = useTranslations("admin")
  const locale = useLocale() as Locale
  const router = useRouter()
  const nextLocale: Locale = locale === "th" ? "en" : "th"

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t("language")}
      onClick={() => {
        writeLocaleCookie(localeCookieName, nextLocale, localeCookieMaxAge)
        router.refresh()
      }}
    >
      <Languages />
      <span className="hidden sm:inline">{nextLocale.toUpperCase()}</span>
    </Button>
  )
}

function ThemeButton() {
  const t = useTranslations("admin")
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    React.useCallback(() => true, []),
    React.useCallback(() => false, [])
  )
  const dark = mounted && resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("theme")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
