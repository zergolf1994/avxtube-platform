import { QueueImportModel } from "@workspace/db/models"
import { Router, type NextFunction, type Request, type Response } from "express"

import {
  authenticateUser,
  requireAdmin,
} from "../middlewares/user-access.middleware"
import {
  buildQueueImportFilter,
  importMissavSitemap,
} from "../services/sitemap-import.service"

const router: Router = Router()
const QUEUE_LIST_FIELDS =
  "_id status url dvdId ref workerId startedAt failedAt completedAt error createdAt updatedAt"
const QUEUE_COUNT_CACHE_MS = 10_000
const queueCountCache = new Map<
  string,
  { expiresAt: number; pending: Promise<number> }
>()

router.use(authenticateUser, requireAdmin)

router.get(
  "/queue",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestedStatus = String(req.query.status ?? "").trim()
      const status = QUEUE_IMPORT_STATUSES.find(
        (candidate) => candidate === requestedStatus
      )
      const query = String(req.query.q ?? "")
        .trim()
        .slice(0, 400)
      const filter = buildQueueImportFilter(status, query)
      const limit = Math.max(
        1,
        Math.min(
          Number.parseInt(String(req.query.limit ?? "50"), 10) || 50,
          200
        )
      )
      const page = Math.max(
        1,
        Number.parseInt(String(req.query.page ?? "1"), 10) || 1
      )
      const [items, total] = await Promise.all([
        QueueImportModel.find(filter)
          .select(QUEUE_LIST_FIELDS)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        countQueueImports(filter, status, query),
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
  }
)

const QUEUE_IMPORT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const

router.post(
  "/queue/:id/retry",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id.trim()
      if (!id || id.length > 100) throw invalid("Invalid queue import ID")

      const item = await QueueImportModel.findOneAndUpdate(
        { _id: id, status: "failed" },
        {
          $set: { status: "pending" },
          $unset: {
            workerId: 1,
            startedAt: 1,
            failedAt: 1,
            completedAt: 1,
            error: 1,
          },
        },
        { new: true, runValidators: true }
      )
        .select(QUEUE_LIST_FIELDS)
        .lean()

      if (!item) {
        const exists = await QueueImportModel.exists({ _id: id })
        res.status(exists ? 409 : 404).json({
          error: exists
            ? "Only failed imports can be returned to pending"
            : "Queue import not found",
        })
        return
      }

      queueCountCache.clear()
      res.status(200).json({ item })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/sitemap",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRecord(req.body) || typeof req.body.url !== "string")
        throw invalid("url is required")
      const summary = await importMissavSitemap(req.body.url.trim())
      if (summary.queued > 0) queueCountCache.clear()
      res.status(200).json({ summary })
    } catch (error) {
      next(error)
    }
  }
)

function countQueueImports(
  filter: Record<string, unknown>,
  status: (typeof QUEUE_IMPORT_STATUSES)[number] | undefined,
  query: string
) {
  if (query) return QueueImportModel.countDocuments(filter).exec()

  const key = status ?? "all"
  const cached = queueCountCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.pending

  const pending = QueueImportModel.countDocuments(filter)
    .exec()
    .catch((error) => {
      queueCountCache.delete(key)
      throw error
    })
  queueCountCache.set(key, {
    expiresAt: Date.now() + QUEUE_COUNT_CACHE_MS,
    pending,
  })
  return pending
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function invalid(message: string) {
  return Object.assign(new Error(message), { name: "ValidationError" })
}

export default router
