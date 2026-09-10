# SpecShip

SpecShip is a full-stack TypeScript app for tracking product specs from intake to release. It gives small teams a shared place to define requirements, assign ownership, move work through review, and keep delivery notes visible.

## Features

- Product spec board with status filters.
- Typed create flow for new specs.
- Express API with validated reads and writes.
- Shared TypeScript contracts between the frontend and API.
- PostgreSQL-ready persistence behind a store interface.
- In-memory fallback for local demos when the API or database is unavailable.
- Docker and Docker Compose configuration.
- Tests, linting, and production build scripts.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the API:

```bash
npm run dev:api
```

Start the frontend in another terminal:

```bash
npm run dev
```

## API

- `GET /api/health`
- `GET /api/specs`
- `POST /api/specs`
- `PATCH /api/specs/:id/status`

## Docker

Docker is not required for local development, but the project includes a container setup for PostgreSQL-backed runs:

```bash
docker compose up --build
```

## Quality Checks

```bash
npm test
npm run lint
npm run build
```

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Next Improvements

- Add frontend tests around filtering and status movement.
- Add screenshots and demo notes.
- Add proper SQL migrations.
- Add structured API errors and request logging.
