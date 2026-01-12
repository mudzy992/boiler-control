import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addMinutes } from 'date-fns';
import { WeatherService } from '../Weather/weather.service';

@Injectable()
export class BoilerService {
  private readonly logger = new Logger(BoilerService.name);

  constructor(
    private prisma: PrismaService,
    private weatherService: WeatherService,
  ) {}

  /**
   * Glavna funkcija koja vraća start temp kotla za korisnika
   * koristi interval learning + home profile + weather + historical events
   */
  async getStartTemp(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { homeProfiles: true },
    });
    if (!user) throw new Error('User not found');

    const home = user.homeProfiles[0];
    if (!home) throw new Error('HomeProfile not found');

    // --- 1️⃣ Dohvati trenutnu vanjsku temperaturu ---
    const weather = await this.prisma.weatherCache.findFirst({
      where: { city: user.homeLocation! },
      orderBy: { fetchedAt: 'desc' },
    });
    const tempMin = weather?.temp_min ?? 0;
    const tempMax = weather?.temp_max ?? 0;
    const weightedTemp = 0.7 * tempMin + 0.3 * tempMax;

    // --- 2️⃣ Odredi trenutni interval ---
    const intervalKey = this.getIntervalKey();
    const isMorningInterval = intervalKey.includes('morning');

    // --- 3️⃣ Dohvati interval learning ---
    let intervalLearning = await this.prisma.heatingIntervalLearning.findUnique(
      {
        where: {
          homeProfileId_intervalKey: { homeProfileId: home.id, intervalKey },
        },
      },
    );

    if (!intervalLearning) {
      intervalLearning = await this.prisma.heatingIntervalLearning.create({
        data: {
          homeProfileId: home.id,
          intervalKey,
          avgReachTimeMin: 30,
          avgOvershoot: 0,
          offset: 0,
          confidence: 0.1,
          samples: 0,
        },
      });
    }

    // --- 4️⃣ Izračun krivulje polazne temperature ---
    let startTemp = this.calculateCurveTemp(weightedTemp);

    // Primjena home profile offseta i interval offseta
    startTemp += home.learningOffset;

    // Za jutarnji interval: ograničavamo preagresivni offset
    if (isMorningInterval) {
      startTemp += intervalLearning.offset * 0.5; // smanjen uticaj da se ne pumpa previše
    } else {
      startTemp += intervalLearning.offset;
    }

    // --- 5️⃣ Koristi historijske heating evente za korekciju ---
    const lastWeekEvents = await this.prisma.heatingEvent.findMany({
      where: {
        thermostat: { userId },
        timestampStart: { gte: addMinutes(new Date(), -7 * 24 * 60 * 60) },
      },
    });

    const eventOffset = lastWeekEvents.reduce((acc, e) => {
      const delta = e.targetTemp - e.currentTemp;
      const weight = e.timestampEnd ? 0.05 : 0.1; // aktivni eventi teži
      return acc + delta * weight;
    }, 0);

    // Za jutarnji interval smanjimo težinu event offseta
    startTemp += isMorningInterval ? eventOffset * 0.5 : eventOffset;

    // --- 6️⃣ Ograničimo na raspon kotla ---
    startTemp = Math.max(35, Math.min(56, startTemp));

    const roundedTemp = Number(startTemp.toFixed(2));
    this.logger.log(
      `Calculated startTemp for user ${userId} at interval ${intervalKey}: ${roundedTemp}`,
    );

    return roundedTemp;
  }

  /**
   * Kreira jutarnji boiler history zapis i Recommendation
   */
  async createMorningBoilerHistory(userId: number) {
    const home = await this.prisma.homeProfile.findFirst({
      where: { userId },
      include: { user: true },
    });
    if (!home) throw new Error('HomeProfile not found');

    const todayWeather = await this.weatherService.getTodayWeather(
      home.user.homeLocation!,
    );

    const suggestedTemp = await this.getStartTemp(userId);

    const lastBh = await this.prisma.boilerHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const lastActual = lastBh?.actualTemp ?? 50;

    const externalTemp =
      0.7 * (todayWeather.temp_min ?? 0) + 0.3 * (todayWeather.temp_max ?? 0);

    const boilerHistory = await this.prisma.boilerHistory.create({
      data: {
        userId,
        externalTemp,
        suggestedTemp,
        actualTemp: lastActual,
      },
    });

    // --- 5️⃣ Kreiranje Recommendation ---
    const intervalKey = this.getIntervalKey();
    const intervalLearning =
      await this.prisma.heatingIntervalLearning.findUnique({
        where: {
          homeProfileId_intervalKey: { homeProfileId: home.id, intervalKey },
        },
      });

    const isMorningInterval = intervalKey.includes('morning');

    // Za jutro smanjimo agresivnost preporuke
    const recommendedFlowTemp =
      suggestedTemp +
      (intervalLearning?.offset ?? 0) * (isMorningInterval ? 0.5 : 1);

    const expectedHeatTimeMin = intervalLearning?.avgReachTimeMin ?? 30;
    const confidenceScore = intervalLearning?.confidence ?? 0.1;

    await this.prisma.recommendation.create({
      data: {
        userId,
        date: new Date(),
        recommendedFlowTemp: Number(recommendedFlowTemp.toFixed(2)),
        expectedHeatTimeMin: Number(expectedHeatTimeMin.toFixed(0)),
        confidenceScore: Number(confidenceScore.toFixed(2)),
      },
    });

    return boilerHistory;
  }

  /**
   * Update interval learning nakon heating eventa
   */
  async updateIntervalLearning(
    userId: number,
    intervalKey: string,
    reachTimeMin: number,
    overshoot: number,
    targetTemp: number,
    actualTemp: number,
  ) {
    const home = await this.prisma.homeProfile.findFirst({ where: { userId } });
    if (!home) throw new Error('HomeProfile not found');

    let interval = await this.prisma.heatingIntervalLearning.findUnique({
      where: {
        homeProfileId_intervalKey: { homeProfileId: home.id, intervalKey },
      },
    });

    if (!interval) {
      interval = await this.prisma.heatingIntervalLearning.create({
        data: {
          homeProfileId: home.id,
          intervalKey,
          avgReachTimeMin: reachTimeMin,
          avgOvershoot: overshoot,
          offset: targetTemp - actualTemp,
          confidence: 0.1,
          samples: 1,
        },
      });
      return;
    }

    const newSamples = interval.samples + 1;
    const newAvgReach =
      (interval.avgReachTimeMin * interval.samples + reachTimeMin) / newSamples;
    const newAvgOvershoot =
      (interval.avgOvershoot * interval.samples + overshoot) / newSamples;
    const newOffset =
      (interval.offset * interval.samples + (targetTemp - actualTemp)) /
      newSamples;
    const newConfidence = Math.min(
      1,
      (interval.confidence * interval.samples + 0.1) / newSamples,
    );

    await this.prisma.heatingIntervalLearning.update({
      where: { id: interval.id },
      data: {
        avgReachTimeMin: newAvgReach,
        avgOvershoot: newAvgOvershoot,
        offset: newOffset,
        samples: newSamples,
        confidence: newConfidence,
        lastUpdated: new Date(),
      },
    });

    // Update ukupnog home profile offseta
    const intervalLearnings =
      await this.prisma.heatingIntervalLearning.findMany({
        where: { homeProfileId: home.id },
      });
    const totalOffset = intervalLearnings.reduce(
      (acc, i) => acc + i.offset * i.confidence,
      0,
    );
    const totalConfidence = intervalLearnings.reduce(
      (acc, i) => acc + i.confidence,
      0,
    );
    const learningOffset = totalConfidence ? totalOffset / totalConfidence : 0;
    const learningConfidence = Math.min(
      1,
      totalConfidence / intervalLearnings.length,
    );

    await this.prisma.homeProfile.update({
      where: { id: home.id },
      data: { learningOffset, learningConfidence },
    });
  }

  /**
   * Interval key, npr. weekday_morning
   */
  getIntervalKey(): string {
    const now = new Date();
    const hour = now.getHours();
    const weekday = now.getDay(); // 0=Sunday ... 6=Saturday
    let part = 'night';

    if (hour >= 6 && hour < 9) part = 'morning';
    else if (hour >= 9 && hour < 12) part = 'late_morning';
    else if (hour >= 12 && hour < 17) part = 'afternoon';
    else if (hour >= 17 && hour < 22) part = 'evening';

    const dayType = weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
    return `${dayType}_${part}`;
  }

  /**
   * Krivulja grijanja, mapiranje vanjske temp → start temp
   */
  private calculateCurveTemp(ext: number): number {
    if (ext >= 10) return 45;
    if (ext <= -15) return 56;
    return 51 - ext * 0.3;
  }
}
