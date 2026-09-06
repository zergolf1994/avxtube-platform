"use client"

import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import * as React from "react"

import { Button } from "@workspace/ui/components"
import { useAutoReload } from "@/hooks/use-auto-reload"

const POLLING_STORAGE_KEY = "admin-workers-polling-ms"
const POLLING_OPTIONS = [0, 5_000, 10_000, 30_000] as const

export function WorkerRefreshButton() {
  const t = useTranslations("admin.workers")
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [intervalMs, setIntervalMs] = React.useState(10_000)
  const reload = React.useCallback(() => {
    if (!pending) startTransition(() => router.refresh())
  }, [pending, router])

  React.useEffect(() => {
    const saved = Number.parseInt(
      window.localStorage.getItem(POLLING_STORAGE_KEY) ?? "",
      10
    )
    if (POLLING_OPTIONS.includes(saved as (typeof POLLING_OPTIONS)[number]))
      setIntervalMs(saved)
  }, [])

  useAutoReload(reload, intervalMs)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
        <span className="text-muted-foreground">{t("autoReload")}</span>
        <select
          value={intervalMs}
          onChange={(event) => {
            const value = Number.parseInt(event.target.value, 10)
            setIntervalMs(value)
            window.localStorage.setItem(POLLING_STORAGE_KEY, String(value))
          }}
          className="bg-transparent font-medium outline-none"
          aria-label={t("autoReload")}
        >
          <option value={0}>{t("off")}</option>
          <option value={5_000}>{t("everySeconds", { count: 5 })}</option>
          <option value={10_000}>{t("everySeconds", { count: 10 })}</option>
          <option value={30_000}>{t("everySeconds", { count: 30 })}</option>
        </select>
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={reload}
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {t(pending ? "refreshing" : "refresh")}
      </Button>
    </div>
  )
}
