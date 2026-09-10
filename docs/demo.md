# SpecShip Demo Guide

SpecShip is a product-spec tracker for small teams that want a clear path from intake to release.

## Product Tour

1. **Check System State**
   - The top strip shows whether the app is connected to the Node API or using local fallback data.
   - The summary cards count active specs, high-priority work, and shipped items.

2. **Filter Delivery Work**
   - Use the status buttons to filter specs by `Backlog`, `In progress`, `Review`, or `Shipped`.
   - Each spec card keeps the owner, priority, requirement, acceptance criteria, and latest update visible.

3. **Move a Spec Forward**
   - Click a spec status button to move it to the next delivery state.
   - When the API is available, the change is saved through `PATCH /api/specs/:id/status`.
   - When the API is unavailable, the UI still updates locally and marks the API state as offline.

4. **Create a Spec**
   - Fill in the new feature form with a title, owner, priority, requirement, and acceptance criterion.
   - The API validates writes with Zod before storing them.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Trade-Offs

- The in-memory store keeps local demos simple.
- PostgreSQL support is included behind the same store interface for container-backed runs.
- SQL migrations are still a planned improvement.
