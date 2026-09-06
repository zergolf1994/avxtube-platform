"use client"

import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import * as React from "react"

import { Button } from "@workspace/ui/components"

export function RetryQueueImportButton({ id }: { id: string }) {
  const t = useTranslations("admin.sitemapImport")
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState("")

  async function retry() {
    if (pending) return
    setPending(true)
    setError("")
    try {
      const response = await fetch(
        `/api/v1/admin/imports/queue/${encodeURIComponent(id)}/retry`,
        { method: "POST" }
      )
      if (!response.ok) throw new Error(`Retry failed (${response.status})`)
      router.refresh()
    } catch {
      setError(t("retryFailed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => void retry()}
      >
        <RotateCcw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
        {t(pending ? "retrying" : "retry")}
      </Button>
      {error ? (
        <span role="alert" className="max-w-48 text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  )
}
