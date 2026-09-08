"use client"

import { Power, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import * as React from "react"

import { Button } from "@workspace/ui/components"

export function WorkerActions({
  id,
  name,
  enabled,
  canDelete,
  onChanged,
}: {
  id: string
  name: string
  enabled: boolean
  canDelete: boolean
  onChanged?: () => void | Promise<void>
}) {
  const t = useTranslations("admin.workers")
  const [pending, setPending] = React.useState<"toggle" | "delete" | null>(null)
  const [error, setError] = React.useState("")

  async function request(method: "PATCH" | "DELETE") {
    if (pending) return
    if (method === "DELETE" && !window.confirm(t("deleteConfirm", { name })))
      return

    setPending(method === "PATCH" ? "toggle" : "delete")
    setError("")
    try {
      const response = await fetch(
        `/api/v1/admin/workers/${encodeURIComponent(id)}`,
        {
          method,
          headers:
            method === "PATCH"
              ? { "content-type": "application/json" }
              : undefined,
          body:
            method === "PATCH"
              ? JSON.stringify({ enable: !enabled })
              : undefined,
        }
      )
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(
          result?.error ?? `Worker request failed (${response.status})`
        )
      }
      await onChanged?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("actionFailed"))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex min-w-40 flex-col items-start gap-1.5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => void request("PATCH")}
        >
          <Power />
          {t(enabled ? "disable" : "enable")}
        </Button>
        {canDelete ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending !== null}
            onClick={() => void request("DELETE")}
          >
            <Trash2 />
            {t("delete")}
          </Button>
        ) : null}
      </div>
      {error ? (
        <span role="alert" className="max-w-64 text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  )
}
