# HeatingScreen UI Fix - Task Card

**Priority**: 🔴 High (Blocks Phase 3 QA verification)
**Effort**: 15-30 minutes
**Owner**: Frontend team
**Status**: ⏳ Ready to start

---

## Task Description

Fix temperature placeholder display on HeatingScreen when current/target temperature data is unavailable.

## Current Issue

When `summaryData.buckets[0]?.avgCurrentTemp` or `avgTargetTemp` is undefined/null:
- Temperature values may show incomplete or incorrect state
- Progress bar may not hide properly
- Delta indicator may display unexpectedly

## Expected Behavior (After Fix)

### When Temperature Data is Available (Normal State)
```
┌─────────────────────────────────────┐
│  Current        Target              │
│    22.5°C         20°C              │
│  ──────────────────────────────────  │ ← Progress bar visible
│  ↑ 2.5°C above target               │ ← Delta visible
└─────────────────────────────────────┘
```

### When Temperature Data is Unavailable (Placeholder State)
```
┌─────────────────────────────────────┐
│  Current        Target              │
│   --°C            --°C              │ ← Skeleton pulse animation
│  (no progress bar)                  │ ← Progress bar HIDDEN
│  (no delta)                         │ ← Delta HIDDEN
└─────────────────────────────────────┘
```

## Implementation Details

### Affected Component
File: `apps/mobile/src/screens/heating/HeatingScreen.tsx`
Component: `TemperatureDisplay`

### Fix Checklist

- [ ] **Add data availability check**
  ```typescript
  const showTemperatureSkeleton =
    !summaryData?.buckets?.[0]?.avgCurrentTemp ||
    !summaryData?.buckets?.[0]?.avgTargetTemp;
  ```

- [ ] **Conditional rendering for temperatures**
  ```typescript
  {showTemperatureSkeleton ? (
    // Show "--°C" with skeleton pulse
    <Box bg={useColorModeValue('gray.300', 'gray.600')} rounded="full" p={2}>
      <Text>--°C</Text>
    </Box>
  ) : (
    // Show actual value
    <Text fontSize="3xl" fontWeight="bold">
      {current.toFixed(1)}°C
    </Text>
  )}
  ```

- [ ] **Hide progress bar when temps unavailable**
  ```typescript
  {!showTemperatureSkeleton && (
    <Box bg="gray.200" rounded="full" h={2}>
      {/* Progress bar code */}
    </Box>
  )}
  ```

- [ ] **Hide delta indicator when temps unavailable**
  ```typescript
  {!showTemperatureSkeleton && (
    <HStack alignItems="center" space={2}>
      {/* Delta code */}
    </HStack>
  )}
  ```

- [ ] **Verify responsive layout** (mobile portrait/landscape, tablet)
  - Padding and spacing remain consistent
  - "--°C" displays at same font size as actual temps
  - Skeleton animation smooth on light/dark modes

- [ ] **Test on light mode** (gray.50 background)
  - Gray skeleton visible and readable
  - Text contrast adequate

- [ ] **Test on dark mode** (dark.900 background)
  - Gray skeleton visible and readable
  - Text contrast adequate

- [ ] **Verify no console warnings/errors** after fix applied

---

## Testing Instructions (for QA)

After fix is applied:

1. **Trigger placeholder state** (temp data unavailable)
   - Navigate to HeatingScreen
   - If analytics data loads, wait or switch homes to trigger data reload
   - Verify "--°C" displays with skeleton animation

2. **Verify layout**
   - [ ] Current and target show "--°C" side-by-side
   - [ ] Progress bar NOT visible
   - [ ] Delta indicator NOT visible
   - [ ] Responsive on iPhone SE (375px) ✓
   - [ ] Responsive on iPad (1024px) ✓

3. **Light mode test**
   - [ ] Gray skeleton visible against gray.50 background
   - [ ] Text readable

4. **Dark mode test**
   - [ ] Gray skeleton visible against dark.900 background
   - [ ] Text readable

5. **Switch modes (light → dark → light)**
   - [ ] Skeleton animation smooth
   - [ ] No flicker or layout shift

6. **Pull-to-refresh**
   - [ ] Placeholder state works during refresh
   - [ ] Once data loads, temperature values appear
   - [ ] Progress bar and delta re-appear

7. **Active-home switching**
   - [ ] If new home has no data, placeholder appears
   - [ ] When data loads, transitions to normal state smoothly

---

## Success Criteria

- ✅ "--°C" displays when temps unavailable (both current and target)
- ✅ Progress bar hidden during placeholder state
- ✅ Delta indicator hidden during placeholder state
- ✅ Skeleton animation visible (subtle pulse)
- ✅ Light/dark mode both readable
- ✅ Responsive layout maintained (all device sizes)
- ✅ No console errors/warnings
- ✅ QA can now test full HeatingScreen feature set

---

## Time Estimate

- Code changes: 10-15 min
- Testing & verification: 10-15 min
- Total: 20-30 min

---

## Blocking

🧪 **QA**: Cannot fully verify HeatingScreen until this fix applied
📋 **Phase 3 Sign-Off**: Minor blocker (will not delay overall Phase 3, but QA should test after fix)

---

## Notes

- This is a **cosmetic/UX fix** - no logic changes
- All other HeatingScreen features (next interval, system info, pull-to-refresh) work correctly
- Fix aligns with placeholder UX strategy documented in [HEATING_SCREEN_QA_PLAN.md](docs/HEATING_SCREEN_QA_PLAN.md)
