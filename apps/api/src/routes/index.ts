import { Router } from "express"
import { isConnected } from "@workspace/db/mongoose"
import pkg from "../../package.json" with { type: "json" }

import usersRoutes from "./users.routes"
import settingsRoutes from "./settings.routes"
import videosRoutes from "./videos.routes"
import actorsRoutes from "./actors.routes"
import shortsRoutes from "./shorts.routes"
import studioRoutes from "./studio.routes"
import followingRoutes from "./following.routes"
import homeRoutes from "./home.routes"
import playlistsRoutes from "./playlists.routes"
import notificationsRoutes from "./notifications.routes"
import collectionsRoutes from "./collections.routes"
import searchRoutes from "./search.routes"
import channelsRoutes from "./channels.routes"
import adminContentsRoutes from "./admin-contents.routes"
import adminChannelsRoutes from "./admin-channels.routes"
import termsRoutes from "./terms.routes"
import adminTermsRoutes from "./admin-terms.routes"
import adminStoragesRoutes from "./admin-storages.routes"
import adminMediaRoutes from "./admin-media.routes"
import adminSettingsRoutes from "./admin-settings.routes"
import adminImportsRoutes from "./admin-imports.routes"
import adminWorkersRoutes from "./admin-workers.routes"
import mediaRoutes from "./media.routes"
import sitemapRoutes from "./sitemap.routes"

const router: Router = Router()

router.use("/users", usersRoutes)
router.use("/settings", settingsRoutes)
router.use("/videos", videosRoutes)
router.use("/actors", actorsRoutes)
router.use("/shorts", shortsRoutes)
router.use("/studio", studioRoutes)
router.use("/following", followingRoutes)
router.use("/home", homeRoutes)
router.use("/playlists", playlistsRoutes)
router.use("/notifications", notificationsRoutes)
router.use("/collections", collectionsRoutes)
router.use("/search", searchRoutes)
router.use("/channels", channelsRoutes)
router.use("/admin/contents", adminContentsRoutes)
router.use("/admin/channels", adminChannelsRoutes)
router.use("/terms", termsRoutes)
router.use("/admin/terms", adminTermsRoutes)
router.use("/admin/storages", adminStoragesRoutes)
router.use("/admin/media", adminMediaRoutes)
router.use("/admin/settings", adminSettingsRoutes)
router.use("/admin/imports", adminImportsRoutes)
router.use("/admin/workers", adminWorkersRoutes)
router.use("/media", mediaRoutes)
router.use("/sitemap", sitemapRoutes)

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: pkg.name,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: isConnected() ? "Connected" : "Disconnected",
  })
})
// 404 handler - handle all unmatched routes
router.use((req, res, next) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    // availableEndpoints: ['/v1/health', '/v1/settings', '/v1/users', '/v1/videos', '/v1/channels', '/v1/actors', '/v1/shorts', '/v1/studio/overview', '/v1/following', '/v1/home', '/v1/playlists', '/v1/notifications']
  })
})

export default router
