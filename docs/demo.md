# SpecShip Demo Guide

SpecShip is a product-spec tracker for small teams that want a clear path from intake to release.

Try it live, with no setup, at https://taan1el.github.io/specship/. That build
runs the demo mode described below: no backend, sample data in your browser.

## Product Tour

1. **Check system state**
   - The top strip shows whether the app is connected to the Node API,
     running the in-browser demo, or unable to reach the API.
   - The summary cards count active specs, high-priority work, and shipped
     items.

2. **Filter delivery work**
   - Use the status buttons to filter specs by `Backlog`, `In progress`,
     `Review`, or `Shipped`.
   - Each spec card keeps the owner, priority, requirement, acceptance
     criteria, and latest update visible.

3. **Move a spec forward**
   - Click a spec's status button to move it to the next delivery state.
   - The change is saved through `PATCH /api/specs/:id/status` (or, in demo
     mode, the in-browser store). If the request reaches the API and it
     rejects the change, the card keeps its current status and shows why.
     If the API cannot be reached at all, the UI applies the change locally
     and marks the API state as offline until it recovers.

4. **Create a spec**
   - Fill in the new feature form with a title, owner, priority,
     requirement, and acceptance criterion.
   - Input is validated with the same Zod schema on the server and in demo
     mode, so the two behave the same way for bad input.

## Verification

```bash
npm test
npm run lint
npm run build
npm run build:pages
```

## Trade-offs

- The in-memory store keeps local demos and the GitHub Pages build simple.
  Data does not survive a server restart or, in demo mode, a browser data
  reset.
- PostgreSQL support is included behind the same store interface for
  container-backed runs.
- SQL migrations are still a planned improvement.
