import { WorkerStatus, WorkerType } from "@workspace/core/enums"
import mongoose, { type InferSchemaType, type Model } from "mongoose"
import { v4 as uuidv4 } from "uuid"

const { Schema, model, models } = mongoose

const workerSystemInfoSchema = new Schema(
  {
    diskTotal: { type: Schema.Types.Mixed },
    diskUsed: { type: Schema.Types.Mixed },
    diskFree: { type: Schema.Types.Mixed },
    memTotal: { type: Schema.Types.Mixed },
    memUsed: { type: Schema.Types.Mixed },
    cpuPercent: { type: Number },
  },
  { _id: false }
)

const workerSchema = new Schema(
  {
    _id: { type: String, required: true, default: uuidv4 },
    workerId: { type: String, index: true },
    hostname: { type: String },
    ip: { type: String },
    pid: { type: Schema.Types.Mixed },
    version: { type: String, trim: true },
    storageId: { type: String, ref: "Storage" },
    enable: { type: Boolean, default: false },
    type: {
      type: String,
      enum: Object.values(WorkerType),
      default: WorkerType.DOWNLOAD,
    },
    status: {
      type: String,
      enum: Object.values(WorkerStatus),
      default: WorkerStatus.OFFLINE,
    },
    activeJobs: { type: Number, default: 0 },
    maxJobs: { type: Number, default: 1 },
    system: { type: workerSystemInfoSchema },
    heartbeatAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: "workers" }
)

workerSchema.index({ type: 1, enable: 1, heartbeatAt: -1 })

export type WorkerSchemaType = InferSchemaType<typeof workerSchema>

export const WorkerModel: Model<WorkerSchemaType> =
  (models?.Worker as Model<WorkerSchemaType>) ||
  model<WorkerSchemaType>("Worker", workerSchema)
