import { createHash, randomUUID } from "node:crypto"

import {
  CHANNEL_GENDERS,
  CHANNEL_KINDS,
  CHANNEL_ROLES,
} from "@workspace/core/types/channel"
import { ChannelModel } from "@workspace/db/models"
import { Router, type NextFunction, type Request, type Response } from "express"

import {
  authenticateUser,
  requireAdmin,
} from "../middlewares/user-access.middleware"
import {
  channelHandleBase,
  channelPositions,
} from "../services/content-relations.service"

const router: Router = Router()

router.use(authenticateUser, requireAdmin)

router.get(
  "/manage",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q.trim() : ""
      const kind = CHANNEL_KINDS.find((value) => value === req.query.kind)
      const status =
        req.query.status === "suspended" || req.query.status === "deleted"
          ? req.query.status
          : req.query.status === "all"
            ? null
            : "active"
      const page = positiveInteger(req.query.page, 1)
      const limit = Math.min(positiveInteger(req.query.limit, 50), 200)
      const filter: Record<string, unknown> = {
        ...(kind ? { kind } : {}),
        ...(status ? { status } : {}),
        ...(status && status !== "deleted" ? { deletedAt: null } : {}),
        ...(query ? { $text: { $search: query } } : {}),
      }
      const [items, total] = await Promise.all([
        ChannelModel.find(filter)
          .sort({ updatedAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ChannelModel.countDocuments(filter),
      ])
      res.status(200).json({
        items: items.map(toAdminChannel),
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

router.post(
  "/manage",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseChannelInput(req.body)
      await ensureUniqueHandle(input.handle)
      const channel = await ChannelModel.create({
        _id: randomUUID(),
        ...input,
        metadata: {
          roles: input.roles,
          ...(input.gender ? { gender: input.gender } : {}),
        },
        deletedAt: input.status === "deleted" ? new Date() : null,
      })
      res.status(201).json({ channel: toAdminChannel(channel.toObject()) })
    } catch (error) {
      next(error)
    }
  }
)

router.patch(
  "/manage/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const current = await ChannelModel.findById(req.params.id).lean()
      if (!current) {
        res.status(404).json({ error: "Channel not found" })
        return
      }
      const input = parseChannelInput(req.body)
      await ensureUniqueHandle(input.handle, current._id)
      const channel = await ChannelModel.findByIdAndUpdate(
        current._id,
        {
          $set: {
            kind: input.kind,
            layout: input.layout,
            name: input.name,
            handle: input.handle,
            description: input.description,
            avatarUrl: input.avatarUrl,
            bannerUrl: input.bannerUrl,
            status: input.status,
            "metadata.roles": input.roles,
            ...(input.gender ? { "metadata.gender": input.gender } : {}),
            deletedAt: input.status === "deleted" ? new Date() : null,
          },
          ...(!input.gender ? { $unset: { "metadata.gender": 1 } } : {}),
        },
        { new: true, runValidators: true }
      ).lean()
      res.status(200).json({ channel: toAdminChannel(channel!) })
    } catch (error) {
      next(error)
    }
  }
)

router.delete(
  "/manage/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const channel = await ChannelModel.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "deleted", deletedAt: new Date() } },
        { new: true }
      ).lean()
      if (!channel) {
        res.status(404).json({ error: "Channel not found" })
        return
      }
      res.status(200).json({ deleted: true })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/check",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRecord(req.body) || !Array.isArray(req.body.channels)) {
        throw badRequest("channels must be an array")
      }
      if (req.body.channels.length > 50)
        throw badRequest("channels must contain at most 50 items")
      const requested = uniqueRequests(
        req.body.channels.map(parseRequestedChannel)
      )
      const checked = await Promise.all(
        requested.map(async (item) => {
          const exactName = new RegExp(`^${escapeRegExp(item.name)}$`, "i")
          const entityKind = item.kind === "studio" ? "organization" : "person"
          const filter: Record<string, unknown> = {
            kind: { $in: [entityKind, item.kind] },
            name: exactName,
            deletedAt: null,
            ...(item.kind === "actress"
              ? { "metadata.gender": "female" }
              : item.kind === "actor"
                ? { "metadata.gender": "male" }
                : {}),
          }
          const channel = await ChannelModel.findOne(filter).lean()
          return channel
            ? { key: item.key, id: channel._id, name: channel.name }
            : null
        })
      )
      res.status(200).json({ channels: checked.filter(Boolean) })
    } catch (error) {
      next(error)
    }
  }
)

// Content editor search: kind here is a role, not Channel.kind.
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role =
      req.query.kind === "actress"
        ? "actress"
        : req.query.kind === "actor"
          ? "actor"
          : req.query.kind === "studio"
            ? "studio"
            : req.query.kind === "director"
              ? "director"
              : null
    if (!role)
      throw badRequest("kind must be actress, actor, director, or studio")
    const ids =
      typeof req.query.ids === "string"
        ? req.query.ids.split(",").filter(Boolean).slice(0, 100)
        : []
    const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
    if (!ids.length && q.length < 2) {
      res.json({ channels: [] })
      return
    }
    const filter: Record<string, unknown> = { deletedAt: null }
    if (ids.length) filter._id = { $in: ids }
    else {
      filter.$and = [
        {
          $or:
            role === "director"
              ? [{ "metadata.roles": "director" }]
              : [
                  {
                    "metadata.roles": role === "studio" ? "studio" : "actor",
                  },
                  { kind: role === "studio" ? "studio" : "actor" },
                ],
        },
        ...(role === "actress"
          ? [{ "metadata.gender": "female" }]
          : role === "actor"
            ? [{ "metadata.gender": "male" }]
            : []),
        {
          $or: [
            { name: new RegExp(escapeRegExp(q), "i") },
            { handle: new RegExp(escapeRegExp(q), "i") },
          ],
        },
      ]
    }
    const items = await ChannelModel.find(filter)
      .sort({ name: 1 })
      .limit(ids.length || 12)
      .lean()
    res.json({
      channels: items.map((item) => ({
        id: item._id,
        name: item.name,
        handle: item.handle,
        avatarUrl: item.avatarUrl ?? null,
        kind: item.kind,
        positions: channelPositions(item.kind, item.metadata),
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.post(
  "/resolve",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRecord(req.body) || !Array.isArray(req.body.channels)) {
        throw badRequest("channels must be an array")
      }

      const requested = req.body.channels.map(parseRequestedChannel)
      if (requested.length > 50)
        throw badRequest("channels must contain at most 50 items")
      const resolved = []

      for (const item of uniqueRequests(requested)) {
        const exactName = new RegExp(`^${escapeRegExp(item.name)}$`, "i")
        const entityKind = item.kind === "studio" ? "organization" : "person"
        const filter: Record<string, unknown> = {
          kind: { $in: [entityKind, item.kind] },
          name: exactName,
          deletedAt: null,
          ...(item.kind === "actress"
            ? { "metadata.gender": "female" }
            : item.kind === "actor"
              ? { "metadata.gender": "male" }
              : {}),
        }
        let channel = await ChannelModel.findOne(filter).lean()
        let created = false

        if (!channel) {
          const handle = await availableHandle(item.kind, item.name)
          const document = await ChannelModel.create({
            _id: randomUUID(),
            kind: entityKind,
            metadata: {
              roles: [
                item.kind === "studio"
                  ? "studio"
                  : item.kind === "director"
                    ? "director"
                    : "actor",
              ],
              ...(item.kind === "actress"
                ? { gender: "female" }
                : item.kind === "actor"
                  ? { gender: "male" }
                  : {}),
            },
            layout: item.kind === "studio" ? "banner" : "compact",
            handle,
            name: item.name,
          })
          channel = document.toObject()
          created = true
        } else {
          await ChannelModel.updateOne(
            { _id: channel._id },
            {
              $addToSet: {
                "metadata.roles":
                  item.kind === "studio"
                    ? "studio"
                    : item.kind === "director"
                      ? "director"
                      : "actor",
              },
            }
          )
        }

        resolved.push({ ...item, id: channel._id, name: channel.name, created })
      }

      res.status(200).json({ channels: resolved })
    } catch (error) {
      next(error)
    }
  }
)

type RequestedChannel = {
  key: string
  name: string
  kind: "actress" | "actor" | "director" | "studio"
}

function parseRequestedChannel(value: unknown): RequestedChannel {
  if (!isRecord(value)) throw badRequest("Each channel must be an object")
  const key = typeof value.key === "string" ? value.key.trim() : ""
  const name =
    typeof value.name === "string" ? value.name.trim().replace(/\s+/g, " ") : ""
  const kind = value.kind
  if (
    !key ||
    !name ||
    name.length > 100 ||
    !["actress", "actor", "director", "studio"].includes(String(kind))
  ) {
    throw badRequest(
      "Each channel requires key, name (1-100 characters), and actress, actor, director, or studio kind"
    )
  }
  return { key, name, kind: kind as RequestedChannel["kind"] }
}

function uniqueRequests(items: RequestedChannel[]) {
  return [
    ...new Map(
      items.map((item) => [
        `${item.kind}:${item.name.toLocaleLowerCase()}`,
        item,
      ])
    ).values(),
  ]
}

async function availableHandle(kind: RequestedChannel["kind"], name: string) {
  const ascii = channelHandleBase(name)
  const digest = createHash("sha1")
    .update(`${kind}:${name.trim().replace(/\s+/g, " ").toLocaleLowerCase()}`)
    .digest("hex")
    .slice(0, 10)
  const base = ascii || digest
  const exists = await ChannelModel.exists({ handle: base })
  return exists ? `${base.slice(0, 89)}-${digest}` : base
}

type ChannelInput = {
  kind: (typeof CHANNEL_KINDS)[number]
  layout: "banner" | "compact"
  name: string
  handle: string
  description: string
  avatarUrl: string | null
  bannerUrl: string | null
  status: "active" | "suspended" | "deleted"
  roles: (typeof CHANNEL_ROLES)[number][]
  gender?: (typeof CHANNEL_GENDERS)[number]
}

function parseChannelInput(value: unknown): ChannelInput {
  if (!isRecord(value)) throw badRequest("Request body must be an object")
  const kind = CHANNEL_KINDS.find((item) => item === value.kind)
  if (!kind) throw badRequest("A supported channel kind is required")
  const name = normalizedString(value.name, "name", 100)
  const handle = channelHandleBase(
    typeof value.handle === "string" && value.handle.trim()
      ? value.handle
      : name
  )
  if (!handle) throw badRequest("handle is invalid")
  const description =
    typeof value.description === "string"
      ? value.description.trim().slice(0, 5_000)
      : ""
  const avatarUrl = optionalHttpUrl(value.avatarUrl, "avatarUrl")
  const bannerUrl = optionalHttpUrl(value.bannerUrl, "bannerUrl")
  const status =
    value.status === "suspended" || value.status === "deleted"
      ? value.status
      : "active"
  const layout = value.layout === "compact" ? "compact" : "banner"
  const roles = Array.isArray(value.roles)
    ? [
        ...new Set(
          value.roles.filter((role): role is ChannelInput["roles"][number] =>
            CHANNEL_ROLES.includes(role as ChannelInput["roles"][number])
          )
        ),
      ]
    : []
  const gender = CHANNEL_GENDERS.find((item) => item === value.gender)
  return {
    kind,
    layout,
    name,
    handle,
    description,
    avatarUrl,
    bannerUrl,
    status,
    roles,
    ...(kind === "person" && gender ? { gender } : {}),
  }
}

function normalizedString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw badRequest(`${field} is required`)
  const normalized = value.trim().replace(/\s+/g, " ")
  if (!normalized || normalized.length > maxLength)
    throw badRequest(`${field} must contain 1-${maxLength} characters`)
  return normalized
}

function optionalHttpUrl(value: unknown, field: string) {
  if (value == null || value === "") return null
  if (typeof value !== "string") throw badRequest(`${field} must be a URL`)
  try {
    const url = new URL(value.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error()
    return url.toString()
  } catch {
    throw badRequest(`${field} must be an absolute HTTP(S) URL`)
  }
}

function positiveInteger(value: unknown, fallback: number) {
  const number = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

async function ensureUniqueHandle(handle: string, excludeId?: string) {
  const exists = await ChannelModel.exists({
    handle,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
  if (exists) throw badRequest("A channel with this handle already exists")
}

function toAdminChannel(channel: Record<string, unknown>) {
  const metadata = isRecord(channel.metadata) ? channel.metadata : {}
  const stats = isRecord(channel.stats) ? channel.stats : {}
  return {
    ...channel,
    roles: Array.isArray(metadata.roles) ? metadata.roles : [],
    gender: typeof metadata.gender === "string" ? metadata.gender : null,
    stats,
  }
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
