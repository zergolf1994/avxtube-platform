import { Router } from "express"
import {
  advertHobbyValid,
  domainSettingSchema,
  homeFeedSettingSchema,
  seoSettingSchema,
  workerScraperSettingSchema,
} from "@workspace/core/validators"
import {
  authenticateUser,
  requireAdmin,
} from "../middlewares/user-access.middleware"
import {
  getDomainSettings,
  saveDomainSettings,
} from "../services/settings/domain-setting.service"
import {
  getAdvertSettings,
  saveAdvertSettings,
} from "../services/settings/advert-setting.service"
import {
  getWorkerScraperSettings,
  saveWorkerScraperSettings,
} from "../services/settings/worker-scraper-setting.service"
import {
  getSeoSettings,
  saveSeoSettings,
} from "../services/settings/seo-setting.service"
import {
  getHomeFeedSettings,
  saveHomeFeedSettings,
} from "../services/settings/home-feed-setting.service"
import { getPublicVideoCategories } from "../services/content-video.service"
const router: Router = Router()
router.use(authenticateUser, requireAdmin)
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  next()
})

router.get("/domain", async (_req, res, next) => {
  try {
    res.json({ settings: await getDomainSettings() })
  } catch (error) {
    next(error)
  }
})

router.put("/domain", async (req, res, next) => {
  const parsed = domainSettingSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid domain settings",
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      })),
    })
    return
  }
  try {
    res.json({ settings: await saveDomainSettings(parsed.data) })
  } catch (error) {
    next(error)
  }
})

router.get("/adverts", async (_req, res, next) => {
  try {
    res.json({ settings: await getAdvertSettings() })
  } catch (error) {
    next(error)
  }
})

router.put("/adverts", async (req, res, next) => {
  const parsed = advertHobbyValid.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid advert settings",
      issues: parsed.error.issues,
    })
    return
  }
  try {
    res.json({ settings: await saveAdvertSettings(parsed.data) })
  } catch (error) {
    next(error)
  }
})

router.get("/worker-scraper", async (_req, res, next) => {
  try {
    res.json({ settings: await getWorkerScraperSettings() })
  } catch (error) {
    next(error)
  }
})

router.put("/worker-scraper", async (req, res, next) => {
  const parsed = workerScraperSettingSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid worker scraper settings",
      issues: parsed.error.issues,
    })
    return
  }
  try {
    res.json({ settings: await saveWorkerScraperSettings(parsed.data) })
  } catch (error) {
    next(error)
  }
})

router.get("/seo", async (_req, res, next) => {
  try {
    res.json({ settings: await getSeoSettings() })
  } catch (error) {
    next(error)
  }
})

router.put("/seo", async (req, res, next) => {
  const parsed = seoSettingSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid SEO settings",
      issues: parsed.error.issues,
    })
    return
  }
  try {
    res.json({ settings: await saveSeoSettings(parsed.data) })
  } catch (error) {
    next(error)
  }
})

router.get("/home-feed", async (_req, res, next) => {
  try {
    const [settings, categories] = await Promise.all([
      getHomeFeedSettings(),
      getPublicVideoCategories(),
    ])
    res.json({ settings, categories })
  } catch (error) {
    next(error)
  }
})

router.put("/home-feed", async (req, res, next) => {
  const parsed = homeFeedSettingSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid home feed settings",
      issues: parsed.error.issues,
    })
    return
  }
  try {
    res.json({ settings: await saveHomeFeedSettings(parsed.data) })
  } catch (error) {
    next(error)
  }
})

export default router
