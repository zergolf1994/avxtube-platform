import mongoose, { type InferSchemaType, type Model } from "mongoose"
import { v4 as uuidv4 } from "uuid"

const { Schema, model, models } = mongoose

export const TERM_TAXONOMIES = ["category", "tag", "label", "series"] as const

const termSchema = new Schema(
  {
    _id: { type: String, required: true, default: uuidv4 },
    taxonomy: { type: String, required: true, enum: TERM_TAXONOMIES },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    description: { type: String, maxlength: 2_000 },
    status: { type: String, enum: ["active", "deleted"], default: "active" },
    createdBy: { type: String, ref: "User", required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: "terms" }
)

termSchema.index({ taxonomy: 1, slug: 1 }, { unique: true })
termSchema.index({ taxonomy: 1, status: 1, name: 1, _id: 1 })
termSchema.index({ taxonomy: 1, name: 1, _id: 1 })
termSchema.index({ name: "text", slug: "text" })

export type TermSchemaType = InferSchemaType<typeof termSchema>

export const TermModel: Model<TermSchemaType> =
  (models?.Term as Model<TermSchemaType>) ||
  model<TermSchemaType>("Term", termSchema)
