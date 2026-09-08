# Viewer search and recommendations

## Search lifecycle

The API builds a separate `viewer_search` collection. The existing content text
index remains intact. Search continues using the original path until the initial
build **and its catch-up pass** finish; `viewer_search_state` / `_id: build` then
sets `ready: true`. Readiness is cached for five seconds.

The build indexes all stored title/description translations, related entity
names/aliases, and DVD/slug code prefixes. It does not translate missing metadata
or provide semantic/typo matching. Numeric prefixes can match codes from any
series. Relevance weights code, title, entity name, then description. Existing
sort options and numbered pagination remain supported.

API startup schedules sync automatically, then once per minute after the previous
sync finishes. Imports must maintain `updatedAt`, including entity metadata edits.
Only one instance runs at a time using a renewable database lease. Initial batches
are 250 records with a short pause and persistent cursors; restarts resume rather
than recreate the index. At roughly 500,000 records the first build is substantial:
monitor CPU/disk and do not expect multilingual search to switch on immediately.

Run a standalone pass with `pnpm --filter api search:sync`. Set
`VIEWER_SEARCH_SYNC=off` on API processes to delegate indexing to that process.
The standalone command exits without work if another process holds the lease.

Inspect progress (Mongo shell):

```javascript
db.viewer_search_state.findOne({ _id: "build" })
```

`scanned` includes content and channel records, `contentsAfter` / `channelsAfter`
are resume cursors, `contentsDone` / `channelsDone` indicate completed passes,
and `lastSyncedAt` records the latest successful delta. The `lease` document shows
the active owner/expiry. Do not manually set `ready` or reset cursors during a build.

Published/public status is checked against the source again before returning
content; count caches can lag for five minutes. Hard-deleted records are removed
incrementally (1,000 index rows per successful pass), so counts for hard deletions
may lag longer. Soft deletes and other changes with `updatedAt` use normal delta
sync. Statistics-only content updates do not rebuild text tokens.

## Recommendations

Fetch bounded candidates through indexed actor, studio, category/tag and code
family branches, rank shared metadata, exclude the current record and deduplicate.
Aim for 8 shared-actor, 6 shared-term, 4 shared-studio and 2 other candidates;
missing groups are filled from remaining candidates, then recent public videos.
Return up to 20 hydrated records. Cache each source's result for two minutes with
coalesced requests. This is metadata-based, not viewer-history personalization.

## Verification

```powershell
pnpm --filter api typecheck
pnpm --filter api exec tsx --test tests/viewer-discovery.test.ts tests/search-performance.test.ts
$env:VIEWER_SEARCH_DB_TEST='1'
pnpm --filter api exec tsx --test tests/viewer-search-db.test.ts
```

The opt-in Mongo test creates and drops only its own uniquely named test collection.
