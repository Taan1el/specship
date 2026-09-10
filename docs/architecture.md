# SpecShip Architecture

SpecShip is built with React, TypeScript, Node APIs, database-backed design, containers, and production-style delivery habits.

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

## Technical Standards

- Keep request and response contracts typed.
- Validate incoming writes before they hit storage.
- Keep persistence behind a small interface so tests can use memory storage.
- Prefer small commits that each leave the app buildable.
- Run tests, lint, and build before pushing.

## Production Direction

Next production-grade additions would be authentication, proper migrations, structured logging, deploy previews, and cloud environment documentation.
