import { ContentModel } from "@workspace/db/models"

const COUNT_CACHE_MS = 60_000
const DASHBOARD_CACHE_MS = 60_000
const PAST_DASHBOARD_CACHE_MS = 60 * 60_000

type HourlyStats = {
  date: string
  timeZone: "Asia/Bangkok"
  currentDate: string
  currentHour: number
  total: number
  hours: Array<{ hour: number; count: number }>
}

export type AdminDashboardSummary = {
  totals: Record<string, number>
  hourly: HourlyStats
}

const countCache = new Map<
  string,
  { expiresAt: number; pending: Promise<number> }
>()
const dashboardCache = new Map<
  string,
  { expiresAt: number; pending: Promise<AdminDashboardSummary> }
>()

export function countAdminContents(
  key: string,
  filter: Record<string, unknown>
) {
  const cached = countCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.pending

  const pending = ContentModel.countDocuments(filter)
    .exec()
    .catch((error) => {
      countCache.delete(key)
      throw error
    })
  if (countCache.size >= 100) countCache.clear()
  countCache.set(key, {
    expiresAt: Date.now() + COUNT_CACHE_MS,
    pending,
  })
  return pending
}

export function getAdminDashboardSummary(date: string) {
  const cached = dashboardCache.get(date)
  if (cached && cached.expiresAt > Date.now()) return cached.pending

  const start = new Date(`${date}T00:00:00.000+07:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1_000)
  const pending = Promise.all([
    ContentModel.aggregate<{ _id: string; total: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: "$kind", total: { $sum: 1 } } },
    ])
      .hint({ deletedAt: 1, kind: 1 })
      .exec(),
    ContentModel.aggregate<{ _id: number; count: number }>([
      {
        $match: {
          createdAt: { $gte: start, $lt: end },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: {
            $hour: { date: "$createdAt", timezone: "Asia/Bangkok" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec(),
  ])
    .then(([totals, grouped]) => {
      const counts = new Map(grouped.map((item) => [item._id, item.count]))
      const hours = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: counts.get(hour) ?? 0,
      }))
      const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1_000)
      return {
        totals: Object.fromEntries(
          totals.map((item) => [item._id, item.total])
        ),
        hourly: {
          date,
          timeZone: "Asia/Bangkok" as const,
          currentDate: bangkokNow.toISOString().slice(0, 10),
          currentHour: bangkokNow.getUTCHours(),
          total: hours.reduce((sum, item) => sum + item.count, 0),
          hours,
        },
      }
    })
    .catch((error) => {
      dashboardCache.delete(date)
      throw error
    })

  if (dashboardCache.size >= 32) dashboardCache.clear()
  const today = new Date(Date.now() + 7 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10)
  dashboardCache.set(date, {
    expiresAt:
      Date.now() +
      (date === today ? DASHBOARD_CACHE_MS : PAST_DASHBOARD_CACHE_MS),
    pending,
  })
  return pending
}

export function invalidateAdminContentCaches() {
  countCache.clear()
  dashboardCache.clear()
}
