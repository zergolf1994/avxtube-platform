import type { FollowingProfile, Video } from "@workspace/core/types"
import {
  ChannelModel,
  ContentModel,
  SubscriptionModel,
} from "@workspace/db/models"
import type { PipelineStage } from "mongoose"
import {
  getContentMappers,
  getPublicContentSummaries,
  isRecord,
  publicVideoFilter,
  contentChannelFilter,
  stringArray,
  stringValue,
} from "./content-video.service"

type FollowingPage = {
  items: FollowingProfile[]
  nextCursor: string | null
  total: number
}

export async function getUserFollowingFeed(
  userId: string,
  limit = 20
): Promise<{ items: Video[]; nextCursor: null; total: number }> {
  const channelIds = await SubscriptionModel.distinct("channelId", { userId })
  if (!channelIds.length) return { items: [], nextCursor: null, total: 0 }
  const filter = {
    ...publicVideoFilter(),
    ...contentChannelFilter(channelIds),
  }
  const [contents, total, { mapVideoSummary }] = await Promise.all([
    getPublicContentSummaries(filter, Math.min(Math.max(limit, 1), 20)),
    ContentModel.countDocuments(filter),
    getContentMappers(),
  ])
  return {
    items: contents.map(mapVideoSummary),
    nextCursor: null,
    total,
  }
}

export async function getUserFollowingProfiles(
  userId: string,
  cursor: number,
  limit: number
): Promise<FollowingPage> {
  const pipeline: PipelineStage[] = [
    { $match: { userId } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $lookup: {
        from: ChannelModel.collection.name,
        localField: "channelId",
        foreignField: "_id",
        as: "channel",
      },
    },
    { $unwind: "$channel" },
    { $match: { "channel.status": "active", "channel.deletedAt": null } },
    {
      $facet: {
        count: [{ $count: "total" }],
        items: [
          { $skip: cursor },
          { $limit: limit },
          {
            $lookup: {
              from: ContentModel.collection.name,
              let: { channelId: "$channelId" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        {
                          $in: ["$$channelId", { $ifNull: ["$studioIds", []] }],
                        },
                        {
                          $in: [
                            "$$channelId",
                            { $ifNull: ["$actressIds", []] },
                          ],
                        },
                        {
                          $in: ["$$channelId", { $ifNull: ["$actorIds", []] }],
                        },
                        {
                          $in: [
                            "$$channelId",
                            { $ifNull: ["$directorIds", []] },
                          ],
                        },
                        {
                          $in: [
                            "$$channelId",
                            { $ifNull: ["$channelIds", []] },
                          ],
                        },
                      ],
                    },
                    kind: "live",
                    status: "published",
                    visibility: "public",
                    moderationStatus: "active",
                    deletedAt: null,
                  },
                },
                { $limit: 1 },
                { $project: { _id: 1 } },
              ],
              as: "liveContent",
            },
          },
        ],
      },
    },
  ]
  const [page] = await SubscriptionModel.aggregate<{
    count: Array<{ total: number }>
    items: Record<string, unknown>[]
  }>(pipeline).exec()
  const total = page?.count[0]?.total ?? 0
  const rows = page?.items ?? []
  return {
    items: rows.map(mapFollowingProfile),
    nextCursor:
      cursor + rows.length < total ? String(cursor + rows.length) : null,
    total,
  }
}

export function mapFollowingProfile(
  row: Record<string, unknown>
): FollowingProfile {
  const channel = isRecord(row.channel) ? row.channel : {}
  const metadata = isRecord(channel.metadata) ? channel.metadata : {}
  const name = stringValue(channel.name)
  const kind = stringValue(channel.kind)
  const roles = stringArray(metadata.roles)
  return {
    id: stringValue(channel._id),
    type: kind === "person" || roles.includes("actor") ? "actor" : "studio",
    name,
    handle: stringValue(channel.handle).replace(/^@/, ""),
    initials: initials(name),
    avatarUrl: stringValue(channel.avatarUrl) || null,
    verified: Boolean(channel.verifiedAt),
    isLive: Array.isArray(row.liveContent) && row.liveContent.length > 0,
    hasNew: false,
  }
}

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  )
}
