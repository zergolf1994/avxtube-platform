import { randomString } from "@workspace/core/utils"
import mongoose, { type InferSchemaType, type Model } from "mongoose"
import { v4 as uuidv4 } from "uuid"

const { Schema, model, models } = mongoose

export const MEDIA_KINDS = ["image", "video", "audio", "subtitle", "other"] as const
export const MEDIA_PROVIDERS = ["local", "s3", "remote"] as const
export const MEDIA_QUALITIES = ["original", "240", "360", "480", "640", "720", "1080"] as const
export type MediaQuality = (typeof MEDIA_QUALITIES)[number]
export const MEDIA_STATUSES = [
  "pending",
  "processing",
  "ready",
  "failed",
] as const
export const MEDIA_PURPOSES = [
  "poster",
  "thumbnail",
  "avatar",
  "trailer",
  "video",
  "short",
  "gallery",
] as const

const mediaMetadataSchema = new Schema(
    {
        size: { type: Schema.Types.Mixed, default: 0 },
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
        directUrl: { type: String },
        // Preserve the original remote asset when directUrl later points to storage.
        sourceUrl: { type: String, maxlength: 8_000 },
        // Remote source information, used when no storage has been assigned.
        sourceProvider: { type: String, trim: true, maxlength: 100 },
        sourcePageUrl: { type: String, trim: true, maxlength: 4_000 },
        referrerUrl: { type: String, trim: true, maxlength: 4_000 },
        hls: { type: Schema.Types.Mixed },
        sprite: { type: Schema.Types.Mixed },
        sourceIndex: { type: Number },
        sourceCodec: { type: String },
        codec: { type: String },
        language: { type: String },
        title: { type: String },
        isDefault: { type: Boolean },
        isForced: { type: Boolean },
        channels: { type: Number },
        sampleRate: { type: Number },
        bitrate: { type: Number },
        mediaLayout: { type: String, enum: ["muxed", "separated"] },
        // User-uploaded subtitles belong to one File only. Worker-generated
        // tracks remain shared across the clone group by default.
        clonePolicy: { type: String, enum: ["shared", "isolated"] },
    },
    {
        _id: false
    }
);

const mediaSchema = new Schema(
  {
    _id: { type: String, required: true, default: uuidv4 },
    contentId: { type: String, ref: "Content" },
    kind: { type: String, required: true, enum: MEDIA_KINDS },
    // A rendition label, not an image compression setting. Unknown stays absent.
    quality: { type: String, enum: MEDIA_QUALITIES },
    purpose: { type: String, enum: MEDIA_PURPOSES },
    provider: { type: String, required: true, enum: MEDIA_PROVIDERS },
    slug: { type: String, unique: true, default: () => randomString(11) },
    storageId: { type: String, ref: "Storage" },
    error: { type: String, maxlength: 2_000 },
    metadata: mediaMetadataSchema,
    deletedAt: { type: Date, default: undefined },
  },
  { timestamps: true, versionKey: false, collection: "medias" }
)

mediaSchema.index({ contentId: 1, purpose: 1, createdAt: -1 })
mediaSchema.index({ status: 1, provider: 1, createdAt: -1 })
mediaSchema.index({ storageId: 1, key: 1 })
mediaSchema.index({ externalId: 1, provider: 1 })
mediaSchema.index({ createdBy: 1, createdAt: -1 })
mediaSchema.index({ deletedAt: 1, createdAt: -1 })

export type MediaSchemaType = InferSchemaType<typeof mediaSchema>
export const MediaModel: Model<MediaSchemaType> =
  (models?.Media as Model<MediaSchemaType>) ||
  model<MediaSchemaType>("Media", mediaSchema)
