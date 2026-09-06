# Search performance and UI verification — 2026-09-06

Target: `http://avxtube.org/th/search?q=...` (literal three-dot query).

## Observed performance

Chrome DevTools MCP, CPU 1x, no network throttling. Reloads used
`ignoreCache: true`. The after trace used a 1440 × 1000 desktop viewport;
responsive interaction checks also used 390 × 844 mobile emulation.

| Metric | Before changes | After changes |
| --- | ---: | ---: |
| TTFB | 2,107 ms | 1,520–1,524 ms |
| LCP | 2,191 ms | 1,605–1,608 ms |
| Load event | 8,400 ms | 3,455 ms counting / 2,038 ms cached count |
| CLS | 0.00 | 0.00 |
| Initial video/poster requests | 50 | 0 |
| Result image elements | 50 | 50 |
| Initial image requests after change | — | 10 |

The count is streamed after the actual result rows: on the counting run the
response began at 1,519 ms and finished at 3,450 ms. The LCP in these traces is
text, not a guarantee that every thumbnail has loaded. INP was not measured.

These are observed development measurements, not production field percentiles.
`scripts/local-proxy.js` maps the target hostname to the local dev server. The
catalogue was also being updated during the work, and the original baseline
viewport dimensions were not recorded. Both factors limit strict comparisons.
Traces recorded while the API was unavailable were discarded.

## Changes

- Search list previews mount only during mouse hover, without a poster request.
  The thumbnail remains visible until playback starts. Verified: zero video
  elements initially, one playing muted video on hover, zero after pointer leave.
- Added opt-in `part=results` and `part=count` to search. The default API response
  remains complete. A results response includes an exact total when the first
  page is exhaustive; otherwise it omits total and the page streams a count.
- Cached only content counts for 30 seconds, with a 128-entry bound, concurrent
  request coalescing, and failure eviction. Locale and sort share membership
  counts; rows, publication checks, and actors are still read live. Counts can
  lag catalogue changes by up to 30 seconds.
- Skipped a second catalogue scan for first pages with fewer than 50 rows.
- Resolved independent channel, term, and media filters concurrently. An empty
  required media set avoids transmitting other large media-ID arrays.
- Added API Server-Timing for filter, page, and count work.
- Added responsive search input, visible sort selector, content-type buttons,
  draft/apply filter dialog, removable filter chips, and reset controls.
- Search cards use responsive thumbnails, actual publication/addition dates,
  and existing descriptions. All query/filter/sort state remains in the URL.

## Sort semantics and MongoDB plans

`relevance` remains the existing default order; no relevance score is fabricated.
New choices use stored dates. Views are the all-time stored `stats.viewCount`.
No daily/weekly popularity or localized-title ordering is invented.

For `q=...`, executionStats on the existing page pipeline showed:

| Sort | Stored ordering | Execution time | Documents examined | Blocking SORT |
| --- | --- | ---: | ---: | --- |
| latest/default | createdAt descending, _id descending | 81 ms | 161 | No |
| oldest | createdAt ascending, _id ascending | 117 ms | 155 | No |
| release | metadata.releaseDate descending, _id descending | 78 ms | 85 | No |
| release-oldest | metadata.releaseDate ascending, _id ascending | 81 ms | 149 | No |
| views | stats.viewCount, createdAt, _id descending | 83 ms | 161 | No |

All use existing compound indexes prefixed by kind/status/visibility/deletedAt.
Ascending date choices scan those indexes backward. No index migration or
channel-index change was made by this search task. MongoDB's normal null ordering
applies when a release date is missing; the UI does not invent a release date.

## Verification

- Web and API TypeScript checks passed.
- ESLint passed for the changed web TSX files.
- 26 focused API tests passed on bundled Node 24, including count TTL, capacity,
  coalescing, failure retry, exact short-page totals, fresh rows under cached
  counts, separate media conditions, deferred response contract, localization,
  existing viewer behavior, and deterministic sorts.
- Seven live API scenarios were compared against a preserved original handler:
  complete JSON and order matched (three-dot query, another text query, no
  matches, empty query, views/video, shorts, live).
- Mobile layout had no horizontal overflow. Sort changes and an applied date
  filter updated the URL; browser Back restored controls, query, and filter chips.
- Desktop hover playback and cleanup verified through Chrome DevTools MCP.

## Remaining limits

- Arbitrary case-insensitive substring searches over all translated text can
  still scan the catalogue, particularly for no-match queries. The exact matching
  semantics were preserved instead of replacing them with token-based search.
- Thumbnail files are still larger than their display size. Lazy loading reduces
  initial work but does not resize or recompress the source files.
- The pre-existing HD and watched/unwatched UI options were retained; the original
  API does not implement those predicates. This task did not add history/auth
  filtering or claim those legacy filters are functional.
- No commit, push, deployment, or production build was performed.
