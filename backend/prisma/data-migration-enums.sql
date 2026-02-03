-- Data Migration: Convert existing HomeProfile enum values to canonical format
-- Run this BEFORE applying the Prisma schema migration
-- This ensures no data loss during enum standardization

-- ==============================================================================
-- STEP 1: Update windowType values
-- ==============================================================================
-- Current values: 'DOUBLE', 'TRIPLE', 'single', 'double', 'triple'
-- Target values: 'DOUBLE_GLAZED', 'TRIPLE_GLAZED', 'SINGLE_GLAZED'

UPDATE HomeProfile
SET windowType = 'SINGLE_GLAZED'
WHERE windowType IN ('single', 'SINGLE', 'Single');

UPDATE HomeProfile
SET windowType = 'DOUBLE_GLAZED'
WHERE windowType IN ('double', 'DOUBLE', 'Double');

UPDATE HomeProfile
SET windowType = 'TRIPLE_GLAZED'
WHERE windowType IN ('triple', 'TRIPLE', 'Triple');

-- ==============================================================================
-- STEP 2: Update insulationType values
-- ==============================================================================
-- Current values: 'standard', 'eps', 'EPS', 'wool', 'Wool', 'advanced'
-- Target values: 'STANDARD', 'EPS', 'MINERAL_WOOL', 'ADVANCED'

UPDATE HomeProfile
SET insulationType = 'STANDARD'
WHERE insulationType IN ('standard', 'Standard', 'STANDARD');

UPDATE HomeProfile
SET insulationType = 'EPS'
WHERE insulationType IN ('eps', 'Eps');

UPDATE HomeProfile
SET insulationType = 'MINERAL_WOOL'
WHERE insulationType IN ('wool', 'Wool', 'WOOL', 'mineral_wool', 'mineralwool');

UPDATE HomeProfile
SET insulationType = 'ADVANCED'
WHERE insulationType IN ('advanced', 'Advanced', 'ADVANCED', 'pir', 'PIR', 'pur', 'PUR');

-- ==============================================================================
-- STEP 3: Update heatingType values
-- ==============================================================================
-- Current values: 'radiator', 'podno', 'floor', 'mixed'
-- Target values: 'RADIATOR', 'UNDERFLOOR', 'MIXED'

UPDATE HomeProfile
SET heatingType = 'RADIATOR'
WHERE heatingType IN ('radiator', 'Radiator', 'RADIATOR');

UPDATE HomeProfile
SET heatingType = 'UNDERFLOOR'
WHERE heatingType IN ('floor', 'Floor', 'FLOOR', 'podno', 'Podno', 'PODNO', 'underfloor', 'Underfloor', 'UNDERFLOOR');

UPDATE HomeProfile
SET heatingType = 'MIXED'
WHERE heatingType IN ('mixed', 'Mixed', 'MIXED', 'both', 'Both', 'BOTH');

-- ==============================================================================
-- VERIFICATION: Check if any records still have invalid values
-- ==============================================================================

SELECT COUNT(*) as invalid_window_count
FROM HomeProfile
WHERE windowType NOT IN ('SINGLE_GLAZED', 'DOUBLE_GLAZED', 'TRIPLE_GLAZED');

SELECT COUNT(*) as invalid_insulation_count
FROM HomeProfile
WHERE insulationType NOT IN ('STANDARD', 'EPS', 'MINERAL_WOOL', 'ADVANCED');

SELECT COUNT(*) as invalid_heating_count
FROM HomeProfile
WHERE heatingType NOT IN ('RADIATOR', 'UNDERFLOOR', 'MIXED');

-- ==============================================================================
-- If verification shows 0 for all counts, you're ready to apply the migration!
-- Run: npx prisma migrate dev --name standardize_home_profile_enums
-- ==============================================================================
