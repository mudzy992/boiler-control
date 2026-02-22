# Home Profile Management - Complete Implementation Proposal

## Executive Summary

The current HomeProfile management system has **basic CRUD operations** but **incomplete UI forms**. This proposal outlines the gap between current implementation and a complete HomeProfile management system.

---

## 1. Current Implementation Status

### ✅ Backend - FULLY IMPLEMENTED
All necessary endpoints exist and are functional:

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/home-profiles` | GET | List all home profiles | ✅ Working |
| `/home-profiles/:id` | GET | Get single profile | ✅ Working |
| `/home-profiles` | POST | Create new profile | ✅ Working |
| `/home-profiles/:id` | PATCH | Update existing profile | ✅ Working |
| `/home-profiles/:id` | DELETE | Delete profile | ✅ Working |
| `/home-profiles/:id/activate` | PATCH | Set as active home | ✅ Working |

**Backend Data Model (HomeProfile):**
```typescript
{
  id: number;
  userId: number;
  homeName: string | null;
  floorArea: number;              // Square meters (10-2000)
  ceilingHeight: number;          // Meters (default 2.6)
  insulationType: string;         // 'eps', 'wool', 'standard', etc.
  insulationThickness: number;    // cm (10, 12, 15)
  windowType: string;             // 'double', 'triple', 'standard'
  heatingType: string;            // 'radiator', 'floor', 'mixed'
  constructionYear: number;
  numberOfResidents: number | null;
  boilerModel: string | null;
  hasFloorHeating: boolean;
  targetMorningTemp: number;      // °C (5-30)
  targetDayTemp: number;          // °C (5-30)
  targetNightTemp: number;        // °C (5-30)
  preferredScheduleNotes: string | null;
  learningOffset: number;         // AI learning adjustment
  learningConfidence: number;     // 0-1
  seasonMode: 'WINTER' | 'SUMMER';
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### ⚠️ Frontend - PARTIALLY IMPLEMENTED

**What EXISTS:**
- ✅ List view of all home profiles
- ✅ Card UI showing name, location, thermostat count
- ✅ "Add Home" button and modal
- ✅ "Edit Home" button and modal
- ✅ "Delete Home" functionality
- ✅ "Activate Home" tap functionality
- ✅ Active badge indicator

**What's MISSING:**
- ❌ **Forms only collect name + location** (backend needs 10+ fields)
- ❌ No UI for heating parameters (temperatures, insulation, etc.)
- ❌ No validation or error messages
- ❌ No multi-step form for complex data entry
- ❌ No preview/confirmation before save
- ❌ No loading states for individual actions
- ❌ Location field in modal but not saved to HomeProfile (User.homeLocation instead)

---

## 2. Gap Analysis

### Critical Issue: Form Data Mismatch

**Current Implementation:**
```typescript
// Mobile app only collects:
{
  name: string,
  location: string
}

// Then sends hardcoded defaults:
{
  homeName: data.name,
  squareMeters: 100,              // ❌ Hardcoded
  insulationLevel: 'standard',    // ❌ Hardcoded
  windowQuality: 'standard',      // ❌ Hardcoded
  radiatorType: 'radiator',       // ❌ Hardcoded
  hasFloorHeating: false,         // ❌ Hardcoded
  targetMorningTemp: 22,          // ❌ Hardcoded
  targetDayTemp: 20,              // ❌ Hardcoded
  targetNightTemp: 18,            // ❌ Hardcoded
}
```

**Required Implementation:**
User should be able to input ALL fields that affect heating calculations.

---

## 3. Proposed Solution - Complete HomeProfile Form

### A. UI/UX Design - Multi-Step Form Approach

**Why Multi-Step?**
- 13+ fields is overwhelming in one screen
- Logical grouping improves UX
- Progressive disclosure reduces cognitive load
- Mobile-friendly (one concept at a time)

**Proposed Flow:**

#### Step 1: Basic Information
```
┌─────────────────────────────────┐
│  Add New Home (1/4)             │
│  Basic Information              │
├─────────────────────────────────┤
│                                 │
│  Home Name *                    │
│  [Main House            ]       │
│                                 │
│  Square Meters *                │
│  [100                   ] m²    │
│                                 │
│  Ceiling Height                 │
│  [2.6                   ] m     │
│                                 │
│  Number of Residents            │
│  [2                     ]       │
│                                 │
│  Construction Year              │
│  [2015                  ]       │
│                                 │
│  [Cancel]         [Next →]      │
└─────────────────────────────────┘
```

#### Step 2: Insulation & Structure
```
┌─────────────────────────────────┐
│  Add New Home (2/4)             │
│  Insulation & Windows           │
├─────────────────────────────────┤
│                                 │
│  Insulation Type *              │
│  ○ Standard                     │
│  ○ EPS (Styrofoam)             │
│  ● Mineral Wool                 │
│  ○ Advanced (PIR/PUR)          │
│                                 │
│  Insulation Thickness           │
│  ○ 10 cm  ● 12 cm  ○ 15 cm     │
│                                 │
│  Window Quality *               │
│  ○ Single pane                  │
│  ● Double glazed (PVC)          │
│  ○ Triple glazed                │
│                                 │
│  [← Back]          [Next →]     │
└─────────────────────────────────┘
```

#### Step 3: Heating System
```
┌─────────────────────────────────┐
│  Add New Home (3/4)             │
│  Heating System                 │
├─────────────────────────────────┤
│                                 │
│  Heating Type *                 │
│  ● Radiators                    │
│  ○ Underfloor heating          │
│  ○ Mixed (both)                │
│                                 │
│  Floor Heating                  │
│  [✓] Has floor heating zones    │
│                                 │
│  Boiler Model (Optional)        │
│  [Viessmann Vitodens 100]       │
│                                 │
│  [← Back]          [Next →]     │
└─────────────────────────────────┘
```

#### Step 4: Temperature Preferences
```
┌─────────────────────────────────┐
│  Add New Home (4/4)             │
│  Temperature Preferences        │
├─────────────────────────────────┤
│                                 │
│  Morning Target (6:00-10:00)    │
│  [22]°C   [━━━━━●━━━━━━]       │
│                                 │
│  Day Target (10:00-18:00)       │
│  [20]°C   [━━━━━●━━━━━━]       │
│                                 │
│  Night Target (22:00-6:00)      │
│  [18]°C   [━━━━●━━━━━━━]       │
│                                 │
│  Notes (Optional)               │
│  [Multiple lines of text...  ]  │
│                                 │
│  [← Back]     [Create Home]     │
└─────────────────────────────────┘
```

#### Step 5: Confirmation & Summary
```
┌─────────────────────────────────┐
│  Review Your Home               │
├─────────────────────────────────┤
│  📍 Main House                  │
│  📐 100 m² • 2.6m ceiling       │
│  🏠 2 residents • Built 2015    │
│                                 │
│  Insulation                     │
│  • Mineral Wool, 12cm           │
│  • Double glazed windows        │
│                                 │
│  Heating                        │
│  • Radiators                    │
│  • Viessmann Vitodens 100       │
│                                 │
│  Temperatures                   │
│  • Morning: 22°C                │
│  • Day: 20°C                    │
│  • Night: 18°C                  │
│                                 │
│  [← Edit]    [✓ Confirm]        │
└─────────────────────────────────┘
```

### B. Alternative: Simplified Single-Form Approach

For users who want quick setup, provide a "Quick Setup" mode:

```
┌─────────────────────────────────┐
│  Quick Home Setup               │
├─────────────────────────────────┤
│                                 │
│  Home Name *                    │
│  [Main House            ]       │
│                                 │
│  Size (m²) *                    │
│  [100                   ]       │
│                                 │
│  Insulation *                   │
│  [Standard ▼]                   │
│                                 │
│  Heating Type *                 │
│  [Radiators ▼]                  │
│                                 │
│  [Advanced Options ▼]           │
│                                 │
│  [Cancel]    [Create Home]      │
└─────────────────────────────────┘

Tap "Advanced Options" to expand all fields
```

---

## 4. Implementation Checklist

### Phase 1: Enhanced Basic Form (Quick Win)
**Goal:** Replace hardcoded values with user input

- [ ] Update `HomeManagementScreen` Add/Edit modals
- [ ] Add form fields:
  - [ ] Square meters (number input, 10-2000)
  - [ ] Insulation type (select: standard, eps, wool, advanced)
  - [ ] Window type (select: single, double, triple)
  - [ ] Heating type (select: radiator, floor, mixed)
  - [ ] Temperature sliders (morning/day/night: 5-30°C)
- [ ] Update form validation
- [ ] Update mutation to send all collected data
- [ ] Add error handling and user feedback

**Estimated Time:** 2-3 hours

### Phase 2: Multi-Step Wizard (Better UX)
**Goal:** Professional multi-step form experience

- [ ] Create `HomeProfileWizard` component
- [ ] Implement step navigation (Next/Back)
- [ ] Create step components:
  - [ ] `BasicInfoStep.tsx`
  - [ ] `InsulationStep.tsx`
  - [ ] `HeatingSystemStep.tsx`
  - [ ] `TemperaturePreferencesStep.tsx`
  - [ ] `SummaryStep.tsx`
- [ ] Add progress indicator
- [ ] Form state management (React Hook Form or local state)
- [ ] Validation per step
- [ ] Summary/review screen before submission

**Estimated Time:** 4-6 hours

### Phase 3: Edit Functionality Enhancement
**Goal:** Edit existing homes with pre-filled forms

- [ ] Fetch full HomeProfile data when editing
- [ ] Pre-populate all form fields
- [ ] Support partial updates (PATCH)
- [ ] Add "Revert Changes" option
- [ ] Show what changed in confirmation

**Estimated Time:** 2-3 hours

### Phase 4: Advanced Features
**Goal:** Professional-grade home management

- [ ] **Duplicate Home** - Clone existing profile
- [ ] **Import/Export** - Share configurations
- [ ] **Templates** - Pre-configured home types
  - Small Apartment (50m², standard insulation)
  - Family House (150m², good insulation)
  - Old Building (100m², poor insulation)
- [ ] **Validation Warnings** - "Your home seems large, is 100m² correct?"
- [ ] **AI Suggestions** - "Based on your home, we recommend..."
- [ ] **Energy Calculator** - Estimate heating costs preview

**Estimated Time:** 8-10 hours

---

## 5. API Completeness Review

### Current Backend API - Assessment

| Feature | Endpoint | Status | Notes |
|---------|----------|--------|-------|
| List homes | GET `/home-profiles` | ✅ Complete | Returns all fields + computed |
| Get one home | GET `/home-profiles/:id` | ✅ Complete | Full details |
| Create home | POST `/home-profiles` | ✅ Complete | Accepts all DTO fields |
| Update home | PATCH `/home-profiles/:id` | ✅ Complete | Partial updates supported |
| Delete home | DELETE `/home-profiles/:id` | ✅ Complete | Ownership verified |
| Activate home | PATCH `/home-profiles/:id/activate` | ⚠️ Functional* | *Placeholder - no DB field yet |

**Missing Backend Features:**

1. **Active Home Persistence**
   - Current: `isActive` computed as "first profile"
   - Needed: `User.activeHomeProfileId` field
   - Migration required: Add nullable `activeHomeProfileId` to User table
   - Update activate endpoint to persist choice

2. **Validation Enhancements**
   - Add business logic validation (e.g., floorArea vs numberOfResidents sanity check)
   - Cross-field validation (hasFloorHeating but heatingType='radiator')

3. **Computed Fields**
   - Total volume (floorArea × ceilingHeight)
   - Thermal efficiency score
   - Estimated heating cost

---

## 6. Data Model Enhancements Needed

### 6.1 User Model Addition
**Current:** User has `homeLocation` (one location for all homes)
**Problem:** Each home can be in different location
**Solution:**

**Option A:** Add `location` field to HomeProfile
```prisma
model HomeProfile {
  // ... existing fields
  location      String?   // City, Country
  latitude      Float?    // For weather integration
  longitude     Float?
}
```

**Option B:** Keep User.homeLocation for primary, allow override per profile

### 6.2 Active Home Tracking
```prisma
model User {
  // ... existing fields
  activeHomeProfileId Int?
  activeHomeProfile   HomeProfile? @relation("ActiveHome", fields: [activeHomeProfileId], references: [id])
}
```

Then update activate endpoint:
```typescript
async activate(userId: number, homeProfileId: number) {
  // Update user's active home
  await this.prisma.user.update({
    where: { id: userId },
    data: { activeHomeProfileId: homeProfileId }
  });

  return this.findOne(userId, homeProfileId);
}
```

---

## 7. Mobile UI Component Specifications

### Component Architecture

```
HomeManagementScreen (current)
├── HomeCard (current)
└── Modals
    ├── AddHomeModal (needs replacement)
    └── EditHomeModal (needs replacement)

Proposed Structure:
HomeManagementScreen
├── HomeCard (keep as-is)
└── HomeProfileWizard (NEW)
    ├── WizardStepIndicator
    ├── BasicInfoStep
    ├── InsulationStep
    ├── HeatingSystemStep
    ├── TemperaturePreferencesStep
    └── SummaryStep
```

### Reusable Form Components to Create

```typescript
// src/components/homeProfile/FormFields.tsx
export const SquareMetersInput = ({ value, onChange }) => {...}
export const InsulationTypePicker = ({ value, onChange }) => {...}
export const WindowQualityPicker = ({ value, onChange }) => {...}
export const HeatingTypePicker = ({ value, onChange }) => {...}
export const TemperatureSlider = ({ label, value, onChange }) => {...}
export const ResidentsCounter = ({ value, onChange }) => {...}
```

---

## 8. Validation Rules

### Frontend Validation
```typescript
const validationSchema = {
  homeName: {
    required: false,
    maxLength: 100,
    default: 'Unnamed Home'
  },
  squareMeters: {
    required: true,
    min: 10,
    max: 2000,
    type: 'number',
    errorMsg: 'Enter a valid area between 10-2000 m²'
  },
  insulationLevel: {
    required: true,
    enum: ['standard', 'eps', 'wool', 'advanced'],
    errorMsg: 'Select insulation type'
  },
  windowQuality: {
    required: true,
    enum: ['single', 'double', 'triple'],
    errorMsg: 'Select window type'
  },
  radiatorType: {
    required: true,
    enum: ['radiator', 'floor', 'mixed'],
    errorMsg: 'Select heating type'
  },
  targetMorningTemp: {
    required: true,
    min: 5,
    max: 30,
    type: 'number',
    errorMsg: 'Temperature must be between 5-30°C'
  },
  // ... same for day/night temps
  numberOfResidents: {
    required: false,
    min: 1,
    max: 20,
    type: 'number'
  },
  ceilingHeight: {
    required: false,
    min: 2.0,
    max: 4.0,
    default: 2.6,
    type: 'number'
  }
}
```

### Backend Validation (Already Exists)
✅ Class-validator decorators in DTOs handle all validation

---

## 9. Error Handling & User Feedback

### Success Messages
- ✅ "Home created successfully"
- ✅ "Home updated successfully"
- ✅ "Home deleted successfully"
- ✅ "Active home switched to [name]"

### Error Scenarios
- ❌ Network timeout → "Connection error. Please try again."
- ❌ Validation failed → Show specific field errors
- ❌ Duplicate name → "A home with this name already exists"
- ❌ Cannot delete active home → "Cannot delete active home. Switch to another home first."
- ❌ Cannot delete last home → "You must have at least one home profile."

---

## 10. Recommended Implementation Order

### Sprint 1: Basic Functionality (Current → Complete)
**Duration:** 1-2 days

1. ✅ Fix API endpoints (DONE)
2. ✅ Add activate endpoint (DONE)
3. ✅ Show correct data in list (DONE)
4. 🔄 **Next:** Add full form fields to Add/Edit modals
5. 🔄 Remove hardcoded defaults
6. 🔄 Test full CRUD cycle

**Deliverable:** Functional but simple home management with all fields

### Sprint 2: Enhanced UX
**Duration:** 2-3 days

1. Create multi-step wizard
2. Add validation and error messages
3. Add confirmation/summary screen
4. Improve visual design
5. Add loading states

**Deliverable:** Professional multi-step form experience

### Sprint 3: Advanced Features
**Duration:** 2-3 days

1. Add database migration for User.activeHomeProfileId
2. Persist active home selection
3. Add home templates
4. Add duplicate functionality
5. Add AI suggestions / energy estimates

**Deliverable:** Production-ready home management system

---

## 11. Testing Checklist

### Functional Tests
- [ ] Create home with minimal data (only required fields)
- [ ] Create home with all fields populated
- [ ] Edit existing home (change each field)
- [ ] Delete non-active home
- [ ] Attempt to delete active home (should fail or require switch)
- [ ] Switch active home
- [ ] Create multiple homes
- [ ] Navigate through multi-step wizard (Next/Back)
- [ ] Cancel during creation (data cleared)
- [ ] Validation errors display correctly
- [ ] Success messages appear

### Edge Cases
- [ ] Very large floorArea (1999 m²)
- [ ] Very small floorArea (10 m²)
- [ ] Very high temp (30°C)
- [ ] Very low temp (5°C)
- [ ] Empty optional fields (saved as null)
- [ ] Special characters in home name
- [ ] Long home name (>50 chars)
- [ ] Simultaneous edit from two devices

### Backend Tests
- [ ] Validate DTO constraints enforced
- [ ] Ownership checks prevent cross-user access
- [ ] Partial updates (PATCH) work correctly
- [ ] Activate switches between homes correctly
- [ ] Delete cascades properly (or prevents if thermostats exist)

---

## 12. Summary & Recommendations

### Current State: 70% Complete
✅ Backend fully functional
✅ Basic UI list and navigation working
❌ Forms incomplete (collecting 10% of needed data)

### Priority 1: Complete the Forms (Do This Now)
**Impact:** High | **Effort:** Low
- Replace simple name/location modal with full form
- Add all required fields as inputs/pickers
- Remove hardcoded defaults

### Priority 2: Add Multi-Step Wizard (Nice to Have)
**Impact:** Medium | **Effort:** Medium
- Better UX but not critical for functionality
- Can be done after basic forms work

### Priority 3: Persist Active Home (Technical Debt)
**Impact:** Medium | **Effort:** Low
- Currently first home is always "active"
- Add migration for User.activeHomeProfileId
- Update activate endpoint

### What NOT to Do (Yet)
- ❌ Home templates (nice but not essential)
- ❌ Energy calculators (requires additional data/APIs)
- ❌ Import/export (edge case feature)
- ❌ AI suggestions (future enhancement)

---

## 13. Code Snippets for Quick Implementation

### A. Enhanced Modal Form (Quick Fix)

```typescript
// Update HomeManagementScreen modal body:
<Modal.Body>
  <VStack space={3}>
    <FormControl isRequired>
      <FormControl.Label>Home Name</FormControl.Label>
      <Input value={formData.homeName} onChangeText={(v) => setFormData({...formData, homeName: v})} />
    </FormControl>

    <FormControl isRequired>
      <FormControl.Label>Square Meters</FormControl.Label>
      <Input
        keyboardType="numeric"
        value={formData.squareMeters?.toString()}
        onChangeText={(v) => setFormData({...formData, squareMeters: parseFloat(v)})}
      />
    </FormControl>

    <FormControl isRequired>
      <FormControl.Label>Insulation Type</FormControl.Label>
      <Select
        selectedValue={formData.insulationLevel}
        onValueChange={(v) => setFormData({...formData, insulationLevel: v})}
      >
        <Select.Item label="Standard" value="standard" />
        <Select.Item label="EPS (Styrofoam)" value="eps" />
        <Select.Item label="Mineral Wool" value="wool" />
        <Select.Item label="Advanced (PIR/PUR)" value="advanced" />
      </Select>
    </FormControl>

    <FormControl isRequired>
      <FormControl.Label>Window Quality</FormControl.Label>
      <Select
        selectedValue={formData.windowQuality}
        onValueChange={(v) => setFormData({...formData, windowQuality: v})}
      >
        <Select.Item label="Single Pane" value="single" />
        <Select.Item label="Double Glazed" value="double" />
        <Select.Item label="Triple Glazed" value="triple" />
      </Select>
    </FormControl>

    <FormControl isRequired>
      <FormControl.Label>Heating Type</FormControl.Label>
      <Select
        selectedValue={formData.radiatorType}
        onValueChange={(v) => setFormData({...formData, radiatorType: v})}
      >
        <Select.Item label="Radiators" value="radiator" />
        <Select.Item label="Underfloor Heating" value="floor" />
        <Select.Item label="Mixed (Both)" value="mixed" />
      </Select>
    </FormControl>

    <HStack space={2}>
      <FormControl flex={1} isRequired>
        <FormControl.Label>Morning Temp (°C)</FormControl.Label>
        <Input
          keyboardType="numeric"
          value={formData.targetMorningTemp?.toString()}
          onChangeText={(v) => setFormData({...formData, targetMorningTemp: parseFloat(v)})}
        />
      </FormControl>

      <FormControl flex={1} isRequired>
        <FormControl.Label>Day Temp (°C)</FormControl.Label>
        <Input
          keyboardType="numeric"
          value={formData.targetDayTemp?.toString()}
          onChangeText={(v) => setFormData({...formData, targetDayTemp: parseFloat(v)})}
        />
      </FormControl>

      <FormControl flex={1} isRequired>
        <FormControl.Label>Night Temp (°C)</FormControl.Label>
        <Input
          keyboardType="numeric"
          value={formData.targetNightTemp?.toString()}
          onChangeText={(v) => setFormData({...formData, targetNightTemp: parseFloat(v)})}
        />
      </FormControl>
    </HStack>

    <FormControl>
      <FormControl.Label>Floor Heating</FormControl.Label>
      <Checkbox
        value="hasFloorHeating"
        isChecked={formData.hasFloorHeating}
        onChange={(v) => setFormData({...formData, hasFloorHeating: v})}
      >
        Has underfloor heating zones
      </Checkbox>
    </FormControl>
  </VStack>
</Modal.Body>
```

### B. Updated Form State

```typescript
const [formData, setFormData] = useState({
  homeName: '',
  squareMeters: 100,
  insulationLevel: 'standard',
  windowQuality: 'double',
  radiatorType: 'radiator',
  hasFloorHeating: false,
  targetMorningTemp: 22,
  targetDayTemp: 20,
  targetNightTemp: 18,
  ceilingHeight: 2.6,
  numberOfResidents: 2,
  constructionYear: new Date().getFullYear(),
  boilerModel: '',
});
```

---

## Conclusion

**Current Status:** Backend is complete, frontend forms are incomplete.

**Immediate Action Required:**
1. Replace simplified Add/Edit modals with full forms
2. Remove hardcoded defaults
3. Test end-to-end CRUD operations

**Next Steps:**
1. Implement enhanced forms (2-3 hours)
2. Add multi-step wizard for better UX (optional, 4-6 hours)
3. Add database migration for active home persistence (1 hour)

**Total Effort to Complete:** 3-10 hours depending on UX sophistication level chosen.
