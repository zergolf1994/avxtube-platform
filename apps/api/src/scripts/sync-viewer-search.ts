import "dotenv/config"
import { dbConnect, dbDisconnect } from "@workspace/db/mongoose"
import { syncViewerSearch } from "../services/viewer-search-sync"

await dbConnect()
try { await syncViewerSearch() }
finally { await dbDisconnect() }
