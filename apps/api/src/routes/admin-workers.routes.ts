import { QueueImportModel, WorkerModel } from "@workspace/db/models"
import { Router, type NextFunction, type Request, type Response } from "express"

import {
  authenticateUser,
  requireAdmin,
} from "../middlewares/user-access.middleware"

const router: Router = Router()
const OFFLINE_DELETE_AFTER_MS = 5 * 60_000

router.use(authenticateUser, requireAdmin)

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [workers, processing] = await Promise.all([
      WorkerModel.find({}).sort({ type: 1, workerId: 1 }).lean(),
      QueueImportModel.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            status: "processing",
            workerId: { $type: "string", $ne: "" },
          },
        },
        { $group: { _id: "$workerId", count: { $sum: 1 } } },
      ]),
    ])
    const activeJobs = new Map(
      processing.map((item) => [item._id, item.count] as const)
    )

    res.status(200).json({
      now: new Date().toISOString(),
      workers: workers.map((worker) => ({
        ...worker,
        activeJobs: activeJobs.get(worker.workerId ?? "") ?? 0,
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.patch(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      if (!isRecord(req.body) || typeof req.body.enable !== "boolean") {
        throw invalid("enable must be a boolean")
      }
      const worker = await WorkerModel.findByIdAndUpdate(
        req.params.id,
        { $set: { enable: req.body.enable } },
        { new: true, runValidators: true }
      ).lean()
      if (!worker) {
        res.status(404).json({ error: "Worker not found" })
        return
      }
      res.status(200).json({ worker })
    } catch (error) {
      next(error)
    }
  }
)

router.delete(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const worker = await WorkerModel.findById(req.params.id).lean()
      if (!worker) {
        res.status(404).json({ error: "Worker not found" })
        return
      }
      const cutoff = new Date(Date.now() - OFFLINE_DELETE_AFTER_MS)
      const lastHeartbeat = worker.heartbeatAt ?? worker.createdAt
      if (!lastHeartbeat || new Date(lastHeartbeat) > cutoff) {
        res.status(409).json({
          error: "Worker must be offline for at least 5 minutes",
        })
        return
      }
      const hasActiveJobs = worker.workerId
        ? await QueueImportModel.exists({
            workerId: worker.workerId,
            status: "processing",
          })
        : null
      if (hasActiveJobs) {
        res.status(409).json({ error: "Worker still has active jobs" })
        return
      }

      const deleted = await WorkerModel.deleteOne({
        _id: worker._id,
        $or: [
          { heartbeatAt: { $lte: cutoff } },
          { heartbeatAt: { $exists: false }, createdAt: { $lte: cutoff } },
          { heartbeatAt: null, createdAt: { $lte: cutoff } },
        ],
      })
      if (!deleted.deletedCount) {
        res.status(409).json({
          error: "Worker heartbeat changed; refresh and try again",
        })
        return
      }
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  }
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function invalid(message: string) {
  return Object.assign(new Error(message), { name: "ValidationError" })
}

export default router
