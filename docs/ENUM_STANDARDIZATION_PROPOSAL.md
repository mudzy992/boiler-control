# HomeProfile Enum Standardization Proposal

**Date:** February 3, 2026
**Status:** Proposal - Ready for Implementation
**Priority:** CRITICAL - Affects Flow Temperature Calculations

## Executive Summary

The HomeProfile model has inconsistent enum values for `insulationType` and `windowType` across the database, backend, frontend, and mobile apps. These fields directly impact the flow-temperature calculation algorithm, which is the core of daily heating recommendations. Standardizing these enums is essential for:

- **Consistent calculations** across all platforms
- **Data integrity** in the database
- **Maintainability** of the calculation strategies
- **User experience** with predictable heating behavior

## Current State Analysis

### Problem 1: insulationType Inconsistency

**Database Storage:**
- Current values in database: `"EPS"`, `"Wool"`, `"standard"`, etc.

**Backend Calculation (profile.strategy.ts):**
```typescript
if (input.homeProfile?.insulationType === 'EPS') insulationFactor = 0.9;
else if (input.homeProfile?.insulationType === 'Wool') insulationFactor = 0.85;
```
- Expects: `'EPS'`, `'Wool'`
- Uses hardcoded string comparison

**Mobile App Form (HomeManagementScreen.tsx):**
```typescript
<Select.Item label="Standard" value="standard" />
<Select.Item label="EPS (Styrofoam)" value="eps" />
<Select.Item label="Mineral Wool" value="wool" />
<Select.Item label="Advanced (PIR/PUR)" value="advanced" />
```
- Sends: `'standard'`, `'eps'`, `'wool'`, `'advanced'` (lowercase)
- **MISMATCH**: Backend expects `'EPS'`, `'Wool'` but mobile sends `'eps'`, `'wool'`

**Web App Form (HomeProfilePage.tsx):**
- Not fully implemented yet, uses legacy field names like `insulationLevel`

---

### Problem 2: windowType Inconsistency

**Database Storage:**
- Current values: `"DOUBLE"`, `"TRIPLE"` (from migration)

**Backend Calculation (profile.strategy.ts):**
```typescript
if (input.homeProfile?.windowType === 'TRIPLE') windowFactor = -1;
else if (input.homeProfile?.windowType === 'DOUBLE') windowFactor = 0;
```
- Expects: `'TRIPLE'`, `'DOUBLE'` (uppercase)

**Mobile App Form:**
```typescript
<Select.Item label="Single Pane" value="single" />
<Select.Item label="Double Glazed (PVC)" value="double" />
<Select.Item label="Triple Glazed" value="triple" />
```
- Sends: `'single'`, `'double'`, `'triple'` (lowercase)
- **MISMATCH**: Backend expects `'DOUBLE'`, `'TRIPLE'` (uppercase) but mobile sends lowercase

---

### Problem 3: heatingType Inconsistency

**Database Storage:**
- Current values: `"radiator"`, `"podno"` (Croatian for "underfloor"), `"mixed"`

**Backend Calculation (profile.strategy.ts):**
```typescript
const heatingFactor = input.homeProfile?.heatingType === 'podno' ? -2 : 0;
```
- Expects: `'podno'` (Croatian term)

**Mobile App Form:**
```typescript
<Select.Item label="Radiators" value="radiator" />
<Select.Item label="Underfloor Heating" value="floor" />
<Select.Item label="Mixed (Both)" value="mixed" />
```
- Sends: `'radiator'`, `'floor'`, `'mixed'` (English term for underfloor)
- **MISMATCH**: Backend expects `'podno'` but mobile sends `'floor'`

---

## Impact on Flow Temperature Calculation

The flow temperature (`flowTemp`) is calculated using the formula:

```
flowTemp = baseTemp + areaFactor + heightFactor + (insulationFactor × baseOffset) + windowFactor + heatingFactor + confidence
```

### How insulationType Affects Calculation

The `insulationFactor` multiplier ranges from **0.7 to 1.0** based on insulation quality:

| Insulation Type | Factor | Impact |
|-----------------|--------|--------|
| Poor/None | 1.0 | Full calculation (requires higher flow temp) |
| Standard | 0.95 | Slight reduction |
| EPS (Styrofoam) | 0.9 | 10% reduction in offset |
| Wool (Mineral) | 0.85 | 15% reduction in offset |
| Advanced (PIR/PUR) | 0.8 | 20% reduction (best insulation) |

**Example:** If base offset is 5°C and confidence is 0.8:
- Poor insulation: 5 × 1.0 × 0.8 = **4.0°C addition**
- EPS insulation: 5 × 0.9 × 0.8 = **3.6°C addition**
- Wool insulation: 5 × 0.85 × 0.8 = **3.4°C addition**

A mismatch here means the boiler either **overheats** (wastes fuel) or **underheats** (insufficient comfort).

### How windowType Affects Calculation

The `windowFactor` directly adjusts flow temperature:

| Window Type | Factor | Impact |
|-------------|--------|--------|
| Single Pane | +2.0 | Large heat loss - requires higher flow temp |
| Double Glazed | 0.0 | Baseline (no adjustment) |
| Triple Glazed | -1.0 | Better insulation - can reduce flow temp |

**Example:** If area factor is 2°C and window factor is applied:
- Single pane windows: adds +2°C to flow temp
- Double glazed: no adjustment
- Triple glazed: reduces by -1°C (more efficient)

A mismatch here causes **significant heating efficiency problems**.

### How heatingType Affects Calculation

The `heatingFactor` accounts for heating system responsiveness:

| Heating Type | Factor | Impact |
|--------------|--------|--------|
| Radiator (convection) | 0 | Standard calculation |
| Underfloor (large mass) | -2 | Lower flow temp needed (slower but more stable) |
| Mixed | -1 | Intermediate response |

---

## Proposed Solution: Canonical Enum Values

### 1. InsulationType Enum

```typescript
enum InsulationType {
  SINGLE_PANE = "SINGLE_PANE"
  STANDARD = "STANDARD"           // 5-8cm basic foam
  EPS = "EPS"                     // Expanded Polystyrene, 8-12cm
  MINERAL_WOOL = "MINERAL_WOOL"   // 8-12cm mineral/rock wool
  ADVANCED = "ADVANCED"           // PIR/PUR high-performance, 6-8cm
}
```

**Standardization Rules:**
- All values use **UPPERCASE_SNAKE_CASE**
- Consistency across database, backend, frontend, and mobile
- Database stores enum values directly (no string conversion needed)

**Mapping from Current Values:**
- `'standard'` (mobile) → `'STANDARD'` (canonical)
- `'eps'` (mobile) → `'EPS'` (canonical)
- `'wool'` (mobile) → `'MINERAL_WOOL'` (canonical)
- `'advanced'` (mobile) → `'ADVANCED'` (canonical)

---

### 2. WindowType Enum

```typescript
enum WindowType {
  SINGLE_GLAZED = "SINGLE_GLAZED"
  DOUBLE_GLAZED = "DOUBLE_GLAZED"
  TRIPLE_GLAZED = "TRIPLE_GLAZED"
}
```

**Standardization Rules:**
- All values use **UPPERCASE_SNAKE_CASE**
- Replaces both `'DOUBLE'`/`'TRIPLE'` (database) and `'single'`/`'double'`/`'triple'` (mobile)

**Mapping from Current Values:**
- `'SINGLE'` or `'single'` → `'SINGLE_GLAZED'` (canonical)
- `'DOUBLE'` or `'double'` → `'DOUBLE_GLAZED'` (canonical)
- `'TRIPLE'` or `'triple'` → `'TRIPLE_GLAZED'` (canonical)

---

### 3. HeatingType Enum

```typescript
enum HeatingType {
  RADIATOR = "RADIATOR"
  UNDERFLOOR = "UNDERFLOOR"
  MIXED = "MIXED"
}
```

**Standardization Rules:**
- All values use **UPPERCASE_SNAKE_CASE**
- Replaces `'podno'` (Croatian backend term) and `'floor'` (English mobile term)

**Mapping from Current Values:**
- `'radiator'` (mobile) → `'RADIATOR'` (canonical)
- `'floor'` or `'podno'` → `'UNDERFLOOR'` (canonical)
- `'mixed'` (mobile) → `'MIXED'` (canonical)

---

## Implementation Plan

### Phase 1: Backend Foundation (Database + DTOs)

**Step 1.1:** Add Prisma enums to `backend/prisma/schema.prisma`
```prisma
enum InsulationType {
  SINGLE_PANE
  STANDARD
  EPS
  MINERAL_WOOL
  ADVANCED
}

enum WindowType {
  SINGLE_GLAZED
  DOUBLE_GLAZED
  TRIPLE_GLAZED
}

enum HeatingType {
  RADIATOR
  UNDERFLOOR
  MIXED
}
```

**Step 1.2:** Update HomeProfile model fields
```prisma
model HomeProfile {
  insulationType      InsulationType   // Changed from String
  windowType          WindowType       // Changed from String
  heatingType         HeatingType      // Changed from String
  // ... rest of fields
}
```

**Step 1.3:** Create and apply migration
```bash
npx prisma migrate dev --name "standardize_home_profile_enums"
```

**Step 1.4:** Update DTOs to use enum types
- `backend/src/modules/HomeProfile/dto/create-home-profile.dto.ts`
- `backend/src/modules/HomeProfile/dto/update-home-profile.dto.ts`

```typescript
import { InsulationType, WindowType, HeatingType } from '@prisma/client';

export class CreateHomeProfileDto {
  insulationType: InsulationType;
  windowType: WindowType;
  heatingType: HeatingType;
  // ... other fields
}
```

---

### Phase 2: Backend Logic Updates

**Step 2.1:** Update calculation strategies
- `backend/src/modules/Heating/strategies/profile.strategy.ts`
- Use enum comparisons instead of string comparisons

```typescript
import { InsulationType, WindowType, HeatingType } from '@prisma/client';

protected calculateFactors(input: FlowTempInput): number {
  // Use enum values with proper typing
  let windowFactor = 0;
  if (input.homeProfile?.windowType === WindowType.TRIPLE_GLAZED) windowFactor = -1;
  else if (input.homeProfile?.windowType === WindowType.DOUBLE_GLAZED) windowFactor = 0;
  else if (input.homeProfile?.windowType === WindowType.SINGLE_GLAZED) windowFactor = 2;

  const heatingFactor = input.homeProfile?.heatingType === HeatingType.UNDERFLOOR ? -2 : 0;

  return areaFactor + heightFactor + windowFactor + heatingFactor;
}

protected getInsulationFactor(input: FlowTempInput): number {
  let insulationFactor = 1.0;
  if (input.homeProfile?.insulationType === InsulationType.EPS) insulationFactor = 0.9;
  else if (input.homeProfile?.insulationType === InsulationType.MINERAL_WOOL) insulationFactor = 0.85;
  else if (input.homeProfile?.insulationType === InsulationType.ADVANCED) insulationFactor = 0.8;
  return Math.max(0.7, Math.min(1, insulationFactor));
}
```

**Step 2.2:** Update HomeProfile service mappings
- `backend/src/modules/HomeProfile/home.profile.service.ts`
- Handle input validation and enum mapping

```typescript
async create(userId: number, dto: CreateHomeProfileDto) {
  // Validate enum values
  if (!Object.values(InsulationType).includes(dto.insulationType)) {
    throw new BadRequestException('Invalid insulationType');
  }
  if (!Object.values(WindowType).includes(dto.windowType)) {
    throw new BadRequestException('Invalid windowType');
  }
  if (!Object.values(HeatingType).includes(dto.heatingType)) {
    throw new BadRequestException('Invalid heatingType');
  }

  return this.prisma.homeProfile.create({
    data: {
      userId,
      insulationType: dto.insulationType,
      windowType: dto.windowType,
      heatingType: dto.heatingType,
      // ... other fields
    },
  });
}
```

**Step 2.3:** Create TypeScript constants for frontend use
- `backend/src/modules/HomeProfile/enums/home-profile.enums.ts`

```typescript
export const INSULATION_TYPES = {
  SINGLE_PANE: 'SINGLE_PANE',
  STANDARD: 'STANDARD',
  EPS: 'EPS',
  MINERAL_WOOL: 'MINERAL_WOOL',
  ADVANCED: 'ADVANCED',
} as const;

export const WINDOW_TYPES = {
  SINGLE_GLAZED: 'SINGLE_GLAZED',
  DOUBLE_GLAZED: 'DOUBLE_GLAZED',
  TRIPLE_GLAZED: 'TRIPLE_GLAZED',
} as const;

export const HEATING_TYPES = {
  RADIATOR: 'RADIATOR',
  UNDERFLOOR: 'UNDERFLOOR',
  MIXED: 'MIXED',
} as const;

export type InsulationType = typeof INSULATION_TYPES[keyof typeof INSULATION_TYPES];
export type WindowType = typeof WINDOW_TYPES[keyof typeof WINDOW_TYPES];
export type HeatingType = typeof HEATING_TYPES[keyof typeof HEATING_TYPES];
```

---

### Phase 3: Frontend Updates

**Step 3.1:** Create shared enum constants for React app
- `apps/web/src/constants/homeProfileEnums.ts`

```typescript
export const INSULATION_TYPE_OPTIONS = [
  { label: 'Single Pane', value: 'SINGLE_PANE' },
  { label: 'Standard (5-8cm foam)', value: 'STANDARD' },
  { label: 'EPS Styrofoam (8-12cm)', value: 'EPS' },
  { label: 'Mineral Wool (8-12cm)', value: 'MINERAL_WOOL' },
  { label: 'Advanced PIR/PUR (6-8cm)', value: 'ADVANCED' },
];

export const WINDOW_TYPE_OPTIONS = [
  { label: 'Single Glazed', value: 'SINGLE_GLAZED' },
  { label: 'Double Glazed (PVC)', value: 'DOUBLE_GLAZED' },
  { label: 'Triple Glazed', value: 'TRIPLE_GLAZED' },
];

export const HEATING_TYPE_OPTIONS = [
  { label: 'Radiators', value: 'RADIATOR' },
  { label: 'Underfloor Heating', value: 'UNDERFLOOR' },
  { label: 'Mixed (Both)', value: 'MIXED' },
];
```

**Step 3.2:** Update Web API DTOs
- `apps/web/src/api/homeProfile.api.ts`

```typescript
export interface CreateHomeProfileDto {
  insulationType: 'SINGLE_PANE' | 'STANDARD' | 'EPS' | 'MINERAL_WOOL' | 'ADVANCED';
  windowType: 'SINGLE_GLAZED' | 'DOUBLE_GLAZED' | 'TRIPLE_GLAZED';
  heatingType: 'RADIATOR' | 'UNDERFLOOR' | 'MIXED';
  // ... other fields
}
```

**Step 3.3:** Update HomeProfilePage form
- `apps/web/src/pages/HomeProfilePage.tsx`

```typescript
// Use enum values directly from constants
<Select
  name="insulationType"
  options={INSULATION_TYPE_OPTIONS}
  rules={[{ required: true, message: 'Please select insulation type' }]}
/>
```

---

### Phase 4: Mobile App Updates

**Step 4.1:** Create shared enum constants for React Native
- `apps/mobile/src/constants/homeProfileEnums.ts`

```typescript
export const INSULATION_TYPE_OPTIONS = [
  { label: 'Standard', value: 'STANDARD' },
  { label: 'EPS (Styrofoam)', value: 'EPS' },
  { label: 'Mineral Wool', value: 'MINERAL_WOOL' },
  { label: 'Advanced (PIR/PUR)', value: 'ADVANCED' },
];

export const WINDOW_TYPE_OPTIONS = [
  { label: 'Single Pane', value: 'SINGLE_GLAZED' },
  { label: 'Double Glazed (PVC)', value: 'DOUBLE_GLAZED' },
  { label: 'Triple Glazed', value: 'TRIPLE_GLAZED' },
];

export const HEATING_TYPE_OPTIONS = [
  { label: 'Radiators', value: 'RADIATOR' },
  { label: 'Underfloor Heating', value: 'UNDERFLOOR' },
  { label: 'Mixed (Both)', value: 'MIXED' },
];
```

**Step 4.2:** Update Mobile API DTOs
- `apps/mobile/src/services/api/homeProfile.api.ts`

```typescript
export interface CreateHomeProfileDto {
  insulationType: 'SINGLE_PANE' | 'STANDARD' | 'EPS' | 'MINERAL_WOOL' | 'ADVANCED';
  windowType: 'SINGLE_GLAZED' | 'DOUBLE_GLAZED' | 'TRIPLE_GLAZED';
  heatingType: 'RADIATOR' | 'UNDERFLOOR' | 'MIXED';
  // ... other fields
}
```

**Step 4.3:** Update HomeManagementScreen form
- `apps/mobile/src/screens/home/HomeManagementScreen.tsx`

```typescript
// Use enum values from constants
<Select
  selectedValue={formData.insulationType}
  onValueChange={(value) => setFormData({ ...formData, insulationType: value })}
>
  {INSULATION_TYPE_OPTIONS.map((opt) => (
    <Select.Item key={opt.value} label={opt.label} value={opt.value} />
  ))}
</Select>
```

---

### Phase 5: Data Migration (Optional - If needed)

If existing data needs to be migrated to new enum values:

```prisma
// In a new migration file
-- Rename old column
ALTER TABLE HomeProfile RENAME COLUMN insulationType TO insulationType_old;

-- Create new column with enum type
ALTER TABLE HomeProfile ADD COLUMN insulationType InsulationType;

-- Migrate data
UPDATE HomeProfile SET insulationType = CASE
  WHEN insulationType_old = 'eps' THEN 'EPS'
  WHEN insulationType_old = 'wool' THEN 'MINERAL_WOOL'
  WHEN insulationType_old = 'standard' THEN 'STANDARD'
  ELSE 'STANDARD'
END;

-- Drop old column
ALTER TABLE HomeProfile DROP COLUMN insulationType_old;
```

---

## Benefits of Standardization

1. **Type Safety:** TypeScript compiler prevents invalid enum values
2. **Database Integrity:** MySQL enforces enum constraints at the database level
3. **Calculation Accuracy:** Flow-temperature algorithm gets consistent inputs
4. **Maintainability:** Single source of truth for enum definitions
5. **User Experience:** Consistent heating behavior across all platforms
6. **Reduced Bugs:** No more string comparison errors or case mismatches

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Data migration breaking existing profiles | Create comprehensive migration with rollback plan |
| Calculation logic changes | Extensive testing of heating strategy algorithms |
| Frontend/Mobile breaking changes | Coordinate releases with feature flags if needed |
| Database inconsistency | Use transactions and validate all updates |

---

## Testing Checklist

- [ ] Prisma migration applies successfully
- [ ] Backend DTOs validate enum values correctly
- [ ] Flow-temp calculation returns same results as before (with enum values)
- [ ] Web app displays form selectors correctly
- [ ] Mobile app displays form selectors correctly
- [ ] Creating new HomeProfile persists enum values correctly
- [ ] Updating HomeProfile with new enum values works
- [ ] API responses contain correct enum values
- [ ] Calculation strategies use correct enum values
- [ ] Database contains valid enum values
- [ ] No TypeScript compilation errors

---

## Timeline

- **Day 1:** Implement Phase 1-2 (Backend foundation + logic)
- **Day 2:** Implement Phase 3 (Web frontend)
- **Day 2-3:** Implement Phase 4 (Mobile frontend)
- **Day 3:** Testing and validation

**Total Effort:** ~8-12 hours of development + testing

---

## Conclusion

This standardization is **critical for system accuracy** and should be prioritized. The enum values directly impact the heating recommendations that users receive, so any inconsistency in these fields can result in:

- **Higher heating costs** (unnecessarily hot water)
- **Reduced comfort** (insufficiently heated spaces)
- **Unreliable recommendations** (inconsistent calculations)

By standardizing these enums across all layers of the application, we ensure that the flow-temperature calculation algorithm works as designed and users receive optimal heating recommendations.
