# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-09-13

### Added

- Product spec board with status filters, a typed create flow, and a
  workflow that moves specs from Backlog through Review to Shipped.
- Express API with validated reads and writes and a documented error
  contract (stable `code` values, field-level `issues` on validation
  failures).
- PostgreSQL-ready persistence behind a store interface, with an
  in-memory store used for local runs and tests.
- In-browser demo mode for GitHub Pages: the same domain logic and
  validation run entirely in the browser, data is kept in
  localStorage, and a "Reset demo data" control clears it.
- Docker and Docker Compose setup for running the API with
  PostgreSQL, with a CI step that builds the image on every push.
- GitHub Pages deploy workflow and a live demo at
  https://taan1el.github.io/specship/.
- MIT license.

### Fixed

- The create-spec form and the status move button no longer fall back
  to a fake local success when the API rejects a request. A real
  rejection (validation failure, or a spec that no longer exists) now
  shows the server's message; only a genuinely unreachable API falls
  back to a local, unsaved change.
- The SpecShip heading no longer visually overlaps the subtitle below
  it at large viewport widths.
