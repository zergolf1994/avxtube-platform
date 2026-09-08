import type { PipelineStage } from "mongoose"

export function searchSort(
  value: unknown,
  hasQuery = false
): PipelineStage.Sort["$sort"] {
  switch (value) {
    case "views":
      return { "stats.viewCount": -1, createdAt: -1, _id: -1 }
    case "oldest":
      return { createdAt: 1, _id: 1 }
    case "release":
      return { "metadata.releaseDate": -1, _id: -1 }
    case "release-oldest":
      return { "metadata.releaseDate": 1, _id: 1 }
    case "latest":
      return { createdAt: -1, _id: -1 }
    default:
      return hasQuery
        ? { __searchScore: { $meta: "textScore" }, _id: -1 }
        : { createdAt: -1, _id: -1 }
  }
}
