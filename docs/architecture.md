# SpecShip Architecture

SpecShip is a small full-stack TypeScript product-spec tracker. The app keeps product requirements, owners, acceptance criteria, and delivery status in one place while keeping the frontend and API contracts aligned.

## Shape

- React and TypeScript frontend in `src`.
- Shared feature contracts, the in-memory store, and validation schemas in `shared`. Nothing in `shared` uses a Node-only API, so the same code runs in the Express server and in the browser.
- Express API in `server`. It re-exports the shared store and validation and adds the PostgreSQL-backed store, which does depend on Node (`pg`).
- A small API client in `src/services`: `api.ts` talks to the real Express API, `demoApi.ts` answers the same functions from the shared in-memory store, and `index.ts` picks one with `import.meta.env.VITE_DEMO_MODE`.
- Docker Compose file for running the API with Postgres.

## API

- `GET /api/health` reports service health.
- `GET /api/specs` lists product specs.
- `POST /api/specs` creates a backlog spec from validated input.
- `PATCH /api/specs/:id/status` moves a spec through delivery statuses.

### Error responses

Every error response contains a stable `code` and a readable `error` string.
Clients should branch on `code` rather than message text. Successful responses
keep their existing shape.

| HTTP status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Request fields failed validation; `issues` contains field paths and messages. |
| 400 | `INVALID_JSON` | The request body could not be parsed as JSON. |
| 404 | `SPEC_NOT_FOUND` | The requested spec does not exist. |
| 404 | `NOT_FOUND` | The requested route does not exist. |
| 413 | `PAYLOAD_TOO_LARGE` | The JSON body exceeded the default 100 KB parser limit. |
| 415 | `UNSUPPORTED_ENCODING` | The request uses an unsupported charset or content encoding. |
| 500 | `INTERNAL_ERROR` | An unexpected server or storage failure prevented the operation. |

Validation issue paths are arrays, for example `["acceptanceCriteria", 0]`.
Invalid writes are rejected before storage is called. Unexpected failures return
a generic message; internal exception messages and stack traces are never sent
to the client. Request logging remains a separate future improvement.

The `src/services/api.ts` client on the frontend turns any non-2xx response
into an `ApiError` carrying the same `code` and `issues`, so the UI can show
the real reason a request failed instead of guessing from the status code.

## Local-first browser build

The Pages build adds the modules in `src/local`:

- `specMarkdown.ts` reads and writes one spec as a Markdown file (front
  matter, requirement prose, `## Acceptance criteria` task list) and splits a
  combined file. Errors carry a 1-based line number.
- `specMerge.ts` sorts imported specs against saved ones by id into new,
  changed, unchanged and conflict, without writing anything.
- `zip.ts` writes a store-only zip with a CRC-32; `exportSpecs.ts` and
  `files.ts` build and download the files.
- `workspace.ts` is the IndexedDB layer (versioned schema, revision-checked
  writes, a BroadcastChannel to tell other tabs); `specWorkspace.ts` holds
  Your workspace on top of it and exposes it as an external store.
- `offline.ts` and `UpdateNotice.tsx` register the service worker and show the
  update notice. `localBuild.ts` (next to `vite.config.ts`) emits the
  Content-Security-Policy, manifest, icons and `sw.js` for the Pages build only.

`shared/specStore.ts` gains `LocalSpecStore` (update, remove, upsertMany) for
this build. The Express server keeps the smaller `SpecStore`.

## Demo mode

`npm run build:pages` builds the frontend with `VITE_DEMO_MODE=true` (set in
`.env.pages`) and a `/specship/` base path for GitHub Pages. In that mode
`src/services/index.ts` selects `demoApi.ts` instead of `api.ts`:

- Reads and writes go to the same `createMemorySpecStore` the server uses,
  imported straight from `shared/specStore.ts`.
- Writes are validated with the same Zod schemas as the server
  (`shared/validation.ts`), so bad input is rejected the same way.
- The sample specs are saved to `localStorage` under a namespaced key after
  every change, and reloaded on the next visit. Each saved spec is checked on
  load (`validateStoredSpec`); entries that fail are left out and the page says
  how many. A "Reset sample data" control clears them and reseeds the store.
- A second data source, Your workspace, is saved to IndexedDB instead and is
  never touched by the sample reset. `demoApi.ts` sends every read and write to
  whichever source is selected.
- There is no client-side routing in this app, so the Pages build does not
  need hash routing or a 404 fallback page.

## Technical standards

- Keep request and response contracts typed.
- Validate incoming writes before they hit storage.
- Keep persistence behind a small interface so tests can use memory storage.
- Run tests, lint, and build before pushing.

## Possible next steps

Authentication, real SQL migrations, structured request logging, and
deploy previews would be the next additions if this moved beyond a
single-team tool.
