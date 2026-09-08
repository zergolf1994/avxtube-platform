import type { PublicTermTaxonomy } from "@workspace/core/types"
import { TermModel, TERM_TAXONOMIES } from "@workspace/db/models"
import { Router, type NextFunction, type Request, type Response } from "express"
import {
  countPublicContents,
  getContentMappers,
  getPublicContentSummaries,
  normalizeContentLocale,
  publicVideoFilter,
  stringValue,
} from "../services/content-video.service"

const router: Router = Router()
const PUBLIC_TAXONOMIES = new Set<PublicTermTaxonomy>(["category", "tag"])

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taxonomy = optionalTaxonomy(req.query.taxonomy)
    const query = stringValue(req.query.q).slice(0, 100)
    const ids = stringValue(req.query.ids)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 100)
    const requestedLimit =
      Number.parseInt(
        stringValue(req.query.limit) ||
          (ids.length ? String(ids.length) : "30"),
        10
      ) || 30
    const limit = Math.max(1, Math.min(requestedLimit, ids.length ? 100 : 60))
    const offset = Math.max(
      0,
      Number.parseInt(stringValue(req.query.cursor), 10) || 0
    )
    const filter: Record<string, unknown> = {
      status: "active",
      deletedAt: null,
    }
    if (taxonomy) filter.taxonomy = taxonomy
    if (ids.length) filter._id = { $in: ids }
    if (query) filter.$text = { $search: query }

    const [terms, total] = await Promise.all([
      TermModel.find(filter)
        .sort({ name: 1, _id: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      TermModel.countDocuments(filter),
    ])
    res.setHeader(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300"
    )
    res.status(200).json({
      terms: terms.map(mapPublicTerm),
      total,
      nextCursor:
        offset + terms.length < total ? String(offset + terms.length) : null,
    })
  } catch (error) {
    next(error)
  }
})

router.get(
  "/:taxonomy/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const taxonomy = publicTaxonomy(req.params.taxonomy)
      if (!taxonomy) {
        res.status(404).json({ error: "Term not found" })
        return
      }
      const slug = stringValue(req.params.slug).toLocaleLowerCase("en")
      const term = await TermModel.findOne({
        taxonomy,
        slug,
        status: "active",
        deletedAt: null,
      }).lean()
      if (!term) {
        res.status(404).json({ error: "Term not found" })
        return
      }

      const limit = Math.min(
        48,
        Math.max(1, Number.parseInt(stringValue(req.query.limit), 10) || 24)
      )
      const offset = Math.max(
        0,
        Number.parseInt(stringValue(req.query.cursor), 10) || 0
      )
      const filter = { ...publicVideoFilter("video"), termIds: term._id }
      const locale = normalizeContentLocale(req.query.locale)
      const [rows, total, { mapVideoSummary }] = await Promise.all([
        getPublicContentSummaries(filter, limit, offset),
        countPublicContents(filter),
        getContentMappers(locale),
      ])
      res.setHeader(
        "Cache-Control",
        "public, max-age=30, stale-while-revalidate=300"
      )
      res.json({
        term: mapPublicTerm(term),
        videos: rows.map(mapVideoSummary),
        total,
        nextCursor:
          offset + rows.length < total ? String(offset + rows.length) : null,
      })
    } catch (error) {
      next(error)
    }
  }
)

function optionalTaxonomy(value: unknown) {
  const taxonomy = stringValue(value)
  return TERM_TAXONOMIES.find((item) => item === taxonomy)
}

function publicTaxonomy(value: unknown): PublicTermTaxonomy | undefined {
  const taxonomy = stringValue(value) as PublicTermTaxonomy
  return PUBLIC_TAXONOMIES.has(taxonomy) ? taxonomy : undefined
}

function mapPublicTerm(term: {
  _id: unknown
  name?: unknown
  slug?: unknown
  taxonomy?: unknown
  description?: unknown
}) {
  return {
    id: stringValue(term._id),
    name: stringValue(term.name),
    slug: stringValue(term.slug),
    taxonomy: stringValue(term.taxonomy),
    description: stringValue(term.description),
  }
}

export default router
