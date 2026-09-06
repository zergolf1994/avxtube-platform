import { FileQuestion, House } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { buttonVariants } from "@workspace/ui/components"

export default async function ViewerNotFound() {
  const t = await getTranslations("page.notFound")

  return (
    <main className="grid min-h-[60svh] place-items-center px-6 py-16 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="size-8" />
        </span>
        <p className="mt-6 text-sm font-bold tracking-[0.25em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
        <Link href="/" className={`${buttonVariants()} mt-6`}>
          <House className="size-4" />
          {t("backHome")}
        </Link>
      </div>
    </main>
  )
}
