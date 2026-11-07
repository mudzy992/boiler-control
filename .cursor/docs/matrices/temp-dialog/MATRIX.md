# MATRIX — TempDialog / set current flow temp

## Bounds (source of truth)

| Layer | Min | Max | Notes |
|---|---|---|---|
| Backend DTO `SetCurrentTempDto` | 48 | 55 | `@Min` / `@Max` |
| Frontend `boilerLimits.ts` | 48 | 55 | Must stay in parity |
| Recommendation clamp (`base.strategy`) | 46 | 55 | **Not** user input |

Inclusive on both ends. Normalize to 1 decimal before submit.

## Cache invalidation after successful set

| Query key | Why |
|---|---|
| `queryKeys.boilerEvents` | Boiler page current/events |
| `queryKeys.dashboard` | Dashboard embeds boiler temp |
| `queryKeys.dashboardHealth` | Health may depend on boiler state |

Helper: `frontend/src/shared/lib/invalidate-after-temp-set.ts`.
Wire both Dashboard and Boiler callers in I6.
