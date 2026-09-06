"use client"

import { FilePenLine, Upload } from "lucide-react"
import { useTranslations } from "next-intl"

import { PopoverContent } from "@workspace/ui/components"

const studioUrl = process.env.NEXT_PUBLIC_STUDIO_URL || "/studio"

export function ViewerCreateMenu({ onSelect }: { onSelect: () => void }) {
  const t = useTranslations("viewer.create")
  const items = [
    { key: "upload", icon: Upload },
    { key: "post", icon: FilePenLine },
  ] as const

  return (
    <PopoverContent
      align="end"
      sideOffset={10}
      className="w-52 gap-0 overflow-hidden rounded-xl p-2"
    >
      {items.map(({ key, icon: Icon }) => (
        <a
          key={key}
          href={studioUrl}
          target="_blank"
          rel="noreferrer"
          onClick={onSelect}
          className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm hover:bg-muted"
        >
          <Icon className="size-5" /> {t(key)}
        </a>
      ))}
    </PopoverContent>
  )
}
