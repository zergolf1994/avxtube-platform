export const UserRole = {
  USER: "user",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
  DEVELOPER: "developer",
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const StorageProvider = {
  LOCAL: "local",
  S3: "s3",
} as const
export type StorageProvider =
  (typeof StorageProvider)[keyof typeof StorageProvider]

export const StorageStatus = {
  UNKNOWN: "unknown",
  ONLINE: "online",
  OFFLINE: "offline",
  ERROR: "error",
} as const
export type StorageStatus = (typeof StorageStatus)[keyof typeof StorageStatus]

export const StoragePurpose = {
  UPLOADS: "uploads",
  VIDEOS: "videos",
  IMAGES: "images",
  THUMBNAILS: "thumbnails",
  TEMPORARY: "temporary",
  BACKUPS: "backups",
} as const
export type StoragePurpose =
  (typeof StoragePurpose)[keyof typeof StoragePurpose]

export const AdsImageShowOn = {
  READY: "ready",
  END: "end",
  PAUSE: "pause",
} as const
export type AdsImageShowOn =
  (typeof AdsImageShowOn)[keyof typeof AdsImageShowOn]

export const WorkerType = {
  SCRAPER: "scraper",
  DOWNLOAD: "download",
  TRANSCODE: "transcode",
  TRANSFER: "transfer",
  SPRITESHEET: "spritesheet",
  PREWARM: "prewarm",
} as const
export type WorkerType = (typeof WorkerType)[keyof typeof WorkerType]

export const WorkerStatus = {
  IDLE: "idle",
  BUSY: "busy",
  PAUSED: "paused",
  OFFLINE: "offline",
} as const
export type WorkerStatus = (typeof WorkerStatus)[keyof typeof WorkerStatus]
