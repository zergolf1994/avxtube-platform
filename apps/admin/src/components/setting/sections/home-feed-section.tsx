"use client"

import * as React from "react"
import {
  ChevronDown,
  ChevronUp,
  Clapperboard,
  GripVertical,
  ListVideo,
  Loader2,
  Plus,
  Save,
  SquarePlay,
  Trash2,
} from "lucide-react"
import { useTranslations } from "next-intl"
import {
  homeFeedSettingSchema,
  type HomeFeedItem,
  type HomeFeedSettings,
  type HomeFeedType,
} from "@workspace/core/validators"
import { randomStringWithPrefix } from "@workspace/core/utils"
import {
  Button,
  Input,
  Label,
  SettingCard,
  SmartSelect,
} from "@workspace/ui/components"
import { cn } from "@workspace/ui/lib/utils"

const icons = {
  videos: Clapperboard,
  shorts: SquarePlay,
  playlists: ListVideo,
} satisfies Record<HomeFeedType, React.ElementType>

export function HomeFeedSection({
  data,
  categories,
}: {
  data: HomeFeedSettings
  categories: string[]
}) {
  const t = useTranslations("admin.settings")
  const [saved, setSaved] = React.useState(data)
  const [value, setValue] = React.useState(data)
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [error, setError] = React.useState("")
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)
  const touchRef = React.useRef(false)
  const listRef = React.useRef<HTMLDivElement>(null)
  const dirty = JSON.stringify(value) !== JSON.stringify(saved)

  function update(id: string, patch: Partial<HomeFeedItem>) {
    setValue((current) => ({
      feeds: current.feeds.map((feed) =>
        feed.id === id ? { ...feed, ...patch } : feed
      ),
    }))
    setMessage("")
    setError("")
  }

  function addFeed() {
    const id = randomStringWithPrefix("feed", 24)
    setValue((current) => ({
      feeds: [
        ...current.feeds,
        {
          id,
          enabled: true,
          type: "videos",
          title: "",
          categories: [],
          showViewAll: false,
          viewAllHref: "",
          sort: "latest",
          pageSize: 12,
          startPage: 1,
          loadMore: "button",
          maxPages: 3,
        },
      ],
    }))
    setExpanded(id)
  }

  function removeFeed(feed: HomeFeedItem) {
    if (
      !window.confirm(
        t("homeFeed.deleteConfirm", {
          name: feed.title || t(`homeFeed.types.${feed.type}`),
        })
      )
    )
      return
    setValue((current) => ({
      feeds: current.feeds.filter((item) => item.id !== feed.id),
    }))
    if (expanded === feed.id) setExpanded(null)
  }

  function clearDrag() {
    touchRef.current = false
    setDragIndex(null)
    setOverIndex(null)
  }
  function finishDrag() {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex)
      setValue((current) => {
        const feeds = [...current.feeds]
        const [moved] = feeds.splice(dragIndex, 1)
        if (moved) feeds.splice(overIndex, 0, moved)
        return { feeds }
      })
    clearDrag()
  }
  function touchMove(event: React.TouchEvent) {
    if (!touchRef.current || !listRef.current) return
    const touch = event.touches[0]
    if (!touch) return
    for (const row of listRef.current.querySelectorAll<HTMLElement>(
      "[data-feed-index]"
    )) {
      const rect = row.getBoundingClientRect()
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        setOverIndex(Number(row.dataset.feedIndex))
        break
      }
    }
  }

  async function save() {
    const parsed = homeFeedSettingSchema.safeParse(value)
    if (!parsed.success) {
      setError(t("invalidForm"))
      return
    }
    setPending(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/v1/admin/settings/home-feed", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      if (!response.ok) throw new Error(t("saveFailed"))
      const body = (await response.json()) as { settings?: unknown }
      const result = homeFeedSettingSchema.parse(body.settings)
      setSaved(result)
      setValue(result)
      setMessage(t("homeFeed.saved"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("saveFailed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative space-y-4 pb-24">
      <SettingCard
        title={t("homeFeed.orderTitle")}
        description={t("homeFeed.orderHelp")}
        className="relative overflow-hidden p-0"
        headerClassName="border-b border-border bg-muted/30 p-5"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <p className="hidden text-xs text-muted-foreground sm:block">
              {t("homeFeed.summary", {
                total: value.feeds.length,
                active: value.feeds.filter((feed) => feed.enabled).length,
              })}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 text-xs"
              onClick={addFeed}
              disabled={pending || value.feeds.length >= 50}
            >
              <Plus className="size-3.5" />
              {t("homeFeed.add")}
            </Button>
          </div>
        }
      >
        <div className="p-5">
          {!value.feeds.length ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12">
              <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <ListVideo className="size-6 opacity-60" />
              </span>
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                {t("homeFeed.empty")}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 gap-2"
                onClick={addFeed}
              >
                <Plus className="size-3.5" />
                {t("homeFeed.add")}
              </Button>
            </div>
          ) : (
            <div ref={listRef} className="space-y-2">
              {value.feeds.map((feed, index) => {
                const Icon = icons[feed.type]
                const open = expanded === feed.id
                const feedName = feed.title || t(`homeFeed.types.${feed.type}`)
                return (
                  <div
                    key={feed.id}
                    data-feed-index={index}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setOverIndex(index)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      finishDrag()
                    }}
                    className={cn(
                      "overflow-hidden rounded-lg border border-border bg-background transition-all",
                      dragIndex === index && "opacity-50",
                      overIndex === index &&
                        dragIndex !== index &&
                        "border-primary ring-1 ring-primary/30"
                    )}
                  >
                    <div
                      draggable={!pending}
                      className="flex cursor-pointer touch-none items-center gap-2.5 px-3 py-2.5 transition-colors select-none hover:bg-accent/50"
                      aria-label={t("homeFeed.drag", { name: feedName })}
                      onClick={() => setExpanded(open ? null : feed.id)}
                      onDragStart={(event) => {
                        setDragIndex(index)
                        setOverIndex(index)
                        event.dataTransfer.effectAllowed = "move"
                      }}
                      onDragEnd={clearDrag}
                      onTouchStart={() => {
                        touchRef.current = true
                        setDragIndex(index)
                        setOverIndex(index)
                      }}
                      onTouchMove={touchMove}
                      onTouchEnd={finishDrag}
                      onTouchCancel={clearDrag}
                    >
                      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/30 transition-colors hover:text-foreground active:cursor-grabbing" />
                      <span className="w-4 shrink-0 text-center font-mono text-[10px] font-bold text-muted-foreground/50">
                        {index + 1}
                      </span>
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-md border transition-colors",
                          feed.enabled
                            ? "border-transparent bg-primary/10 text-primary"
                            : "border-border bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {feedName}
                          </span>
                          <StatusDot active={feed.enabled} />
                        </div>
                        <span className="block truncate text-[10px] text-muted-foreground sm:hidden">
                          {categorySummary(
                            feed.categories,
                            t("homeFeed.allCategories")
                          )}
                        </span>
                      </div>
                      <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                        {categorySummary(
                          feed.categories,
                          t("homeFeed.allCategories")
                        )}
                      </span>
                      <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
                        {t(`homeFeed.loadModes.${feed.loadMore}`)}
                      </span>
                      {feed.showViewAll ? (
                        <span className="hidden shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary lg:inline">
                          {t("homeFeed.viewAll")}
                        </span>
                      ) : null}
                      <Switch
                        checked={feed.enabled}
                        onChange={(enabled) => update(feed.id, { enabled })}
                        disabled={pending}
                      />
                      <button
                        type="button"
                        className="hover:text-destructive-foreground shrink-0 rounded p-1 text-muted-foreground/40 transition-colors hover:bg-destructive"
                        aria-label={t("homeFeed.delete")}
                        onClick={(event) => {
                          event.stopPropagation()
                          removeFeed(feed)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                      <span className="shrink-0 text-muted-foreground/40">
                        {open ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </span>
                    </div>
                    {open ? (
                      <div className="grid gap-5 border-t border-border/60 bg-muted/10 px-4 pt-4 pb-4 md:grid-cols-2">
                        <Field label={t("homeFeed.feedTitle")}>
                          <Input
                            value={feed.title}
                            maxLength={120}
                            placeholder={t("homeFeed.feedTitlePlaceholder")}
                            onChange={(event) =>
                              update(feed.id, { title: event.target.value })
                            }
                          />
                        </Field>
                        <Field label={t("homeFeed.feedType")}>
                          <Select
                            value={feed.type}
                            onChange={(type) =>
                              update(feed.id, {
                                type: type as HomeFeedType,
                                categories:
                                  type === "playlists" ? [] : feed.categories,
                              })
                            }
                          >
                            <option value="videos">
                              {t("homeFeed.types.videos")}
                            </option>
                            <option value="shorts">
                              {t("homeFeed.types.shorts")}
                            </option>
                            <option value="playlists">
                              {t("homeFeed.types.playlists")}
                            </option>
                          </Select>
                        </Field>
                        <Field label={t("homeFeed.category")}>
                          <SmartSelect
                            multiple
                            multiSelectMode="expandable"
                            maxExpandedCount={2}
                            value={feed.categories}
                            disabled={feed.type === "playlists"}
                            options={categories.map((category) => ({
                              value: category,
                              label: category,
                            }))}
                            placeholder={t("homeFeed.allCategories")}
                            searchPlaceholder={t("homeFeed.searchCategories")}
                            emptyText={t("homeFeed.noCategories")}
                            optionsSelectedText={t(
                              "homeFeed.categoriesSelected"
                            )}
                            showLessText={t("homeFeed.showLess")}
                            onValueChange={(selected) =>
                              update(feed.id, {
                                categories: Array.isArray(selected)
                                  ? selected
                                  : [],
                              })
                            }
                          />
                        </Field>
                        <Field label={t("homeFeed.sort")}>
                          <Select
                            value={feed.sort}
                            disabled={feed.type === "playlists"}
                            onChange={(sort) =>
                              update(feed.id, {
                                sort: sort as HomeFeedItem["sort"],
                              })
                            }
                          >
                            <option value="latest">
                              {t("homeFeed.sorts.latest")}
                            </option>
                            <option value="releaseDate">
                              {t("homeFeed.sorts.releaseDate")}
                            </option>
                            <option value="trending">
                              {t("homeFeed.sorts.trending")}
                            </option>
                          </Select>
                        </Field>
                        <Field label={t("homeFeed.viewAllButton")}>
                          <div className="flex min-h-9 items-center justify-between rounded-md border bg-background px-3">
                            <span className="text-sm text-muted-foreground">
                              {feed.showViewAll
                                ? t("homeFeed.viewAllEnabled")
                                : t("homeFeed.viewAllDisabled")}
                            </span>
                            <Switch
                              checked={feed.showViewAll}
                              onChange={(showViewAll) =>
                                update(feed.id, { showViewAll })
                              }
                              disabled={pending}
                            />
                          </div>
                        </Field>
                        <Field label={t("homeFeed.viewAllHref")}>
                          <Input
                            value={feed.viewAllHref}
                            maxLength={500}
                            disabled={!feed.showViewAll}
                            placeholder={t("homeFeed.viewAllHrefPlaceholder")}
                            onChange={(event) =>
                              update(feed.id, {
                                viewAllHref: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label={t("homeFeed.pageSize")}>
                          <Input
                            type="number"
                            min={1}
                            max={48}
                            value={feed.pageSize}
                            onChange={(event) =>
                              update(feed.id, {
                                pageSize: Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label={t("homeFeed.startPage")}>
                          <Input
                            type="number"
                            min={1}
                            max={100000}
                            value={feed.startPage}
                            onChange={(event) =>
                              update(feed.id, {
                                startPage: Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label={t("homeFeed.loadMore")}>
                          <Select
                            value={feed.loadMore}
                            onChange={(loadMore) =>
                              update(feed.id, {
                                loadMore: loadMore as HomeFeedItem["loadMore"],
                                ...(loadMore === "none" ? { maxPages: 1 } : {}),
                              })
                            }
                          >
                            <option value="none">
                              {t("homeFeed.loadModes.none")}
                            </option>
                            <option value="button">
                              {t("homeFeed.loadModes.button")}
                            </option>
                            <option value="auto">
                              {t("homeFeed.loadModes.auto")}
                            </option>
                          </Select>
                        </Field>
                        <Field label={t("homeFeed.maxPages")}>
                          <div className="flex items-center gap-3">
                            <Input
                              type="number"
                              min={1}
                              max={10000}
                              disabled={
                                feed.loadMore === "none" ||
                                feed.maxPages === null
                              }
                              value={feed.maxPages ?? ""}
                              onChange={(event) =>
                                update(feed.id, {
                                  maxPages: Number(event.target.value),
                                })
                              }
                            />
                            <label className="flex shrink-0 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                disabled={feed.loadMore === "none"}
                                checked={feed.maxPages === null}
                                onChange={(event) =>
                                  update(feed.id, {
                                    maxPages: event.target.checked ? null : 3,
                                  })
                                }
                              />
                              {t("homeFeed.unlimited")}
                            </label>
                          </div>
                        </Field>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SettingCard>
      <div
        className={cn(
          "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition",
          dirty ? "opacity-100" : "pointer-events-none translate-y-8 opacity-0"
        )}
      >
        <div className="flex min-w-[min(420px,calc(100vw-2rem))] items-center justify-between gap-5 rounded-full border bg-background/90 px-5 py-3 shadow-xl backdrop-blur">
          <span className="text-sm font-medium">{t("unsaved")}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setValue(saved)
                setError("")
                setMessage("")
              }}
            >
              {t("reset")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => void save()}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              {t(pending ? "saving" : "save")}
            </Button>
          </div>
        </div>
      </div>
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
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {children}
    </select>
  )
}
function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        "relative inline-flex h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "mt-0.5 size-5 rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        active ? "bg-emerald-500" : "bg-muted-foreground/30"
      )}
    />
  )
}

function categorySummary(categories: string[], allLabel: string) {
  if (!categories.length) return allLabel
  if (categories.length <= 2) return categories.join(", ")
  return `${categories.slice(0, 2).join(", ")} +${categories.length - 2}`
}
