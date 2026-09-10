# SpecShip

SpecShip is a full-stack TypeScript app for tracking a feature from specification to production-style delivery. It uses React, TypeScript, Node APIs, a PostgreSQL database and containers.

## Job Requirements Covered

- React application development with typed state and forms.
- Node.js API development with Express.
- Shared TypeScript contracts between frontend and backend.
- Validated API writes with Zod.
- PostgreSQL-ready persistence behind a store interface.
- Docker and Docker Compose configuration.
- Tests for API behavior.
- Build, lint, and test scripts for maintainable delivery.
- Architecture notes for technical discussion.

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
- Add GitHub Actions CI.
- Add screenshots and demo notes.
- Add proper SQL migrations.
- Add structured API errors and request logging.
