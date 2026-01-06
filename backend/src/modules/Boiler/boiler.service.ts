import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WeatherService } from '../Weather/weather.service';

@Injectable()
export class BoilerService {
  private readonly logger = new Logger(BoilerService.name);

  constructor(
    private prisma: PrismaService,
    private weatherService: WeatherService,
  ) {}

  /** Glavna funkcija koja vraća start temp, automatski koristi feedback loop */
  async calculateStartTemp(userId: number, city: string): Promise<number> {
    const home = await this.prisma.homeProfile.findFirst({ where: { userId } });
    if (!home) throw new Error('HomeProfile not found');

    const { temp_min, temp_max } =
      await this.weatherService.getTodayWeather(city);
    const weightedTemp = 0.7 * (temp_min ?? 0) + 0.3 * (temp_max ?? 0);

    this.logger.log(
      `Weighted external temperature for user ${userId}: ${weightedTemp}`,
    );

    // 1️⃣ Dohvati heating evente iz pollera
    const events = await this.prisma.heatingEvent.findMany({
      where: {
        thermostat: { userId },
        timestampStart: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // zadnjih 7 dana
      },
    });

    // 2️⃣ Izračun learning offset-a
    let learningOffset = 0;
    events.forEach((e) => {
      const delta = e.targetTemp - e.currentTemp;
      const weight = e.timestampEnd ? 0.05 : 0.1; // aktivni eventi imaju veću težinu
      learningOffset += delta * weight;
    });

    this.logger.debug(`Calculated learningOffset: ${learningOffset}`);

    // 3️⃣ Start temp prema krivulji + offset
    let startTemp = this.calculateCurveTemp(weightedTemp);
    startTemp += learningOffset;
    startTemp = Math.max(35, Math.min(56, startTemp));
    const roundedStartTemp = Number(startTemp.toFixed(2));

    this.logger.log(
      `Calculated startTemp for user ${userId}: ${roundedStartTemp}`,
    );

    // 4️⃣ Zapis u BoilerHistory
    /* await this.prisma.boilerHistory.create({
      data: {
        userId,
        externalTemp: weightedTemp,
        suggestedTemp: roundedStartTemp,
      },
    });
 */
    // 5️⃣ Izračun expectedHeatTime i confidence
    const heatDurations = events
      .filter((e) => e.timestampEnd)
      .map(
        (e) => (e.timestampEnd!.getTime() - e.timestampStart.getTime()) / 60000,
      ); // min
    const expectedHeatTimeMin = heatDurations.length
      ? heatDurations.reduce((a, b) => a + b, 0) / heatDurations.length
      : 30; // default
    const confidenceScore = Math.min(
      1,
      Math.max(0.1, heatDurations.length / 10),
    ); // raste sa brojem događaja

    // 6️⃣ Kreiraj Recommendation
    await this.prisma.recommendation.create({
      data: {
        userId,
        date: new Date(),
        recommendedFlowTemp: roundedStartTemp,
        expectedHeatTimeMin,
        confidenceScore,
      },
    });

    // 7️⃣ Update home profile sa learning info
    await this.prisma.homeProfile.update({
      where: { id: home.id },
      data: {
        learningOffset: learningOffset,
        learningConfidence: confidenceScore,
      },
    });

    return roundedStartTemp;
  }

  async createMorningBoilerHistory(userId: number, city: string) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(6, 0, 0, 0); // dan počinje u 6:00

    // 1️⃣ Zadnja temperatura od prethodnog dana
    const lastBh = await this.prisma.boilerHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const lastActualTemp = lastBh?.suggestedTemp ?? 50;

    // 2️⃣ Izračun start temperature
    const suggestedTemp = await this.calculateStartTemp(userId, city);

    // 3️⃣ Dohvati vanjsku temp
    const { temp_min, temp_max } =
      await this.weatherService.getTodayWeather(city);
    const externalTemp = 0.7 * (temp_min ?? 0) + 0.3 * (temp_max ?? 0);

    // 4️⃣ Kreiraj jutarnji BoilerHistory zapis
    const bh = await this.prisma.boilerHistory.create({
      data: {
        userId,
        externalTemp,
        suggestedTemp,
        actualTemp: lastActualTemp,
      },
    });

    this.logger.log(
      `Morning BoilerHistory for user ${userId}: suggested=${suggestedTemp}, actual=${lastActualTemp}, external=${externalTemp}`,
    );

    return bh;
  }

  private calculateCurveTemp(ext: number): number {
    if (ext >= 10) return 45;
    if (ext <= -15) return 56;
    return 51 - ext * 0.3;
  }
}
