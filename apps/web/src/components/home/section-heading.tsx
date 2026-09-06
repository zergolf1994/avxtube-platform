import { ChevronRight } from "lucide-react"
import { Link } from "@/i18n/navigation"

export function SectionHeading({
  title,
  href,
  actionLabel = "",
}: {
  title: string
  href?: string
  actionLabel?: string
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-2xl font-black tracking-[-0.035em]">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {actionLabel}
          <ChevronRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  )
}
