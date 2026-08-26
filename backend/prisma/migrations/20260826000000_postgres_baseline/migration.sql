-- =====================================================================
-- POSTGRES BASELINE MIGRATION
--
-- This is a fresh, consolidated baseline migration created as part of
-- the MySQL -> PostgreSQL provider switch. It replaces the 24 historical
-- MySQL migrations (archived under prisma/migrations_mysql_archive/ for
-- reference only — they are NOT applied against Postgres).
--
-- IMPORTANT: this file was authored by hand to mirror prisma/schema.prisma
-- as closely as possible, because the Prisma CLI could not be executed
-- in the environment this was prepared in (no network / no installed
-- engines). Before applying this against a real Postgres instance, run:
--
--   npx prisma migrate diff \
--     --from-empty \
--     --to-schema-datamodel prisma/schema.prisma \
--     --script
--
-- ...against a real Postgres connection and diff the output against this
-- file. Treat this file as a strong first draft, not a guaranteed-exact
-- Prisma-generated artifact.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------

CREATE TYPE "SeasonMode" AS ENUM ('WINTER', 'SUMMER', 'AUTO');
CREATE TYPE "NotificationType" AS ENUM ('DAILY_RECOMMENDATION', 'FLOW_TEMP_CHANGED', 'HEATING_STARTED', 'HEATING_ENDED', 'SYSTEM_ALERT', 'GAS_READING_REMINDER');
CREATE TYPE "ThermostatMode" AS ENUM ('MANUAL', 'PROGRAM', 'OFF');
CREATE TYPE "DayType" AS ENUM ('WORKDAY', 'SATURDAY', 'SUNDAY');
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPPORT');
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
CREATE TYPE "HomeProfile_insulationType" AS ENUM ('STANDARD', 'EPS', 'MINERAL_WOOL', 'ADVANCED');
CREATE TYPE "HomeProfile_windowType" AS ENUM ('SINGLE_GLAZED', 'DOUBLE_GLAZED', 'TRIPLE_GLAZED');
CREATE TYPE "HomeProfile_heatingType" AS ENUM ('RADIATOR', 'UNDERFLOOR', 'MIXED');

-- Legacy/unused duplicate enums kept only because they still exist in
-- schema.prisma (see audit note about dead enums). Not referenced by any
-- column. Left in place to avoid diverging from the current schema file;
-- safe to drop together whenever the schema cleanup itself is done.
CREATE TYPE "InsulationType" AS ENUM ('STANDARD', 'EPS', 'MINERAL_WOOL', 'ADVANCED');
CREATE TYPE "WindowType" AS ENUM ('SINGLE_GLAZED', 'DOUBLE_GLAZED', 'TRIPLE_GLAZED');
CREATE TYPE "HeatingType" AS ENUM ('RADIATOR', 'UNDERFLOOR', 'MIXED');

-- ---------------------------------------------------------------------
-- TABLE: User
-- (activeHomeProfileId FK added later via ALTER TABLE, to break the
-- circular dependency with HomeProfile)
-- ---------------------------------------------------------------------

CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "homeLocation" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "locale" TEXT,
    "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
    "prefersDarkMode" BOOLEAN,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "timezone" TEXT,
    "activeHomeProfileId" INTEGER,
    "gasPriceExVat" DOUBLE PRECISION,
    "username" TEXT,
    "currentBoilerFlowTemp" DOUBLE PRECISION,
    "currentBoilerFlowTempSetAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_activeHomeProfileId_key" ON "User"("activeHomeProfileId");

-- ---------------------------------------------------------------------
-- TABLE: HomeProfile
-- ---------------------------------------------------------------------

CREATE TABLE "HomeProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "floorArea" DOUBLE PRECISION NOT NULL,
    "ceilingHeight" DOUBLE PRECISION NOT NULL,
    "insulationType" "HomeProfile_insulationType" NOT NULL,
    "insulationThickness" DOUBLE PRECISION NOT NULL,
    "windowType" "HomeProfile_windowType" NOT NULL,
    "constructionYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "learningConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "learningOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heatingType" "HomeProfile_heatingType" NOT NULL,
    "seasonMode" "SeasonMode" NOT NULL DEFAULT 'WINTER',
    "boilerModel" TEXT,
    "hasFloorHeating" BOOLEAN NOT NULL DEFAULT false,
    "homeName" TEXT,
    "numberOfResidents" INTEGER,
    "preferredScheduleNotes" TEXT,
    "targetDayTemp" DOUBLE PRECISION,
    "targetMorningTemp" DOUBLE PRECISION,
    "targetNightTemp" DOUBLE PRECISION,
    "location" TEXT,

    CONSTRAINT "HomeProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeProfile_userId_idx" ON "HomeProfile"("userId");

ALTER TABLE "HomeProfile" ADD CONSTRAINT "HomeProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Now that HomeProfile exists, wire up User.activeHomeProfileId
ALTER TABLE "User" ADD CONSTRAINT "User_activeHomeProfileId_fkey"
    FOREIGN KEY ("activeHomeProfileId") REFERENCES "HomeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: ThermostatDevice
-- ---------------------------------------------------------------------

CREATE TABLE "ThermostatDevice" (
    "id" SERIAL NOT NULL,
    "alias" TEXT,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "homeProfileId" INTEGER NOT NULL,
    "mode" "ThermostatMode" NOT NULL DEFAULT 'MANUAL',
    "deviceId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "vendor" TEXT NOT NULL,
    "roomCurrentTemp" DOUBLE PRECISION,
    "roomTargetTemp" DOUBLE PRECISION,
    "lastSnapshotAt" TIMESTAMP(3),

    CONSTRAINT "ThermostatDevice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ThermostatDevice_homeProfileId_idx" ON "ThermostatDevice"("homeProfileId");
CREATE INDEX "ThermostatDevice_userId_fkey" ON "ThermostatDevice"("userId");

ALTER TABLE "ThermostatDevice" ADD CONSTRAINT "ThermostatDevice_homeProfileId_fkey"
    FOREIGN KEY ("homeProfileId") REFERENCES "HomeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThermostatDevice" ADD CONSTRAINT "ThermostatDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: ThermostatProgram
-- ---------------------------------------------------------------------

CREATE TABLE "ThermostatProgram" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "dayType" "DayType" NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "targetTemp" DOUBLE PRECISION NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "programHash" TEXT,

    CONSTRAINT "ThermostatProgram_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ThermostatProgram_deviceId_dayType_orderIndex_key" ON "ThermostatProgram"("deviceId", "dayType", "orderIndex");

ALTER TABLE "ThermostatProgram" ADD CONSTRAINT "ThermostatProgram_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "ThermostatDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: HeatingEvent
-- ---------------------------------------------------------------------

CREATE TABLE "HeatingEvent" (
    "id" SERIAL NOT NULL,
    "currentTemp" DOUBLE PRECISION NOT NULL,
    "targetTemp" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" INTEGER NOT NULL,
    "hvacAction" TEXT NOT NULL,
    "timestampEnd" TIMESTAMP(3),
    "timestampStart" TIMESTAMP(3) NOT NULL,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "proposedEndTime" TIMESTAMP(3),
    "userConfimed" BOOLEAN NOT NULL DEFAULT false,
    "anomalyCheckedAt" TIMESTAMP(3),

    CONSTRAINT "HeatingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HeatingEvent_deviceId_fkey" ON "HeatingEvent"("deviceId");

ALTER TABLE "HeatingEvent" ADD CONSTRAINT "HeatingEvent_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "ThermostatDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: Recommendation
-- ---------------------------------------------------------------------

CREATE TABLE "Recommendation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "recommendedFlowTemp" DOUBLE PRECISION NOT NULL,
    "expectedHeatTimeMin" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Recommendation_userId_fkey" ON "Recommendation"("userId");

ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: WeatherCache
-- ---------------------------------------------------------------------

CREATE TABLE "WeatherCache" (
    "id" SERIAL NOT NULL,
    "city" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "humidity" DOUBLE PRECISION,
    "cloud" INTEGER,
    "condition_text" TEXT,
    "feelslike" DOUBLE PRECISION,
    "gust_kph" DOUBLE PRECISION,
    "moon_illumination" INTEGER,
    "moon_phase" TEXT,
    "moonrise" TEXT,
    "moonset" TEXT,
    "precipitation_mm" DOUBLE PRECISION,
    "pressure_mb" DOUBLE PRECISION,
    "snow_cm" DOUBLE PRECISION,
    "sunrise" TEXT,
    "sunset" TEXT,
    "temp_avg" DOUBLE PRECISION,
    "temp_max" DOUBLE PRECISION,
    "temp_min" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION NOT NULL,
    "uv_index" DOUBLE PRECISION,
    "wind_dir" TEXT,
    "wind_kph" DOUBLE PRECISION,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("id")
);

-- NOTE (see improvement plan): no index currently exists on "city", even
-- though every read of this table filters/orders by it. Intentionally
-- reproduced as-is from schema.prisma; adding the index is tracked as a
-- P2 item in the improvement plan rather than silently fixed here.

-- ---------------------------------------------------------------------
-- TABLE: BoilerHistory
-- ---------------------------------------------------------------------

CREATE TABLE "BoilerHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "externalTemp" DOUBLE PRECISION NOT NULL,
    "suggestedTemp" DOUBLE PRECISION NOT NULL,
    "actualTemp" DOUBLE PRECISION,
    "heatingStart" TIMESTAMP(3),
    "heatingEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoilerHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BoilerHistory_userId_fkey" ON "BoilerHistory"("userId");

ALTER TABLE "BoilerHistory" ADD CONSTRAINT "BoilerHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: GasReading
-- ---------------------------------------------------------------------

CREATE TABLE "GasReading" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "counterValue" DOUBLE PRECISION NOT NULL,
    "consumption" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceGasPriceExVat" DOUBLE PRECISION,
    "invoicePdfMime" TEXT,
    "invoicePdfOriginalName" TEXT,
    "invoicePdfPath" TEXT,
    "invoiceUploadedAt" TIMESTAMP(3),
    "isInvoiceReference" BOOLEAN NOT NULL DEFAULT false,
    "meterImageMime" TEXT,
    "meterImageOriginalName" TEXT,
    "meterImagePath" TEXT,
    "referenceMonth" TIMESTAMP(3),

    CONSTRAINT "GasReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GasReading_userId_referenceMonth_key" ON "GasReading"("userId", "referenceMonth");

ALTER TABLE "GasReading" ADD CONSTRAINT "GasReading_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: HeatingIntervalLearning
-- ---------------------------------------------------------------------

CREATE TABLE "HeatingIntervalLearning" (
    "id" SERIAL NOT NULL,
    "homeProfileId" INTEGER NOT NULL,
    "intervalKey" TEXT NOT NULL,
    "avgReachTimeMin" DOUBLE PRECISION NOT NULL,
    "avgOvershoot" DOUBLE PRECISION NOT NULL,
    "offset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeatingIntervalLearning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HeatingIntervalLearning_homeProfileId_intervalKey_key" ON "HeatingIntervalLearning"("homeProfileId", "intervalKey");

ALTER TABLE "HeatingIntervalLearning" ADD CONSTRAINT "HeatingIntervalLearning_homeProfileId_fkey"
    FOREIGN KEY ("homeProfileId") REFERENCES "HomeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: TuyaToken
-- ---------------------------------------------------------------------

CREATE TABLE "TuyaToken" (
    "id" SERIAL NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TuyaToken_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------
-- TABLE: UserDevice
-- ---------------------------------------------------------------------

CREATE TABLE "UserDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDevice_expoPushToken_key" ON "UserDevice"("expoPushToken");
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice"("userId");

ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: Notification
-- ---------------------------------------------------------------------

CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryOk" BOOLEAN NOT NULL DEFAULT true,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_userId_sourceRef_key" ON "Notification"("userId", "sourceRef");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: NotificationPreference
-- ---------------------------------------------------------------------

CREATE TABLE "NotificationPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_type_key" ON "NotificationPreference"("userId", "type");

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TABLE: GasPriceHistory
-- ---------------------------------------------------------------------

CREATE TABLE "GasPriceHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "priceExVat" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.17,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "gasReadingId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GasPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GasPriceHistory_userId_fkey" ON "GasPriceHistory"("userId");

ALTER TABLE "GasPriceHistory" ADD CONSTRAINT "GasPriceHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
