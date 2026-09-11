# SpecShip Architecture

SpecShip is a small full-stack TypeScript product-spec tracker. The app keeps product requirements, owners, acceptance criteria, and delivery status in one place while keeping the frontend and API contracts aligned.

## Shape

- React and TypeScript frontend in `src`.
- Shared feature contracts in `shared`.
- Express API in `server`.
- Store abstraction with an in-memory implementation for local demos and a PostgreSQL implementation for container/database runs.
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

## Technical Standards

- Keep request and response contracts typed.
- Validate incoming writes before they hit storage.
- Keep persistence behind a small interface so tests can use memory storage.
- Run tests, lint, and build before pushing.

## Production Direction

Next production-grade additions would be authentication, proper migrations, structured logging, deploy previews, and cloud environment documentation.
