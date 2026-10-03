# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- Added automated accessibility checks to the test suite for the spec list with the document view and for the New spec dialog, using axe with the WCAG 2 A and AA rules. Color contrast is checked outside jsdom.

### Changed

- Gave SpecShip its own look as a spec reader: a cream page with dusk blue accents, Newsreader for headings and spec text, Figtree for labels and buttons, and DM Mono for dates and counts.
- Replaced the stats strip and spec table with a list of specs grouped by status on the left and the selected spec shown as a document on the right, with the requirement as prose and the acceptance criteria as a numbered list.
- Moved spec creation into a New spec dialog that keeps keyboard focus inside while open and returns it when closed.
- Shrank the stats to one line of text and reduced corners to 3px with hairline borders.
- Redesigned the interface around the shared product design tokens: Sora, Geist, and Geist Mono replace Inter, the header wordmark drops from a 108px hero to 40px, and every box-shadow except the focus ring is gone.
- Replaced the repeated stat boxes and card grids with one stats strip and a spec list grouped by delivery status, with priority and owner as small badges instead of cards.
- Added a selected-spec detail panel and moved the create-spec form into a single side column, next to the spec list.
- Removed the copy and panels that described the tech stack instead of the product; the header subtitle now describes what the tool does for the people using it.
- Added a slim demo bar with the reset action and a link to the source, replacing the inline demo notice.
- Raised every control to at least 44px tall and confirmed the layout holds to one column with no horizontal page scroll under 720px.

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
