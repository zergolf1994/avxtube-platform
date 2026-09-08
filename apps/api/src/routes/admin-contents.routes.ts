import {
  CONTENT_KINDS,
  CONTENT_STATUSES,
  CONTENT_VISIBILITIES,
  ContentModel,
  MediaModel,
} from "@workspace/db/models"
import { Router, type NextFunction, type Request, type Response } from "express"

import {
  authenticateUser,
  getRequestActor,
  requireAdmin,
} from "../middlewares/user-access.middleware"
import {
  prepareContentReferences,
  resolveContentRelations,
} from "../services/content-relations.service"
import { getDomainSettings } from "../services/settings/domain-setting.service"
import { invalidatePublicContentCountCache } from "../services/content-video.service"
import {
  countAdminContents,
  getAdminDashboardSummary,
  invalidateAdminContentCaches,
} from "../services/admin-content-performance.service"

const router: Router = Router()

type AdminContentListDocument = Record<string, unknown> & {
  mediaIds?: unknown[]
  slug?: string
}

router.use(authenticateUser, requireAdmin)

router.get(
  "/stats/hourly",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = bangkokDateInput(req.query.date)
      res.status(200).json((await getAdminDashboardSummary(date)).hourly)
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/stats/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = bangkokDateInput(req.query.date)
      res.setHeader("Cache-Control", "private, max-age=30")
      res.status(200).json(await getAdminDashboardSummary(date))
    } catch (error) {
      next(error)
    }
  }
)

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kind = optionalEnum(req.query.kind, CONTENT_KINDS)
    const status = optionalEnum(req.query.status, CONTENT_STATUSES)
    const query =
      typeof req.query.query === "string" ? req.query.query.trim() : ""
    const page = positiveInteger(req.query.page, 1)
    const limit = Math.min(positiveInteger(req.query.limit, 20), 100)
    const filter: Record<string, unknown> = { deletedAt: null }

    if (kind) filter.kind = kind
    if (status) filter.status = status
    if (query) {
      const slug = normalizeSlug(query)
      if (slug && /\d/.test(query) && /^[a-z0-9\s_-]+$/i.test(query)) {
        filter.slug = new RegExp(`^${escapeRegExp(slug)}`)
      } else {
        filter.$text = { $search: query }
      }
    }

    const [items, total, domainSettings] = await Promise.all([
      ContentModel.aggregate<AdminContentListDocument>([
        { $match: filter },
        { $sort: { updatedAt: -1, createdAt: -1, _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            kind: 1,
            status: 1,
            visibility: 1,
            title: 1,
            slug: 1,
            description: {
              $substrCP: [{ $ifNull: ["$description", ""] }, 0, 240],
            },
            mediaIds: 1,
            "metadata.thumbnailUrl": 1,
            "metadata.posterUrl": 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]).exec(),
      countAdminContents(
        JSON.stringify([kind ?? "all", status ?? "all", query]),
        filter
      ),
      getDomainSettings(),
    ])

    const mediaIds = [
      ...new Set(
        items.flatMap((item) =>
          Array.isArray(item.mediaIds) ? item.mediaIds.map(String) : []
        )
      ),
    ]
    const media = mediaIds.length
      ? await MediaModel.find({
          _id: { $in: mediaIds },
          kind: "image",
          purpose: { $in: ["poster", "thumbnail"] },
          deletedAt: null,
        })
          .select("_id purpose metadata.sprite")
          .lean()
      : []
    const mediaById = new Map(media.map((item) => [String(item._id), item]))
    const listItems = items.map((item) => {
      const orderedMedia = (item.mediaIds ?? []).flatMap((id) => {
        const value = mediaById.get(String(id))
        return value ? [value] : []
      })
      const poster =
        orderedMedia.find((value) => value.purpose === "poster") ??
        orderedMedia.find(
          (value) => value.purpose === "thumbnail" && !value.metadata?.sprite
        )
      const slug = typeof item.slug === "string" ? item.slug : ""
      return {
        ...item,
        ...(poster && slug && domainSettings.domain_static
          ? {
              thumbnailUrl: staticContentUrl(
                domainSettings.domain_static,
                slug,
                "poster.jpg"
              ),
            }
          : {}),
      }
    })

    res.status(200).json({
      items: listItems,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (error) {
    next(error)
  }
})

router.get(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const content = await ContentModel.findOne({
        _id: req.params.id,
        deletedAt: { $exists: false },
      }).lean()

      if (!content) {
        res.status(404).json({ error: "Content not found" })
        return
      }

      const { domain_static } = await getDomainSettings()
      const relations = await resolveContentRelations(content, {
        staticDomain: domain_static,
      })
      res.status(200).json({ content, relations })
    } catch (error) {
      next(error)
    }
  }
)

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = getRequestActor(res)
    const input = parseContentInput(req.body, false)
    const { domain_static } = await getDomainSettings()
    await prepareContentReferences(input, actor.id, {
      staticDomain: domain_static,
    })
    const content = await ContentModel.create({
      ...input,
      createdBy: actor.id,
    })
    await linkContentMedia(content._id, input.mediaIds)
    invalidatePublicContentCountCache()
    invalidateAdminContentCaches()

    res.status(201).json({ content: content.toObject() })
  } catch (error) {
    next(error)
  }
})

router.patch(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const actor = getRequestActor(res)
      const existingContent = await ContentModel.findOne({
        _id: req.params.id,
        deletedAt: { $exists: false },
      })
        .select("studioIds actressIds actorIds directorIds termIds mediaIds")
        .lean()
      if (!existingContent) {
        res.status(404).json({ error: "Content not found" })
        return
      }
      const input = parseContentInput(req.body, true)
      if ("metadata" in input) {
        if (!("studioIds" in input))
          input.studioIds = existingContent.studioIds ?? []
        if (!("actressIds" in input))
          input.actressIds = existingContent.actressIds ?? []
        if (!("actorIds" in input))
          input.actorIds = existingContent.actorIds ?? []
        if (!("directorIds" in input))
          input.directorIds = existingContent.directorIds ?? []
        if (!("termIds" in input)) input.termIds = existingContent.termIds ?? []
        if (!("mediaIds" in input))
          input.mediaIds = existingContent.mediaIds ?? []
      }
      const { domain_static } = await getDomainSettings()
      await prepareContentReferences(input, actor.id, {
        staticDomain: domain_static,
      })
      const content = await ContentModel.findOneAndUpdate(
        { _id: req.params.id, deletedAt: { $exists: false } },
        { $set: input },
        { new: true, runValidators: true }
      ).lean()

      if (!content) {
        res.status(404).json({ error: "Content not found" })
        return
      }

      await linkContentMedia(content._id, input.mediaIds)
      invalidatePublicContentCountCache()
      invalidateAdminContentCaches()

      res.status(200).json({ content })
    } catch (error) {
      next(error)
    }
  }
)

function parseContentInput(value: unknown, partial: boolean) {
  if (!isRecord(value)) throw badRequest("Request body must be an object")

  const result: Record<string, unknown> = {}
  const kind = requiredOrOptionalEnum(
    value.kind,
    CONTENT_KINDS,
    "kind",
    partial
  )
  const status = requiredOrOptionalEnum(
    value.status,
    CONTENT_STATUSES,
    "status",
    partial
  )
  const visibility = requiredOrOptionalEnum(
    value.visibility,
    CONTENT_VISIBILITIES,
    "visibility",
    partial
  )

  if (kind !== undefined) result.kind = kind
  if (status !== undefined) result.status = status
  if (visibility !== undefined) result.visibility = visibility

  assignOptionalString(result, value, "title", 1_000)
  assignOptionalString(result, value, "slug", 300)
  if (typeof result.slug === "string")
    result.slug = normalizeSlug(result.slug) || undefined
  assignOptionalString(result, value, "description", 20_000)
  if ("translated" in value)
    result.translated = parseTranslated(value.translated)
  assignStringArray(result, value, "studioIds")
  assignStringArray(result, value, "actressIds")
  assignStringArray(result, value, "actorIds")
  assignStringArray(result, value, "directorIds")
  assignStringArray(result, value, "mediaIds")
  assignStringArray(result, value, "termIds")

  if ("metadata" in value) {
    if (value.metadata !== null && !isRecord(value.metadata)) {
      throw badRequest("metadata must be an object or null")
    }
    result.metadata = value.metadata
  }

  if ("seo" in value) {
    if (value.seo === null) {
      result.seo = null
    } else if (isRecord(value.seo)) {
      const seo: Record<string, unknown> = {}
      assignOptionalString(seo, value.seo, "metaTitle", 300)
      assignOptionalString(seo, value.seo, "metaDescription", 160)
      assignStringArray(seo, value.seo, "keywords")
      result.seo = seo
    } else {
      throw badRequest("seo must be an object or null")
    }
  }

  return result
}

function parseTranslated(value: unknown) {
  if (value === null || value === undefined) return undefined
  if (!isRecord(value)) throw badRequest("translated must be an object")
  const translated: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value)) {
    const locale = key.trim().toLowerCase()
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(locale) || !isRecord(raw))
      throw badRequest("translated contains an invalid locale")
    const item: Record<string, unknown> = { locale }
    assignOptionalString(item, raw, "title", 1_000)
    assignOptionalString(item, raw, "description", 20_000)
    if (item.title !== undefined || item.description !== undefined)
      translated[locale] = item
  }
  return translated
}

async function linkContentMedia(contentId: string, value: unknown) {
  if (!Array.isArray(value) || !value.length) return
  // Do not steal media already associated with another content.
  await MediaModel.updateMany(
    { _id: { $in: value }, contentId: null, deletedAt: null },
    { $set: { contentId } }
  )
}

function requiredOrOptionalEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
  partial: boolean
): T[number] | undefined {
  if (value === undefined && partial) return undefined
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(", ")}`)
  }
  return value as T[number]
}

function optionalEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T
): T[number] | undefined {
  return typeof value === "string" && allowed.includes(value)
    ? (value as T[number])
    : undefined
}

function assignOptionalString(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string,
  maxLength: number
) {
  if (!(field in source)) return
  const value = source[field]
  if (value === null || value === "") {
    target[field] = undefined
    return
  }
  if (typeof value !== "string" || value.length > maxLength) {
    throw badRequest(`${field} must be a string up to ${maxLength} characters`)
  }
  target[field] = value.trim()
}

function assignStringArray(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string
) {
  if (!(field in source)) return
  const value = source[field]
  if (value === null) {
    target[field] = undefined
    return
  }
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw badRequest(`${field} must be an array of strings`)
  }
  target[field] = [...new Set(value.map((item) => item.trim()).filter(Boolean))]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown, fallback: number) {
  if (typeof value !== "string") return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function bangkokDateInput(value: unknown) {
  const fallback = bangkokDate()
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return fallback
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? fallback
    : value
}

function bangkokDate() {
  return new Date(Date.now() + 7 * 60 * 60 * 1_000).toISOString().slice(0, 10)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 300)
}

function staticContentUrl(domain: string, slug: string, file: string) {
  return domain && slug ? `//${domain}/${encodeURIComponent(slug)}/${file}` : ""
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { name: "ValidationError" })
}

export default router
