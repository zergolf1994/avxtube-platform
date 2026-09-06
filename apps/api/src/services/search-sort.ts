export function searchSort(value: unknown): Record<string, 1 | -1> {
  switch (value) {
    case "views":
      return { "stats.viewCount": -1, createdAt: -1, _id: -1 }
    case "oldest":
      return { createdAt: 1, _id: 1 }
    case "release":
      return { "metadata.releaseDate": -1, _id: -1 }
    case "release-oldest":
      return { "metadata.releaseDate": 1, _id: 1 }
    default:
      // Preserve relevance/default and latest ordering: no score is fabricated.
      return { createdAt: -1, _id: -1 }
  }
}
