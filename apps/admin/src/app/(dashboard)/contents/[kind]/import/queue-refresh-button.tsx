"use client"

import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import * as React from "react"

import { Button } from "@workspace/ui/components"

export function QueueRefreshButton() {
  const t = useTranslations("admin.sitemapImport")
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      {t(pending ? "refreshingQueue" : "refreshQueue")}
    </Button>
  )
}
