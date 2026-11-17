# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.1.0] - 2026-11-17

### Added

- The Pages build is now a local-first tool: a "Your workspace" data source next to the sample data keeps your own specs in this browser (IndexedDB, with a versioned schema, revision-checked saves and a message when another tab saves), with no server, account or API key.
- Specs can be edited (title, requirement, acceptance criteria, status, priority and an optional owner) and deleted, after a confirmation.
- Acceptance criteria are checkboxes. Ticking every criterion suggests moving the spec to the next status without moving it.
- Every spec is a Markdown file with front matter, the requirement as prose and an `## Acceptance criteria` task list. A strict reader reports the line that is wrong and accepts CRLF and a byte order mark; unknown front matter fields are kept.
- Import one or many Markdown files, by file picker or by dropping them on the page, with a preview that sorts specs into new, changed, unchanged and conflicts where the saved copy is newer, and a confirmation that states the counts.
- Export one spec as a `.md` file, all specs as a zip with one file per spec (a small store-only zip writer with a CRC-32), or all specs as one combined `.md` file that can be imported again.
- A print layout for the open spec, so it can be saved as a PDF from the browser.
- A Content-Security-Policy with no external hosts, a web app manifest, and an offline service worker that loads the newest page when online, falls back to the cached page offline, and shows "A new version is ready." with a Reload button instead of reloading by itself.
- An always-visible line that specs stay in this browser, a quiet backup reminder after changes, and one sentence on what the tool is not.

### Fixed

- Saved sample data is checked when the page loads instead of being trusted. Entries that fail are left out with a notice, and specs saved by version 1.0.0 are kept.
- Download links stay valid for ten seconds instead of being revoked at once.

## [Unreleased]

### Added

- The New spec dialog shows a live character count under each text field, and screen readers hear the remaining space once 20 or fewer characters are left.
- Added a test that checks every sideways scrolling container is a labelled, keyboard-focusable region in the spec list, document view and New spec dialog.
- Added automated accessibility checks to the test suite for the spec list with the document view and for the New spec dialog, using axe with the WCAG 2 A and AA rules. Color contrast is checked outside jsdom.

### Changed

- Spec fields now have upper limits, shared by the API, the browser demo and the form: title 200 characters, owner 100, requirement 5000, and up to 25 acceptance criteria of 500 characters each.
- Surrounding whitespace is trimmed from every spec field before validation, and blank acceptance criteria are dropped, so a whitespace-only entry is rejected instead of saved.
- When a submission is rejected, focus moves to the field at fault, which is marked invalid and linked to the error message. Errors without a field move focus to the message itself.
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
