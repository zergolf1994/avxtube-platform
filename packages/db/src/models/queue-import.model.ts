import mongoose, { type InferSchemaType, type Model } from "mongoose"
import { v4 as uuidv4 } from "uuid"

const { Schema, model, models } = mongoose

export const IMPORT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const

const queueImportSchema = new Schema(
  {
    _id: { type: String, required: true, default: uuidv4 },
    status: {
      type: String,
      enum: IMPORT_STATUSES,
      required: true,
      default: "pending",
    },
    url: { type: String, required: true, unique: true },
    ref: { type: String, required: true, index: true },
    dvdId: { type: String, required: true, unique: true },
    workerId: { type: String },
    startedAt: { type: Date },
    failedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true, versionKey: false, collection: "queue_imports" }
)

// Admin queue pages sort newest-first, both across the complete queue and
// within a status. Include _id as a stable pagination tie-breaker.
queueImportSchema.index({ createdAt: -1, _id: -1 })
queueImportSchema.index({ status: 1, createdAt: -1, _id: -1 })
// Worker claims use status/createdAt; stale processing leases use startedAt.
queueImportSchema.index({ status: 1, startedAt: 1, createdAt: 1 })

export type QueueImportSchemaType = InferSchemaType<typeof queueImportSchema>

export const QueueImportModel: Model<QueueImportSchemaType> =
  (models?.QueueImport as Model<QueueImportSchemaType>) ||
  model<QueueImportSchemaType>("QueueImport", queueImportSchema)
