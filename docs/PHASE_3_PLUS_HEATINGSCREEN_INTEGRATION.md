# HeatingScreen Integration Guide - Day 3

**Objective**: Wire all Phase 3+ components into HeatingScreen
**Timeline**: Thursday, February 6, 2026 (1 day effort)
**Owner**: Frontend Lead / Frontend Dev 2

---

## Overview

HeatingScreen currently displays read-only heating data. Day 3 integrates 4 new modals for:
1. **SetpointControl** - Adjust target temperature
2. **ModeSelector** - Switch heating mode
3. **EditScheduleModal** - Edit program intervals
4. **AddProgramModal** - Add new program intervals

---

## Step-by-Step Integration

### Step 1: Import Components

Add to `apps/mobile/src/screens/heating/HeatingScreen.tsx` imports section:

```typescript
import { SetpointControl } from '../../components/heating/SetpointControl';
import { ModeSelector } from '../../components/heating/ModeSelector';
import { EditScheduleModal } from '../../components/heating/EditScheduleModal';
import { AddProgramModal } from '../../components/heating/AddProgramModal';
import heatingApi from '../../services/api/heating.api';
```

---

### Step 2: Setup State for Modal Visibility

Add to component state (useState hooks):

```typescript
const [setpointModalVisible, setSetpointModalVisible] = useState(false);
const [modeModalVisible, setModeModalVisible] = useState(false);
const [editScheduleModalVisible, setEditScheduleModalVisible] = useState(false);
const [addProgramModalVisible, setAddProgramModalVisible] = useState(false);
const [selectedProgram, setSelectedProgram] = useState<ProgramInterval | null>(null);
```

---

### Step 3: Setup Mutations

Add React Query mutations for each API call:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// Setpoint Mutation
const setpointMutation = useMutation(
  (temp: number) => heatingApi.setTemperature(homeId, temp),
  {
    onSuccess: (data) => {
      toast.show({
        title: 'Success',
        description: data.message,
        status: 'success',
        duration: 2000,
      });
      setSetpointModalVisible(false);
      queryClient.invalidateQueries(['heatingSummary', homeId]);
    },
    onError: (error: Error) => {
      toast.show({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  }
);

// Mode Mutation
const modeMutation = useMutation(
  (mode: 'program' | 'manual' | 'off') => heatingApi.setMode(homeId, mode),
  {
    onSuccess: (data) => {
      toast.show({
        title: 'Success',
        description: data.message,
        status: 'success',
        duration: 2000,
      });
      queryClient.invalidateQueries(['heatingSummary', homeId]);
    },
    onError: (error: Error) => {
      toast.show({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  }
);

// Add Program Mutation
const addProgramMutation = useMutation(
  (interval: Omit<ProgramInterval, 'id'>) => heatingApi.addProgram(homeId, interval),
  {
    onSuccess: (data) => {
      toast.show({
        title: 'Success',
        description: 'Schedule added successfully',
        status: 'success',
        duration: 2000,
      });
      setAddProgramModalVisible(false);
      queryClient.invalidateQueries(['heatingSummary', homeId]);
    },
    onError: (error: Error) => {
      toast.show({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  }
);

// Edit Program Mutation
const editProgramMutation = useMutation(
  (interval: ProgramInterval) => {
    // Note: Backend expects full programs array, not individual update
    // Frontend handles this by collecting all programs and sending full array
    return heatingApi.updatePrograms(homeId, [interval]);
  },
  {
    onSuccess: (data) => {
      toast.show({
        title: 'Success',
        description: 'Schedule updated successfully',
        status: 'success',
        duration: 2000,
      });
      setEditScheduleModalVisible(false);
      setSelectedProgram(null);
      queryClient.invalidateQueries(['heatingSummary', homeId]);
    },
    onError: (error: Error) => {
      toast.show({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  }
);

// Delete Program Mutation (optional, depends on backend implementation)
const deleteProgramMutation = useMutation(
  (intervalId: number) => heatingApi.deleteProgram(homeId, intervalId),
  {
    onSuccess: (data) => {
      toast.show({
        title: 'Success',
        description: 'Schedule deleted successfully',
        status: 'success',
        duration: 2000,
      });
      queryClient.invalidateQueries(['heatingSummary', homeId]);
    },
    onError: (error: Error) => {
      toast.show({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  }
);
```

---

### Step 4: Update Setpoint Control Button

Find existing setpoint display button and update:

```typescript
// OLD: Just displays temperature
<Text onPress={() => setSetpointModalVisible(true)}>
  Target: {currentSetpoint}°C
</Text>

// NEW: Opens SetpointControl modal
<Button onPress={() => setSetpointModalVisible(true)}>
  Adjust Temperature
</Button>

// Add modal to component tree (see Step 6)
```

---

### Step 5: Update Mode Display

Find existing mode display and update:

```typescript
// Replace static mode display with ModeSelector
<ModeSelector
  currentMode={heatingData?.mode as any}
  onModeChange={(mode) => modeMutation.mutate(mode)}
  loading={modeMutation.isLoading}
  error={modeMutation.error?.message}
  homeId={homeId}
/>
```

---

### Step 6: Update Program List

Find existing program list and add Edit/Delete buttons:

```typescript
// OLD: Static list
{programs.map((program) => (
  <Text key={program.id}>{program.dayType} {program.startMinute}min → {program.targetTemp}°C</Text>
))}

// NEW: Interactive list with Edit/Delete
{programs.map((program) => (
  <HStack key={program.id} space={2} alignItems="center" p={3} bg="gray.100" rounded="lg">
    <VStack flex={1} space={1}>
      <Text fontWeight="bold">{program.dayType}</Text>
      <Text fontSize="sm" color="gray.600">
        {minutesToTime(program.startMinute)} → {program.targetTemp}°C
      </Text>
    </VStack>

    {/* Edit Button */}
    <Button
      size="sm"
      variant="outline"
      onPress={() => {
        setSelectedProgram(program);
        setEditScheduleModalVisible(true);
      }}
    >
      Edit
    </Button>

    {/* Delete Button */}
    <Button
      size="sm"
      colorScheme="danger"
      variant="outline"
      onPress={() => {
        // Optional: Show confirmation dialog
        deleteProgramMutation.mutate(program.id!);
      }}
    >
      Delete
    </Button>
  </HStack>
))}
```

Helper function to add to HeatingScreen:
```typescript
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};
```

---

### Step 7: Add Program Button

Add button to open AddProgramModal:

```typescript
<Button
  colorScheme="green"
  leftIcon={<Icon as={Ionicons} name="add" />}
  onPress={() => setAddProgramModalVisible(true)}
>
  Add Schedule
</Button>
```

---

### Step 8: Render All Modals at Bottom of Screen

Add all 4 modals to component JSX (typically at end of VStack):

```typescript
{/* Setpoint Control Modal */}
<SetpointControl
  visible={setpointModalVisible}
  currentTemp={heatingData?.currentTemp || 0}
  targetTemp={heatingData?.setpoint || 20}
  onSetpoint={(temp) => setpointMutation.mutate(temp)}
  onClose={() => setSetpointModalVisible(false)}
  loading={setpointMutation.isLoading}
  error={setpointMutation.error?.message}
  homeId={homeId}
/>

{/* Mode Selector Modal */}
<Modal
  isOpen={modeModalVisible}
  onClose={() => setModeModalVisible(false)}
>
  <Modal.Content>
    <Modal.Header>Select Heating Mode</Modal.Header>
    <Modal.Body>
      <ModeSelector
        currentMode={heatingData?.mode as any}
        onModeChange={(mode) => modeMutation.mutate(mode)}
        loading={modeMutation.isLoading}
        error={modeMutation.error?.message}
        homeId={homeId}
      />
    </Modal.Body>
  </Modal.Content>
</Modal>

{/* Edit Schedule Modal */}
<EditScheduleModal
  visible={editScheduleModalVisible}
  interval={selectedProgram}
  onSave={(interval) => editProgramMutation.mutate(interval)}
  onClose={() => {
    setEditScheduleModalVisible(false);
    setSelectedProgram(null);
  }}
  loading={editProgramMutation.isLoading}
  error={editProgramMutation.error?.message}
  homeId={homeId}
/>

{/* Add Program Modal */}
<AddProgramModal
  visible={addProgramModalVisible}
  onAdd={(interval) => addProgramMutation.mutate(interval)}
  onClose={() => setAddProgramModalVisible(false)}
  loading={addProgramMutation.isLoading}
  error={addProgramMutation.error?.message}
  homeId={homeId}
  existingIntervals={programs}
/>
```

---

## Testing Checklist (Immediate)

### Component Rendering
- [ ] SetpointControl modal opens/closes correctly
- [ ] ModeSelector displays all 3 modes
- [ ] EditScheduleModal loads with interval data
- [ ] AddProgramModal displays empty form

### User Interactions
- [ ] Adjust setpoint via slider → saves successfully
- [ ] Adjust setpoint via input → saves successfully
- [ ] Use +/- buttons → updates correctly
- [ ] Change mode → displays toast + mode updates
- [ ] Edit program → modal loads data + saves changes
- [ ] Add program → modal accepts input + creates new
- [ ] Delete program → removes from list

### Error Handling
- [ ] Invalid temperature (< 5 or > 35) → shows error message
- [ ] Duplicate schedule time → shows validation error
- [ ] Network error → shows error toast
- [ ] Loading state → spinner displays during save

### UI/UX
- [ ] Dark mode toggles work on all modals
- [ ] All text is readable on both light/dark backgrounds
- [ ] Buttons are properly disabled during loading
- [ ] Error messages are clear and actionable
- [ ] Toast notifications appear with proper timing

---

## Common Issues & Fixes

### Issue: Modal won't close after save
**Fix**: Ensure mutation onSuccess calls `setModalVisible(false)`

### Issue: Data not updating after save
**Fix**: Ensure mutation onSuccess calls `queryClient.invalidateQueries(['heatingSummary', homeId])`

### Issue: Duplicate edit/delete requests
**Fix**: Disable button while mutation is in progress: `isDisabled={mutation.isLoading}`

### Issue: Setpoint slider not updating state
**Fix**: Use `onChangeEnd` callback, not `onChange` (onChangeEnd fires after drag stops)

### Issue: Time picker shows wrong format
**Fix**: Ensure minutesToTime() helper is correct: `hours*60 + mins`

### Issue: Mode selector not showing correct current mode
**Fix**: Ensure heatingData returns mode as string matching enum ('PROGRAM', 'MANUAL', 'OFF')

---

## Code Quality Checklist

- [ ] All mutations have error handling
- [ ] All mutations invalidate correct cache keys
- [ ] All modals have loading states
- [ ] All inputs have validation
- [ ] All async calls have try/catch
- [ ] Component props are fully typed
- [ ] No console.log() statements in production code
- [ ] All TODOs are documented

---

## Success Criteria (End of Day 3)

✅ All 4 modals render correctly in HeatingScreen
✅ All mutations wire correctly to API client
✅ All user interactions work end-to-end
✅ All error states display properly
✅ Manual testing passes all scenarios
✅ Ready for QA testing on Day 4

---

## Timeline Estimate

- Imports & state setup: 15 minutes
- Mutations setup: 30 minutes
- Button/display updates: 30 minutes
- Modal rendering: 15 minutes
- Testing & debugging: 30 minutes
- **Total**: ~2 hours (leaving 6 hours for refinement/troubleshooting)

---

**Date Created**: February 5, 2026
**Last Updated**: February 5, 2026
