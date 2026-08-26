import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from 'src/generated/prisma/client';

async function main() {
  const poolSize = Number(process.env.DATABASE_POOL_SIZE) || 5;
  const connectTimeout =
    Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || 5000;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      host: process.env.DATABASE_HOST!,
      port: Number(process.env.DATABASE_PORT) || 5432,
      user: process.env.DATABASE_USER!,
      password: process.env.DATABASE_PASSWORD!,
      database: process.env.DATABASE_NAME!,
      max: poolSize,
      connectionTimeoutMillis: connectTimeout,
    }),
  });

  try {
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.gasReading.deleteMany();
    await prisma.boilerHistory.deleteMany();
    await prisma.recommendation.deleteMany();
    await prisma.heatingEvent.deleteMany();
    await prisma.thermostatProgram.deleteMany();
    await prisma.thermostatDevice.deleteMany();
    await prisma.heatingIntervalLearning.deleteMany();
    await prisma.homeProfile.deleteMany();
    await prisma.userDevice.deleteMany();
    await prisma.user.deleteMany();
    await prisma.weatherCache.deleteMany();
    await prisma.tuyaToken.deleteMany();

    console.log('✅ Data cleared');

    // Create test users
    console.log('👥 Creating users...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    const user1 = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        homeLocation: 'Sarajevo, Bosnia and Herzegovina',
        timezone: 'Europe/Sarajevo',
        locale: 'en-US',
        prefersDarkMode: true,
        role: 'USER',
        plan: 'PRO',
      },
    });

    console.log(`✅ Created user: ${user1.email}`);

    // Create home profile
    console.log('🏠 Creating home profile...');
    const homeProfile = await prisma.homeProfile.create({
      data: {
        userId: user1.id,
        floorArea: 150,
        ceilingHeight: 2.3,
        insulationType: 'EPS',
        insulationThickness: 10,
        windowType: 'DOUBLE_GLAZED',
        heatingType: 'RADIATOR',
        constructionYear: 1990,
      },
    });

    console.log(`✅ Created home profile for ${homeProfile.floorArea}m²`);

    // Create thermostat device
    console.log('🌡️  Creating thermostat device...');
    const thermostatDevice = await prisma.thermostatDevice.create({
      data: {
        userId: user1.id,
        homeProfileId: homeProfile.id,
        vendor: 'Tuya',
        deviceId: 'test-device-123',
        alias: 'Living Room Thermostat',
        roomTargetTemp: 22,
        roomCurrentTemp: 20,
        mode: 'PROGRAM',
      },
    });

    console.log(`✅ Created thermostat: ${thermostatDevice.alias}`);

    // Create thermostat programs (WORKDAY, SATURDAY, SUNDAY)
    console.log('📅 Creating thermostat programs...');
    const programs = [
      // WORKDAY
      {
        dayType: 'WORKDAY' as const,
        orderIndex: 0,
        startMinute: 390,
        targetTemp: 22,
      }, // 06:30
      {
        dayType: 'WORKDAY' as const,
        orderIndex: 1,
        startMinute: 540,
        targetTemp: 20,
      }, // 09:00
      {
        dayType: 'WORKDAY' as const,
        orderIndex: 2,
        startMinute: 1020,
        targetTemp: 23,
      }, // 17:00
      {
        dayType: 'WORKDAY' as const,
        orderIndex: 3,
        startMinute: 1320,
        targetTemp: 19,
      }, // 22:00
      // SATURDAY
      {
        dayType: 'SATURDAY' as const,
        orderIndex: 0,
        startMinute: 480,
        targetTemp: 22,
      }, // 08:00
      {
        dayType: 'SATURDAY' as const,
        orderIndex: 1,
        startMinute: 1320,
        targetTemp: 19,
      }, // 22:00
      // SUNDAY
      {
        dayType: 'SUNDAY' as const,
        orderIndex: 0,
        startMinute: 480,
        targetTemp: 22,
      }, // 08:00
      {
        dayType: 'SUNDAY' as const,
        orderIndex: 1,
        startMinute: 1320,
        targetTemp: 19,
      }, // 22:00
    ];

    for (const program of programs) {
      await prisma.thermostatProgram.create({
        data: {
          deviceId: thermostatDevice.id,
          ...program,
        },
      });
    }

    console.log(`✅ Created ${programs.length} thermostat programs`);

    // Create heating events for the last 7 days
    console.log('🔥 Creating heating events...');
    const today = new Date();
    let eventCount = 0;

    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const eventDate = new Date(today);
      eventDate.setDate(eventDate.getDate() - daysAgo);

      // 3-4 heating sessions per day
      for (let i = 0; i < (Math.random() > 0.5 ? 4 : 3); i++) {
        const startHour = 6 + i * 5 + Math.floor(Math.random() * 2);
        const startTime = new Date(eventDate);
        startTime.setHours(startHour, Math.floor(Math.random() * 60));

        const endTime = new Date(startTime);
        endTime.setMinutes(
          startTime.getMinutes() + 30 + Math.floor(Math.random() * 30),
        );

        await prisma.heatingEvent.create({
          data: {
            deviceId: thermostatDevice.id,
            timestampStart: startTime,
            timestampEnd: endTime,
            roomCurrentTemp: Math.random() * 2 + 19,
            roomTargetTemp: 22,
            hvacAction: 'HEATING',
            source: 'API',
            isAnomaly: Math.random() > 0.9,
          },
        });
        eventCount++;
      }
    }

    console.log(`✅ Created ${eventCount} heating events`);

    // Create recommendations
    console.log('💡 Creating recommendations...');
    for (let i = 0; i < 5; i++) {
      const recDate = new Date(today);
      recDate.setDate(recDate.getDate() - i);

      await prisma.recommendation.create({
        data: {
          userId: user1.id,
          date: recDate,
          recommendedFlowTemp: Math.random() * 10 + 55,
          expectedHeatTimeMin: Math.random() * 30 + 30,
          confidenceScore: Math.random() * 0.3 + 0.7,
        },
      });
    }

    console.log('✅ Created 5 recommendations');

    // Create gas readings
    console.log('⛽ Creating gas readings...');
    let cumulative = 1000;
    for (let i = 11; i >= 0; i--) {
      const readDate = new Date(today);
      readDate.setMonth(readDate.getMonth() - i);

      cumulative += Math.random() * 50 + 100;
      await prisma.gasReading.create({
        data: {
          userId: user1.id,
          readingDate: readDate,
          counterValue: cumulative,
          consumption: i < 11 ? Math.random() * 50 + 100 : null,
        },
      });
    }

    console.log('✅ Created 12 gas readings');

    // Create boiler history
    console.log('📝 Creating boiler history...');
    for (let i = 0; i < 20; i++) {
      const eventDate = new Date(today);
      eventDate.setDate(eventDate.getDate() - Math.floor(Math.random() * 30));

      await prisma.boilerHistory.create({
        data: {
          userId: user1.id,
          externalTemp: Math.random() * 15 + 5,
          suggestedFlowTemp: Math.random() * 15 + 55,
          actualFlowTemp: Math.random() * 15 + 55,
          heatingStart: eventDate,
          heatingEnd: new Date(eventDate.getTime() + Math.random() * 3600000),
        },
      });
    }

    console.log('✅ Created 20 boiler history records');

    // Create weather cache
    console.log('🌤️  Creating weather cache...');
    await prisma.weatherCache.create({
      data: {
        city: 'Sarajevo',
        temperature: 15,
        feelslike: 13,
        temp_min: 10,
        temp_max: 18,
        temp_avg: 14,
        wind_kph: 10,
        gust_kph: 15,
        wind_dir: 'N',
        pressure_mb: 1013,
        humidity: 65,
        cloud: 40,
        uv_index: 3,
        precipitation_mm: 0,
        snow_cm: 0,
        condition_text: 'Partly cloudy',
        sunrise: '07:15',
        sunset: '17:30',
        moonrise: '20:00',
        moonset: '08:00',
        moon_phase: 'Waxing Crescent',
        moon_illumination: 25,
      },
    });

    console.log('✅ Created weather cache');

    // Create notification preferences
    console.log('🔔 Creating notification preferences...');
    const notifTypes: (
      | 'DAILY_RECOMMENDATION'
      | 'FLOW_TEMP_CHANGED'
      | 'HEATING_STARTED'
      | 'HEATING_ENDED'
      | 'SYSTEM_ALERT'
      | 'GAS_READING_REMINDER'
    )[] = [
      'DAILY_RECOMMENDATION',
      'FLOW_TEMP_CHANGED',
      'HEATING_STARTED',
      'HEATING_ENDED',
      'SYSTEM_ALERT',
      'GAS_READING_REMINDER',
    ];

    for (const type of notifTypes) {
      await prisma.notificationPreference.create({
        data: {
          userId: user1.id,
          type,
          enabled: true,
        },
      });
    }

    console.log('✅ Created notification preferences');

    // Create user device
    console.log('📱 Creating user device...');
    await prisma.userDevice.create({
      data: {
        userId: user1.id,
        platform: 'ios',
        expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        isActive: true,
      },
    });

    console.log('✅ Created user device');

    // Create sample notifications
    console.log('📬 Creating sample notifications...');
    await prisma.notification.create({
      data: {
        userId: user1.id,
        type: 'DAILY_RECOMMENDATION',
        title: 'Daily Heating Recommendation',
        message: 'Set flow temperature to 60°C for optimal heating today',
        data: { recommendedFlowTemp: 60 },
        sourceRef: `daily_recommendation_${today.toISOString().split('T')[0]}`,
      },
    });

    console.log('✅ Created sample notifications');

    console.log('\n✨ Seeding completed successfully!');
    console.log(`\nTest account credentials:`);
    console.log(`Email: test@example.com`);
    console.log(`Password: password123`);
    console.log(`\nDatabase contains:`);
    console.log(`- 1 user (PRO plan)`);
    console.log(`- 1 home profile`);
    console.log(`- 1 thermostat device`);
    console.log(`- 8 thermostat programs`);
    console.log(`- ${eventCount} heating events`);
    console.log(`- 5 recommendations`);
    console.log(`- 12 gas readings`);
    console.log(`- 20 boiler history records`);
    console.log(`- 1 weather cache entry`);
    console.log(`- 6 notification preferences`);
    console.log(`- 1 user device`);
    console.log(`- 1 sample notification`);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
