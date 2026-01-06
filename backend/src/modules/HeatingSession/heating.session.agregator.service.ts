import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ThermostatMode } from 'src/generated/prisma/enums';

interface HeatingSession {
  homeProfileId: number;
  deviceId: number;
  intervalKey: string;
  mode: ThermostatMode;
  startTime: Date;
  endTime?: Date;
  initialTemp: number;
  targetTemp: number;
  reached: boolean;
  timeToTargetMin?: number;
  overshoot?: number;
  externalTempAvg?: number;
  flowTempAvg?: number;
}

@Injectable()
export class HeatingSessionAggregator {
  private activeSessions: Map<number, HeatingSession> = new Map(); // key=deviceId

  constructor(private prisma: PrismaService) {}

  // poziva se za svaki novi HeatingEvent
  async processHeatingEvent(event: {
    deviceId: number;
    homeProfileId: number;
    timestamp: Date;
    currentTemp: number;
    targetTemp: number;
    hvacAction: string; // HEATING_ON / HEATING_OFF
    mode: ThermostatMode;
    externalTemp: number;
  }) {
    const { deviceId } = event;
    let session = this.activeSessions.get(deviceId);

    // start nove sesije
    if (!session && event.hvacAction === 'HEATING_ON') {
      session = {
        homeProfileId: event.homeProfileId,
        deviceId,
        intervalKey: this.getIntervalKey(event.timestamp, event.mode),
        mode: event.mode,
        startTime: event.timestamp,
        initialTemp: event.currentTemp,
        targetTemp: event.targetTemp,
        reached: false,
        externalTempAvg: event.externalTemp,
        flowTempAvg: event.targetTemp,
      };
      this.activeSessions.set(deviceId, session);
      return;
    }

    if (!session) return; // ništa za učiti ako nema aktivne sesije

    // update session
    session.flowTempAvg = (session.flowTempAvg! + event.targetTemp) / 2;
    session.externalTempAvg =
      (session.externalTempAvg! + event.externalTemp) / 2;

    // završetak sesije: grijanje OFF ili target dostignut
    const targetReached = event.currentTemp >= event.targetTemp;
    if (event.hvacAction === 'HEATING_OFF' || targetReached) {
      session.endTime = event.timestamp;
      session.reached = targetReached;
      session.timeToTargetMin = targetReached
        ? (event.timestamp.getTime() - session.startTime.getTime()) / 60000
        : undefined;
      session.overshoot = targetReached
        ? event.currentTemp - session.targetTemp
        : undefined;

      await this.saveSession(session);
      this.activeSessions.delete(deviceId);
    }
  }

  private getIntervalKey(timestamp: Date, mode: ThermostatMode) {
    // prost primjer: weekday_morning_1
    const day = timestamp.getDay(); // 0=Sun ... 6=Sat
    const hour = timestamp.getHours();
    let part = 'day';
    if (hour < 12) part = 'morning';
    else if (hour < 18) part = 'afternoon';
    else part = 'evening';
    return `${mode}_${day}_${part}`;
  }

  private async saveSession(session: HeatingSession) {
    // Sačuvaj u HeatingIntervalLearning (ili direktno obradi learning offset)
    const existing = await this.prisma.heatingIntervalLearning.findUnique({
      where: {
        homeProfileId_intervalKey: {
          homeProfileId: session.homeProfileId,
          intervalKey: session.intervalKey,
        },
      },
    });

    if (existing) {
      const totalSamples = existing.samples + 1;
      const newOffset =
        (existing.offset * existing.samples +
          (session.targetTemp - session.initialTemp)) /
        totalSamples;
      const newConfidence = Math.min(
        1,
        (existing.confidence * existing.samples + 1) / totalSamples,
      );

      await this.prisma.heatingIntervalLearning.update({
        where: { id: existing.id },
        data: {
          offset: newOffset,
          confidence: newConfidence,
          samples: totalSamples,
          avgReachTimeMin: session.timeToTargetMin || existing.avgReachTimeMin,
          avgOvershoot: session.overshoot || existing.avgOvershoot,
          lastUpdated: new Date(),
        },
      });
    } else {
      await this.prisma.heatingIntervalLearning.create({
        data: {
          homeProfileId: session.homeProfileId,
          intervalKey: session.intervalKey,
          offset: session.targetTemp - session.initialTemp,
          confidence: 1,
          samples: 1,
          avgReachTimeMin: session.timeToTargetMin!,
          avgOvershoot: session.overshoot!,
          lastUpdated: new Date(),
        },
      });
    }
  }
}
