"use client"

import * as React from "react"
import { RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"

import { Button } from "@workspace/ui/components"

export function RetryAllQueueImportsButton() {
  const t = useTranslations("admin.sitemapImport")
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState("")

  async function retryAll() {
    if (pending || !window.confirm(t("retryAllConfirm"))) return
    setPending(true)
    setError("")
    try {
      const response = await fetch("/api/v1/admin/imports/queue/retry-failed", {
        method: "POST",
      })
      if (!response.ok) throw new Error(`Retry all failed (${response.status})`)
      router.refresh()
    } catch {
      setError(t("retryAllFailed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => void retryAll()}
      >
        <RotateCcw className={pending ? "size-4 animate-spin" : "size-4"} />
        {t(pending ? "retryingAll" : "retryAll")}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  )
}
