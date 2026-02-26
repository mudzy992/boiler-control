# Dashboard System Status Plan (Mobile)

## Goal
Make the Dashboard `System Status` (Health Score) relevant and stable by replacing the current single-source score with a weighted, multi-signal score.

## Current State (Source of Truth Today)
- Mobile score is computed in `apps/mobile/src/screens/dashboard/DashboardScreen.tsx`.
- Current formula:
  - Reads `dashboardData.homes[0].learningIntervals`.
  - Averages `interval.confidence` values.
  - Returns `avgConfidence * 100`.
- This means the score is effectively tied only to learning confidence.

## Why Current Source Is Not Reliable Alone
- Learning confidence can stay low (`~0.1`) for long periods in early/unstable learning, causing a near-constant score around `10/100`.
- It ignores live operational signals:
  - boiler flow tracking quality,
  - thermostat freshness/offline state,
  - recent anomaly behavior.
- UI currently shows `confidence` from only the first interval (`learningIntervals[0]`) rather than full average, which can also mislead users.

## Implementation Scope
- `apps/mobile` only for this step (no backend API change required).
- Keep existing card component (`HealthScoreCard`) and feed it improved inputs.

## Proposed Scoring Matrix (0-100)
- Learning confidence score (35%)
  - average of all interval confidences.
- Boiler flow consistency score (25%)
  - based on absolute delta between `actualFlowTemp` and `suggestedFlowTemp`.
- Thermostat freshness score (25%)
  - based on percentage of thermostats seen recently (e.g. within 10 minutes).
- Anomaly penalty score (15%)
  - based on anomaly ratio in recent heating events.

Final:
- `healthScore = weightedSum(learning, flow, freshness, anomalyPenalty)`.
- Clamp to `0..100`.

## Data Availability / Fallback Rules
- If a signal is missing, do not hard-fail.
- Rebalance by averaging available weighted components.
- If no meaningful data exists at all, return neutral fallback (`50`), not critical (`0`) and not optimistic (`100`).

## UI/Data Behavior Changes
- `score` on Health card uses new matrix result.
- `confidence` label should use averaged learning confidence from all intervals (not first row only).

## Validation Plan
1. User with low learning confidence but good thermostat/boiler behavior should not stay fixed at `10/100`.
2. User with stale thermostats or big boiler delta should see reduced score.
3. User with anomalies in recent events should see score penalty.
4. Missing-data users should receive neutral fallback around `50`.

## Deliverables
- Dashboard score calculation refactor in:
  - `apps/mobile/src/screens/dashboard/DashboardScreen.tsx`
- No API contract change required for first iteration.

