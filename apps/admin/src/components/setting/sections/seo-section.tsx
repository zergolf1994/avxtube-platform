"use client"

import * as React from "react"
import { Loader2, Save, Search } from "lucide-react"
import { useTranslations } from "next-intl"

import { localeLabels, locales, type Locale } from "@workspace/i18n/config"
import {
  seoSettingSchema,
  type SeoLocaleSetting,
  type SeoSettings,
} from "@workspace/core/validators"
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@workspace/ui/components"

const emptyLocale = (): SeoLocaleSetting => ({
  siteName: "AVXTUBE",
  title: "",
  description: "",
  keywords: [],
})

function normalize(data: SeoSettings): SeoSettings {
  return {
    locales: Object.fromEntries(
      locales.map((locale) => [locale, data.locales[locale] ?? emptyLocale()])
    ),
  }
}

export function SeoSection({ data }: { data: SeoSettings }) {
  const t = useTranslations("admin.settings")
  const initial = React.useMemo(() => normalize(data), [data])
  const [saved, setSaved] = React.useState(initial)
  const [values, setValues] = React.useState(initial)
  const [activeLocale, setActiveLocale] = React.useState<Locale>(locales[0])
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [error, setError] = React.useState("")
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)

  function update(
    locale: Locale,
    field: keyof SeoLocaleSetting,
    value: string | string[]
  ) {
    setValues((current) => ({
      ...current,
      locales: {
        ...current.locales,
        [locale]: {
          ...(current.locales[locale] ?? emptyLocale()),
          [field]: value,
        },
      },
    }))
    setMessage("")
    setError("")
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setError("")
    const parsed = seoSettingSchema.safeParse(values)
    if (!parsed.success) {
      const locale = parsed.error.issues[0]?.path[1]
      if (typeof locale === "string" && locales.includes(locale as Locale))
        setActiveLocale(locale as Locale)
      setError(t("invalidForm"))
      return
    }
    setPending(true)
    try {
      const response = await fetch("/api/v1/admin/settings/seo", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      if (!response.ok) throw new Error(t("saveFailed"))
      const body = (await response.json()) as { settings?: unknown }
      const result = normalize(seoSettingSchema.parse(body.settings))
      setSaved(result)
      setValues(result)
      setMessage(t("seo.saved"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("saveFailed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            {t("seo.fieldsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeLocale}
            onValueChange={(value) => setActiveLocale(value as Locale)}
          >
            <TabsList className="mb-5 flex h-auto w-full justify-start overflow-x-auto">
              {locales.map((locale) => (
                <TabsTrigger key={locale} value={locale}>
                  {localeLabels[locale]} ({locale})
                </TabsTrigger>
              ))}
            </TabsList>
            {locales.map((locale) => {
              const value = values.locales[locale] ?? emptyLocale()
              return (
                <TabsContent key={locale} value={locale} className="space-y-5">
                  <SeoInput
                    id={`${locale}-siteName`}
                    label={t("seo.siteName")}
                    value={value.siteName}
                    maxLength={100}
                    onChange={(next) => update(locale, "siteName", next)}
                  />
                  <SeoInput
                    id={`${locale}-title`}
                    label={t("seo.metaTitle")}
                    value={value.title}
                    maxLength={200}
                    onChange={(next) => update(locale, "title", next)}
                  />
                  <div className="space-y-2">
                    <div className="flex justify-between gap-3">
                      <Label htmlFor={`${locale}-description`}>
                        {t("seo.metaDescription")}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {value.description.length}/500
                      </span>
                    </div>
                    <Textarea
                      id={`${locale}-description`}
                      value={value.description}
                      maxLength={500}
                      rows={5}
                      onChange={(event) =>
                        update(locale, "description", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${locale}-keywords`}>
                      {t("seo.keywords")}
                    </Label>
                    <Textarea
                      id={`${locale}-keywords`}
                      value={value.keywords.join(", ")}
                      rows={3}
                      placeholder={t("seo.keywordsPlaceholder")}
                      onChange={(event) =>
                        update(
                          locale,
                          "keywords",
                          event.target.value
                            .split(/[\n,]/)
                            .map((item) => item.trim())
                            .filter(Boolean)
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("seo.keywordsHelp")}
                    </p>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {dirty ? t("unsaved") : t("noChanges")}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || pending}
              onClick={() => {
                setValues(saved)
                setError("")
                setMessage("")
              }}
            >
              {t("reset")}
            </Button>
            <Button type="submit" disabled={!dirty || pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              {t(pending ? "saving" : "save")}
            </Button>
          </div>
        </CardFooter>
      </Card>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {message}
        </p>
      ) : null}
    </form>
  )
}

function SeoInput({
  id,
  label,
  value,
  maxLength,
  onChange,
}: {
  id: string
  label: string
  value: string
  maxLength: number
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      </div>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
