# Database Setup & Seeding Guide

This guide covers database setup, migration, and seeding for the Boiler Control system.

## Quick Start

### Reset and Seed Database

```bash
# From backend directory
npm run db:reset:seed
```

This single command will:

1. Reset the database to a clean state (runs all migrations)
2. Populate it with realistic test data

### Alternative Commands

```bash
# Reset database only (removes all data)
npm run db:reset

# Run seed script only (populate existing database)
npm run db:seed
```

## Database Schema

The database includes the following main entities:

### Users

- Email/password authentication
- User roles: USER, ADMIN, SUPPORT
- Plans: FREE, PRO, ENTERPRISE
- Profile information: timezone, locale, preferences

### Home Profile

- User's home configuration
- Floor area, ceiling height, insulation type
- Window and heating system details
- Construction year and learning parameters

### Thermostat Devices

- Connected smart thermostats (Tuya)
- Current and target temperatures
- Heating modes: MANUAL, PROGRAM, OFF
- Last snapshot timestamp

### Thermostat Programs

- Daily heating schedules
- Different schedules for weekdays, Saturdays, Sundays
- Target temperatures at specific times
- Program hashing for versioning

### Heating Events

- Individual heating cycles
- Start/end timestamps
- Current and target temperatures
- Anomaly detection flags
- User confirmation status

### Recommendations

- Daily heating recommendations
- Recommended flow temperature
- Expected heat time
- Confidence score

### Boiler History

- External temperature readings
- Suggested and actual flow temperatures
- Heating start/end times
- Timestamped records

### Gas Readings

- Monthly gas meter readings
- Counter values and consumption calculations
- Monthly tracking for utilities management

### Weather Cache

- Current weather conditions
- Temperature, humidity, wind data
- UV index and precipitation
- Moon phase information

### Notifications

- Delivery of alerts and recommendations
- Types: daily recommendations, flow temp changes, heating events, alerts
- User notification preferences

### User Devices

- Mobile devices registered for push notifications
- Platform: iOS or Android
- Expo push tokens
- Last seen tracking

## Seed Data

The seed script creates realistic test data:

### Test Users (3)

```
1. test@example.com (PRO) - Full features
2. admin@example.com (ADMIN) - Administrative access
3. demo@example.com (FREE) - Limited features
```

All test accounts use password: `password123`

### Test Data Scope

**Time Range**: Last 7 days + historical data

- **Heating Events**: ~16 per day (morning + evening cycles)
- **Anomalies**: 2 detected over 7-day period
- **Recommendations**: Daily for last 8 days
- **Boiler History**: Hourly records (6 AM - 10 PM) for 7 days
- **Gas Readings**: Monthly readings for 12 months
- **Weather Data**: Current Sarajevo weather
- **Devices**: 3 registered mobile devices

### Data Relationships

```
User
├── HomeProfile
│   └── ThermostatDevice
│       ├── HeatingEvent (multiple per day)
│       ├── ThermostatProgram (6+ programs)
│       └── HeatingIntervalLearning
├── Recommendation (daily)
├── BoilerHistory (hourly)
├── GasReading (monthly)
├── UserDevice (multiple per user)
├── Notification (multiple per day)
└── NotificationPreference (6 types per user)
```

## Database Verification

After seeding, verify data with these queries:

```sql
-- Count records by type
SELECT 'Users' as entity, COUNT(*) as count FROM User
UNION ALL
SELECT 'HomeProfiles', COUNT(*) FROM HomeProfile
UNION ALL
SELECT 'ThermostatDevices', COUNT(*) FROM ThermostatDevice
UNION ALL
SELECT 'HeatingEvents', COUNT(*) FROM HeatingEvent
UNION ALL
SELECT 'Recommendations', COUNT(*) FROM Recommendation
UNION ALL
SELECT 'BoilerHistory', COUNT(*) FROM BoilerHistory
UNION ALL
SELECT 'GasReadings', COUNT(*) FROM GasReading;

-- Check recent heating events
SELECT DISTINCT
  DATE(timestampStart) as date,
  COUNT(*) as events,
  SUM(CASE WHEN isAnomaly=1 THEN 1 ELSE 0 END) as anomalies
FROM HeatingEvent
GROUP BY DATE(timestampStart)
ORDER BY date DESC;

-- Verify heating events for test user
SELECT
  he.id,
  he.timestampStart,
  TIMESTAMPDIFF(MINUTE, he.timestampStart, he.timestampEnd) as duration_minutes,
  he.roomCurrentTemp,
  he.roomTargetTemp,
  he.isAnomaly
FROM HeatingEvent he
JOIN ThermostatDevice td ON he.deviceId = td.id
JOIN User u ON td.userId = u.id
WHERE u.email = 'test@example.com'
ORDER BY he.timestampStart DESC
LIMIT 20;
```

## Migration Strategy

### Running Migrations

```bash
# Generate new migrations
npx prisma migrate dev --name <migration_name>

# Apply pending migrations
npx prisma migrate deploy

# Reset to a specific migration
npx prisma migrate resolve --rolled-back <migration_name>
```

## Troubleshooting

### Issue: "No database connection"

```bash
# Verify .env file is configured
# Check DATABASE_URL points to correct host/port
npm run db:seed
```

### Issue: "Foreign key constraint failed"

```bash
# Seed script creates data in correct order
# If still failing, reset and retry:
npm run db:reset:seed
```

### Issue: "Unique constraint violation"

```bash
# Usually happens if seed runs twice
# Solution: reset first, then seed
npm run db:reset
npm run db:seed
```

### Issue: "bcryptjs module not found"

```bash
# Install dependencies first
npm install
npm run db:seed
```

## Development Workflow

### Initial Setup

```bash
npm install
npm run db:reset:seed
npm run start:dev
```

### During Development

```bash
# If you need fresh data
npm run db:reset:seed

# If only adding migrations
npx prisma migrate dev

# To inspect database
npx prisma studio
```

### Before Committing

```bash
# Ensure migrations are clean
npm run build

# Run tests with seeded data
npm run test
```

## Production Considerations

> ⚠️ **Do NOT use the seed script in production**

For production deployments:

1. Never reset the database
2. Always backup before migrations
3. Test migrations in staging first
4. Use `npm run db:migrate:deploy` only

```bash
# Production - deploy migrations only
npm run db:migrate:deploy

# Never use in production:
# npm run db:reset
# npm run db:seed
```

## Performance Tips

### For Large Datasets

The seed script creates batches efficiently:

- Uses `createMany` for bulk inserts
- Minimizes individual database round-trips
- Takes ~30-60 seconds on typical hardware

### Disabling Indexes During Seed

Not needed - Prisma handles this optimally

## Backup and Recovery

### Before Critical Changes

```bash
# Backup database
mysqldump -u $DATABASE_USER -p $DATABASE_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# After restore
mysql -u $DATABASE_USER -p $DATABASE_NAME < backup_YYYYMMDD_HHMMSS.sql
```

### Git Strategy

- Never commit `.env` files
- Commit migrations to version control
- Commit seed script for reproducibility
- Document any manual migrations

## Documentation

- **Prisma Schema**: [schema.prisma](./schema.prisma)
- **Migrations**: [migrations/](./migrations/)
- **Seed Script**: [seed.ts](./seed.ts)

---

**Last Updated**: 2026-02-02
**Maintained by**: Development Team
**Database Type**: MySQL/MariaDB
