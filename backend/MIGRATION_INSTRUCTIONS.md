# Data Migration Instructions - Enum Standardization

## ⚠️ Important: Follow these steps in order to avoid data loss

The Prisma migration failed because existing data doesn't match the new enum values. We need to update the data first, then apply the schema migration.

## Step-by-Step Process

### Step 1: Resolve the Failed Migration

First, mark the failed migration as rolled back:

```bash
cd backend
npx prisma migrate resolve --rolled-back 20260203133327_standardize_home_profile_enums
```

### Step 2: Connect to MySQL Database

Connect to your MySQL database using your preferred client:

```bash
mysql -h inventory.hopto.org -P 3306 -u your_username -p boiler_assistant
```

Or use a GUI tool like MySQL Workbench, DBeaver, or phpMyAdmin.

### Step 3: Run the Data Migration Script

Execute the SQL script to update existing values:

```bash
mysql -h inventory.hopto.org -P 3306 -u your_username -p boiler_assistant < prisma/data-migration-enums.sql
```

Or copy the contents of `prisma/data-migration-enums.sql` and run it in your MySQL client.

### Step 4: Verify Data Migration

Run these queries to confirm all data has been updated:

```sql
-- Should return 0 for all three
SELECT COUNT(*) FROM HomeProfile WHERE windowType NOT IN ('SINGLE_GLAZED', 'DOUBLE_GLAZED', 'TRIPLE_GLAZED');
SELECT COUNT(*) FROM HomeProfile WHERE insulationType NOT IN ('STANDARD', 'EPS', 'MINERAL_WOOL', 'ADVANCED');
SELECT COUNT(*) FROM HomeProfile WHERE heatingType NOT IN ('RADIATOR', 'UNDERFLOOR', 'MIXED');
```

### Step 5: Apply the Prisma Migration

Now that the data is converted, apply the schema migration:

```bash
npx prisma migrate dev --name standardize_home_profile_enums
```

This should succeed without data loss!

### Step 6: Regenerate Prisma Client

```bash
npx prisma generate
```

### Step 7: Verify Backend Compilation

```bash
npm run build
```

---

## What Gets Updated

### windowType Values:

- `'DOUBLE'` → `'DOUBLE_GLAZED'`
- `'TRIPLE'` → `'TRIPLE_GLAZED'`
- `'single'`, `'double'`, `'triple'` → Uppercase with `_GLAZED` suffix

### insulationType Values:

- `'standard'` → `'STANDARD'`
- `'eps'` → `'EPS'`
- `'wool'`, `'Wool'` → `'MINERAL_WOOL'`
- `'advanced'` → `'ADVANCED'`

### heatingType Values:

- `'radiator'` → `'RADIATOR'`
- `'podno'`, `'floor'` → `'UNDERFLOOR'`
- `'mixed'` → `'MIXED'`

---

## If Something Goes Wrong

If you need to rollback:

1. **Restore database backup** (if you created one before starting)
2. **Revert Prisma schema changes**:
   ```bash
   git checkout HEAD -- prisma/schema.prisma
   ```
3. **Delete failed migration folder**:
   ```bash
   rm -rf prisma/migrations/20260203133327_standardize_home_profile_enums
   ```

---

## After Successful Migration

1. ✅ Backend will use type-safe enums
2. ✅ Mobile app will send correct enum values
3. ✅ Flow-temperature calculations will be accurate
4. ✅ No data will be lost

Test by creating a new HomeProfile via mobile app and verifying it saves correctly!
