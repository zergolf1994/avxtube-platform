import { createHash } from "node:crypto"

import { TermModel } from "@workspace/db/models"
import { Router, type NextFunction, type Request, type Response } from "express"

import {
  authenticateUser,
  getRequestActor,
  requireAdmin,
} from "../middlewares/user-access.middleware"
import { invalidatePublicVideoCategoriesCache } from "../services/content-video.service"

const router: Router = Router()
router.use(authenticateUser, requireAdmin)

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taxonomy = optionalTaxonomy(req.query.taxonomy)
    const status =
      req.query.status === "deleted"
        ? "deleted"
        : req.query.status === "all"
          ? null
          : "active"
    const query = typeof req.query.q === "string" ? req.query.q.trim() : ""
    const page = positiveInteger(req.query.page, 1)
    const limit = Math.min(positiveInteger(req.query.limit, 50), 200)
    const filter: Record<string, unknown> = {
      ...(taxonomy ? { taxonomy } : {}),
      ...(status ? { status } : {}),
      ...(query ? { $text: { $search: query } } : {}),
    }
    const [items, total] = await Promise.all([
      TermModel.find(filter)
        .sort({ name: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TermModel.countDocuments(filter),
    ])
    res.status(200).json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = getRequestActor(res)
    const input = parseTermInput(req.body)
    const slug = input.slug || (await availableSlug(input.taxonomy, input.name))
    await ensureUniqueSlug(input.taxonomy, slug)
    const term = await TermModel.create({
      ...input,
      slug,
      createdBy: actor.id,
      deletedAt: input.status === "deleted" ? new Date() : undefined,
    })
    if (input.taxonomy === "category") invalidatePublicVideoCategoriesCache()
    res.status(201).json({ term: term.toObject() })
  } catch (error) {
    next(error)
  }
})

router.post(
  "/check",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRecord(req.body) || !Array.isArray(req.body.terms))
        throw badRequest("terms must be an array")
      if (req.body.terms.length > 100)
        throw badRequest("terms must contain at most 100 items")
      const requested = uniqueRequests(req.body.terms.map(parseRequestedTerm))
      const checked = await Promise.all(
        requested.map(async (item) => {
          const exactName = new RegExp(`^${escapeRegExp(item.name)}$`, "i")
          const term = await TermModel.findOne({
            taxonomy: item.taxonomy,
            name: exactName,
            status: "active",
          }).lean()
          return term
            ? {
                key: item.key,
                id: term._id,
                name: term.name,
                slug: term.slug,
                taxonomy: term.taxonomy,
              }
            : null
        })
      )

      res.status(200).json({ terms: checked.filter(Boolean) })
    } catch (error) {
      next(error)
    }
  }
)

router.patch(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const current = await TermModel.findById(req.params.id).lean()
      if (!current) {
        res.status(404).json({ error: "Term not found" })
        return
      }
      const input = parseTermInput(req.body, current.taxonomy)
      const slug = input.slug || toSlug(input.name)
      if (!slug) throw badRequest("slug is required")
      await ensureUniqueSlug(current.taxonomy, slug, current._id)
      const term = await TermModel.findByIdAndUpdate(
        current._id,
        {
          $set: {
            name: input.name,
            slug,
            description: input.description,
            status: input.status,
            deletedAt: input.status === "deleted" ? new Date() : null,
          },
        },
        { new: true, runValidators: true }
      ).lean()
      if (current.taxonomy === "category")
        invalidatePublicVideoCategoriesCache()
      res.status(200).json({ term })
    } catch (error) {
      next(error)
    }
  }
)

router.delete(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const term = await TermModel.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "deleted", deletedAt: new Date() } },
        { new: true }
      ).lean()
      if (!term) {
        res.status(404).json({ error: "Term not found" })
        return
      }
      if (term.taxonomy === "category") invalidatePublicVideoCategoriesCache()
      res.status(200).json({ deleted: true })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/resolve",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRecord(req.body) || !Array.isArray(req.body.terms))
        throw badRequest("terms must be an array")
      if (req.body.terms.length > 100)
        throw badRequest("terms must contain at most 100 items")
      const requested = uniqueRequests(req.body.terms.map(parseRequestedTerm))
      const actor = getRequestActor(res)
      const resolved = []

      for (const item of requested) {
        const exactName = new RegExp(`^${escapeRegExp(item.name)}$`, "i")
        let term = await TermModel.findOne({
          taxonomy: item.taxonomy,
          name: exactName,
          status: "active",
        }).lean()
        let created = false
        if (!term) {
          const slug = await availableSlug(item.taxonomy, item.name)
          const document = await TermModel.create({
            taxonomy: item.taxonomy,
            name: item.name,
            slug,
            createdBy: actor.id,
          })
          term = document.toObject()
          created = true
          if (item.taxonomy === "category")
            invalidatePublicVideoCategoriesCache()
        }
        resolved.push({ ...item, id: term._id, name: term.name, created })
      }

      res.status(200).json({ terms: resolved })
    } catch (error) {
      next(error)
    }
  }
)

const termTaxonomies = ["category", "tag", "label", "series"] as const
type RequestedTerm = {
  key: string
  name: string
  taxonomy: (typeof termTaxonomies)[number]
}

function parseRequestedTerm(value: unknown): RequestedTerm {
  if (!isRecord(value)) throw badRequest("Each term must be an object")
  const key = typeof value.key === "string" ? value.key.trim() : ""
  const name =
    typeof value.name === "string" ? value.name.trim().replace(/\s+/g, " ") : ""
  const taxonomy = value.taxonomy
  if (
    !key ||
    !name ||
    name.length > 100 ||
    !termTaxonomies.includes(taxonomy as RequestedTerm["taxonomy"])
  )
    throw badRequest("Each term requires key, name, and a supported taxonomy")
  return { key, name, taxonomy: taxonomy as RequestedTerm["taxonomy"] }
}

function uniqueRequests(items: RequestedTerm[]) {
  return [
    ...new Map(
      items.map((item) => [
        `${item.taxonomy}:${item.name.toLocaleLowerCase()}`,
        item,
      ])
    ).values(),
  ]
}

async function availableSlug(
  taxonomy: RequestedTerm["taxonomy"],
  name: string
) {
  const normalized =
    toSlug(name) ||
    createHash("sha1")
      .update(name.toLocaleLowerCase())
      .digest("hex")
      .slice(0, 12)
  const exists = await TermModel.exists({ taxonomy, slug: normalized })
  if (!exists) return normalized
  const suffix = createHash("sha1")
    .update(`${taxonomy}:${name.toLocaleLowerCase()}`)
    .digest("hex")
    .slice(0, 8)
  return `${normalized.slice(0, 111)}-${suffix}`
}

type TermInput = {
  taxonomy: RequestedTerm["taxonomy"]
  name: string
  slug?: string
  description?: string
  status: "active" | "deleted"
}

function parseTermInput(
  value: unknown,
  fixedTaxonomy?: RequestedTerm["taxonomy"]
): TermInput {
  if (!isRecord(value)) throw badRequest("Request body must be an object")
  const taxonomy = fixedTaxonomy ?? optionalTaxonomy(value.taxonomy)
  if (!taxonomy) throw badRequest("A supported taxonomy is required")
  const name = normalizedString(value.name, "name", 100)
  const rawSlug =
    typeof value.slug === "string" ? value.slug.trim().toLowerCase() : ""
  const slug = rawSlug ? toSlug(rawSlug) : undefined
  if (rawSlug && !slug) throw badRequest("slug is invalid")
  const description =
    typeof value.description === "string"
      ? value.description.trim().slice(0, 2_000)
      : undefined
  const status = value.status === "deleted" ? "deleted" : "active"
  return { taxonomy, name, slug, description, status }
}

function optionalTaxonomy(value: unknown) {
  return termTaxonomies.find((taxonomy) => taxonomy === value)
}

function normalizedString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw badRequest(`${field} is required`)
  const normalized = value.trim().replace(/\s+/g, " ")
  if (!normalized || normalized.length > maxLength)
    throw badRequest(`${field} must contain 1-${maxLength} characters`)
  return normalized
}

function positiveInteger(value: unknown, fallback: number) {
  const number = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

async function ensureUniqueSlug(
  taxonomy: RequestedTerm["taxonomy"],
  slug: string,
  excludeId?: string
) {
  const exists = await TermModel.exists({
    taxonomy,
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
  if (exists) throw badRequest("A term with this slug already exists")
}

function toSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function badRequest(message: string) {
  return Object.assign(new Error(message), { name: "ValidationError" })
}

export default router
