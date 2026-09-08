import "dotenv/config"

import dbConnect from "@workspace/db/mongoose"
import { ContentModel } from "@workspace/db/models"

const requestedBatchSize = Number(process.env.ACTRESS_COUNT_BATCH_SIZE)
const BATCH_SIZE =
  Number.isInteger(requestedBatchSize) && requestedBatchSize > 0
    ? Math.min(requestedBatchSize, 5_000)
    : 500

async function main() {
  await dbConnect()
  let lastId = ""
  let scanned = 0
  let modified = 0

  try {
    while (true) {
      const rows = await ContentModel.find(
        {
          _id: { $gt: lastId },
          actressCount: { $exists: false },
        },
        { _id: 1, actressIds: 1 }
      )
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .hint({ _id: 1 })
        .lean()
        .exec()

      if (!rows.length) break

      const result = await ContentModel.bulkWrite(
        rows.map((row) => ({
          updateOne: {
            filter: { _id: row._id, actressCount: { $exists: false } },
            update: {
              $set: {
                actressCount: Array.isArray(row.actressIds)
                  ? row.actressIds.length
                  : 0,
              },
            },
          },
        })),
        { ordered: false }
      )

      scanned += rows.length
      modified += result.modifiedCount
      lastId = rows.at(-1)?._id ?? lastId
      console.log(
        `Backfilled ${modified} contents (${scanned} scanned, batch ${rows.length}).`
      )
    }

    console.log(`Finished actressCount backfill: ${modified} contents updated.`)
  } finally {
    await ContentModel.db.close()
  }
}

main().catch((error) => {
  console.error("Failed to backfill actressCount", error)
  process.exitCode = 1
})
