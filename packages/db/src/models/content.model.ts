import mongoose, { type InferSchemaType, type Model } from "mongoose"
import { v4 as uuidv4 } from "uuid"
import {
  CONTENT_KINDS,
  CONTENT_STATUSES,
  CONTENT_VISIBILITIES,
} from "@workspace/core/types/content"

const { Schema, model, models } = mongoose

export {
  CONTENT_KINDS,
  CONTENT_STATUSES,
  CONTENT_VISIBILITIES,
} from "@workspace/core/types/content"

const contentStatsSchema = new Schema(
  {
    viewCount: { type: Number, default: 0, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },
    dislikeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    shareCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
)

const contentSeoSchema = new Schema(
  {
    metaTitle: { type: String, trim: true, maxlength: 300 },
    metaDescription: { type: String, trim: true, maxlength: 160 },
    keywords: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      default: undefined,
    },
  },
  { _id: false }
)

const contentSchema = new Schema(
  {
    _id: { type: String, required: true, default: uuidv4 },
    kind: {
      type: String,
      required: true,
      enum: CONTENT_KINDS,
      default: "video",
    },
    status: {
      type: String,
      required: true,
      enum: CONTENT_STATUSES,
      default: "draft",
    },
    visibility: {
      type: String,
      required: true,
      enum: CONTENT_VISIBILITIES,
      default: "private",
    },
    title: { type: String, trim: true, maxlength: 1_000 },
    slug: { type: String, trim: true, lowercase: true, maxlength: 300 },
    description: { type: String, maxlength: 20_000 },
    studioIds: {
      type: [{ type: String, ref: "Channel" }],
      default: undefined,
    },
    termIds: {
      type: [{ type: String, ref: "Term" }],
      default: undefined,
    },
    actressIds: {
      type: [{ type: String, ref: "Channel" }],
      default: undefined,
    },
    actorIds: {
      type: [{ type: String, ref: "Channel" }],
      default: undefined,
    },
    directorIds: {
      type: [{ type: String, ref: "Channel" }],
      default: undefined,
    },
    // Media owns its URL, purpose and quality; content only stores references.
    mediaIds: {
      type: [{ type: String, ref: "Media" }],
      default: undefined,
    },
    translated: {
      type: Map,
      of: {
        locale: { type: String, trim: true, maxlength: 10 },
        title: { type: String, trim: true, maxlength: 1_000 },
        description: { type: String, maxlength: 20_000 },
      },
    },
    stats: { type: contentStatsSchema, default: () => ({}) },
    seo: { type: contentSeoSchema },
    metadata: { type: Map, of: Schema.Types.Mixed },
    deletedAt: { type: Date },
    createdBy: { type: String, ref: "User", required: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "contents",
  }
)

contentSchema.index({ studioIds: 1, kind: 1, status: 1 })
contentSchema.index({ actressIds: 1, kind: 1, status: 1 })
contentSchema.index({ actorIds: 1, kind: 1, status: 1 })
contentSchema.index({ directorIds: 1, kind: 1, status: 1 })
contentSchema.index({ visibility: 1, status: 1 })
contentSchema.index({ createdAt: -1 })
// Public feeds page before joining channel/media/term references.
contentSchema.index({
  kind: 1,
  status: 1,
  visibility: 1,
  deletedAt: 1,
  createdAt: -1,
  _id: -1,
})
contentSchema.index({
  kind: 1,
  status: 1,
  visibility: 1,
  deletedAt: 1,
  "metadata.releaseDate": -1,
  _id: -1,
})
contentSchema.index({
  kind: 1,
  status: 1,
  visibility: 1,
  deletedAt: 1,
  "stats.viewCount": -1,
  createdAt: -1,
  _id: -1,
})
contentSchema.index({
  termIds: 1,
  kind: 1,
  status: 1,
  visibility: 1,
  deletedAt: 1,
  "metadata.releaseDate": -1,
  _id: -1,
})
contentSchema.index({
  termIds: 1,
  kind: 1,
  status: 1,
  visibility: 1,
  deletedAt: 1,
  createdAt: -1,
  _id: -1,
})
contentSchema.index(
  { kind: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: "string" } } }
)

export type ContentSchemaType = InferSchemaType<typeof contentSchema>

export const ContentModel: Model<ContentSchemaType> =
  (models?.Content as Model<ContentSchemaType>) ||
  model<ContentSchemaType>("Content", contentSchema)
