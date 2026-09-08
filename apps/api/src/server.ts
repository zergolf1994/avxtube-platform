import "dotenv/config"
import express from "express"
import cors from "cors"
import path from "node:path"
import { toNodeHandler } from "better-auth/node"
import { auth } from "@workspace/auth/config"
import dbConnect from "@workspace/db/mongoose"
import { registerApiAuthEvents } from "./auth/register-auth-events"
import { requestLogger } from "./middlewares/request-logger.middleware"
import ApiRoutes from "./routes/index"
import { backfillUsernames } from "./services/auth/backfill-usernames.service"
import { startViewerSearchSync } from "./services/viewer-search-sync"
const app = express()
// global.dirCached = path.resolve(".cached");

registerApiAuthEvents()

// Database connection
async function initializeDatabase() {
  try {
    const connection = await dbConnect()
    const backfilledUsernames = await backfillUsernames(connection)

    // Better Auth creates records inside a transaction. Finish any Mongoose
    // collection/index setup before accepting requests so the first signup
    // cannot collide with MongoDB catalog changes.
    await Promise.all(
      connection
        .modelNames()
        .map((modelName) => connection.model(modelName).createIndexes())
    )

    if (backfilledUsernames > 0) {
      console.log(`✅ Backfilled usernames for ${backfilledUsernames} users`)
    }

    console.log("✅ Database connection and indexes established")
    startViewerSearchSync()
  } catch (error) {
    console.error("❌ Database connection failed:", error)
    process.exit(1)
  }
}

// Middleware
const allowedOrigins = (
  process.env.CORS_ORIGINS ??
  process.env.CORS_ORIGIN ??
  "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
)
app.use(requestLogger)

// Better Auth ต้องรับ raw request ก่อน JSON body parser
app.all("/api/auth/*splat", toNodeHandler(auth))

app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Serve other static files from public directory without long cache
app.use(express.static(path.resolve("public")))

// Use API routes
app.use(`/${process.env.API_VERSION || "v1"}`, ApiRoutes)

// Error handler
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("❌ Error:", error)

    // MongoDB errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation Error",
        message: error.message,
        details: error.errors,
      })
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid ID format",
        message: "Invalid ObjectId format",
      })
    }

    // File upload errors
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File too large",
        message: "File exceeds the maximum upload size",
      })
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: "Invalid field name",
        message: 'Expected field name "file"',
      })
    }

    const status = Number(error.status ?? error.statusCode)
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
      return res.status(status).json({
        error: error.name || "Request error",
        message: error.message || "Request failed",
      })
    }

    return res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong",
    })
  }
)

const PORT = process.env.HTTP_PORT || 4000

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🔄 SIGTERM received, shutting down gracefully...")
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("🔄 SIGINT received, shutting down gracefully...")
  process.exit(0)
})

async function startServer() {
  await initializeDatabase()

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`)
    console.log(
      `🔗 Health check: http://${PORT !== "80" ? `localhost:${PORT}` : "localhost"}/${process.env.API_VERSION || "v1"}/health`
    )
  })
}

void startServer()
