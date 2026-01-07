import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getUserDashboard(userId: number) {
    // Dohvati sve HomeProfile-e korisnika
    const homeProfiles = await this.prisma.homeProfile.findMany({
      where: { userId },
      include: {
        thermostatDevices: true,
        intervalLearnings: true,
      },
    });

    // Dohvati recenzije / preporuke
    const recommendations = await this.prisma.recommendation.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 5,
    });

    // Dohvati istoriju grijanja
    const recentHeatingEvents = await this.prisma.heatingEvent.findMany({
      where: {
        thermostat: { userId },
      },
      orderBy: { timestampStart: 'desc' },
      take: 10,
    });

    // Agregacija po HomeProfile
    const result = homeProfiles.map((profile) => ({
      id: profile.id,
      floorArea: profile.floorArea,
      ceilingHeight: profile.ceilingHeight,
      insulationType: profile.insulationType,
      windowType: profile.windowType,
      heatingType: profile.heatingType,
      learningOffset: profile.learningOffset,
      learningConfidence: profile.learningConfidence,
      thermostatDevices: profile.thermostatDevices.map((t) => ({
        id: t.id,
        alias: t.alias,
        mode: t.mode,
        deviceId: t.deviceId,
        vendor: t.vendor,
        lastSeen: t.lastSeen,
      })),
      intervalLearnings: profile.intervalLearnings.map((i) => ({
        key: i.intervalKey,
        offset: i.offset,
        confidence: i.confidence,
        avgReachTimeMin: i.avgReachTimeMin,
        avgOvershoot: i.avgOvershoot,
      })),
      recentHeatingEvents: recentHeatingEvents
        .filter((e) =>
          profile.thermostatDevices.some((t) => t.id === e.deviceId),
        )
        .map((e) => ({
          deviceId: e.deviceId,
          timestampStart: e.timestampStart,
          timestampEnd: e.timestampEnd,
          currentTemp: e.currentTemp,
          targetTemp: e.targetTemp,
          hvacAction: e.hvacAction,
          source: e.source,
        })),
      recommendations: recommendations.map((r) => ({
        date: r.date,
        recommendedFlowTemp: r.recommendedFlowTemp,
        confidenceScore: r.confidenceScore,
      })),
    }));

    return result;
  }
}
