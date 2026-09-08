/// <reference lib="es2022.intl" />
const segmenter = new Intl.Segmenter("en", { granularity: "word" })

export function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|quot);/g, " ")
}

export function searchWords(value: string) {
  return [...new Set([...segmenter.segment(normalizeSearch(value))]
    .filter((part) => part.isWordLike).map((part) => part.segment))]
}

// ASCII encodings preserve Thai/Japanese token boundaries in Mongo's text
// tokenizer; `none` disables English stemming and stop-word removal.
function token(word: string) { return `w${Buffer.from(word).toString("hex")}` }

export function searchableText(values: string[]) {
  return [...new Set(values.flatMap(searchWords))].map(token).join(" ")
}

export function codeText(values: string[]) {
  const tokens = new Set<string>()
  for (const value of values) {
    const code = normalizeSearch(value).replace(/\s+/g, "-")
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) continue
    const compact = code.replace(/-/g, "")
    for (let n = 3; n <= compact.length; n++) tokens.add(token(`code${compact.slice(0, n)}`))
    for (const digits of code.match(/\d+/g) ?? [])
      for (let n = 2; n <= digits.length; n++) tokens.add(token(`number${digits.slice(0, n)}`))
  }
  return [...tokens].join(" ")
}

export function searchQuery(value: string) {
  const normalized = normalizeSearch(value).trim()
  if (/^\d{2,}$/.test(normalized)) return token(`number${normalized}`)
  if (/^[a-z][a-z0-9]*(?:[-\s][a-z0-9]+)*[-\s]\d+[a-z0-9-]*$/.test(normalized))
    return token(`code${normalized.replace(/[-\s]/g, "")}`)
  return searchableText([normalized])
}

export function record(value: unknown): Record<string, any> {
  if (value instanceof Map) return Object.fromEntries(value)
  return value && typeof value === "object" ? value as Record<string, any> : {}
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  return Object.values(record(value)).flatMap(strings)
}

export function entityNames(entity: Record<string, any>) {
  const metadata = record(entity.metadata)
  return [entity.name, entity.handle, entity.slug, ...strings(entity.aliases),
    ...strings(entity.keywords), ...strings(metadata.aliases), ...strings(metadata.names),
    ...strings(metadata.stageName), ...Object.values(record(entity.translated)).flatMap((v) => {
      const translation = record(v)
      return [translation.name, translation.title, ...strings(translation.aliases)]
    })].filter((v): v is string => typeof v === "string" && !!v)
}

export function contentSearchDocument(source: Record<string, any>, entities: Record<string, any>[]) {
  const translations = Object.values(record(source.translated)).map(record)
  const metadata = record(source.metadata)
  return {
    _id: String(source._id), scope: "content", sourceId: String(source._id),
    kind: source.kind, status: source.status, visibility: source.visibility,
    deletedAt: source.deletedAt ?? null, createdAt: source.createdAt,
    updatedAt: source.updatedAt, stats: source.stats,
    metadata: { releaseDate: metadata.releaseDate }, mediaIds: source.mediaIds,
    titleText: searchableText([source.title, source.slug, ...translations.map((t) => t.title)].filter(Boolean)),
    descriptionText: searchableText([source.description, ...translations.map((t) => t.description)].filter(Boolean)),
    relationText: searchableText(entities.flatMap(entityNames)),
    codeText: codeText([source.slug, metadata.dvdId].filter(Boolean)),
    indexedAt: new Date(),
  }
}
