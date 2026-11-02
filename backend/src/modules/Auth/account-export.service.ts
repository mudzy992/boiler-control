import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getAccountExportConfig } from './account-export.config';

const EXPORT_FORMAT = 'boiler-control.account-export';
const EXPORT_VERSION = 1;
const BOUNDS_ERROR = 'Account export exceeds configured bounds';

@Injectable()
export class AccountExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportAccount(userId: number) {
    const config = getAccountExportConfig();
    if (!config.enabled) {
      throw new NotFoundException('Account export is not available');
    }

    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        homeLocation: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        locale: true,
        plan: true,
        prefersDarkMode: true,
        role: true,
        timezone: true,
        activeHomeProfileId: true,
        gasPriceExVat: true,
        currentBoilerFlowTemp: true,
        currentBoilerFlowTempSetAt: true,
      },
    });
    if (!account) throw new NotFoundException('User not found');

    const take = config.maxRowsPerCollection + 1;
    const bounded = <T>(query: Promise<T[]>) => this.boundedRows(query, config);
    const [
      homeProfiles,
      heatingIntervalLearnings,
      thermostatDevices,
      thermostatPrograms,
      heatingEvents,
      recommendations,
      boilerHistories,
      gasReadingRows,
      gasPriceHistory,
      notifications,
      notificationPreferences,
      devices,
      sessions,
    ] = await Promise.all([
      bounded(
        this.prisma.homeProfile.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            userId: true,
            floorArea: true,
            ceilingHeight: true,
            insulationType: true,
            insulationThickness: true,
            windowType: true,
            constructionYear: true,
            createdAt: true,
            updatedAt: true,
            learningConfidence: true,
            learningOffset: true,
            heatingType: true,
            seasonMode: true,
            boilerModel: true,
            hasFloorHeating: true,
            homeName: true,
            numberOfResidents: true,
            preferredScheduleNotes: true,
            targetDayTemp: true,
            targetMorningTemp: true,
            targetNightTemp: true,
            location: true,
            weatherLatitude: true,
            weatherLongitude: true,
            weatherTimezone: true,
            weatherLocationProvider: true,
            weatherLocationProviderId: true,
            weatherLocationLabel: true,
            weatherLocationName: true,
            weatherLocationAdmin1: true,
            weatherLocationCountry: true,
            weatherLocationCountryCode: true,
            weatherLocationConfirmedAt: true,
          },
        }),
      ),
      bounded(
        this.prisma.heatingIntervalLearning.findMany({
          where: { homeProfile: { userId } },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            homeProfileId: true,
            intervalKey: true,
            avgReachTimeMin: true,
            avgOvershoot: true,
            offset: true,
            confidence: true,
            samples: true,
            lastUpdated: true,
          },
        }),
      ),
      bounded(
        this.prisma.thermostatDevice.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            alias: true,
            lastSeen: true,
            createdAt: true,
            updatedAt: true,
            homeProfileId: true,
            mode: true,
            deviceId: true,
            userId: true,
            vendor: true,
            roomCurrentTemp: true,
            roomTargetTemp: true,
            lastSnapshotAt: true,
          },
        }),
      ),
      bounded(
        this.prisma.thermostatProgram.findMany({
          where: { device: { userId } },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            deviceId: true,
            dayType: true,
            startMinute: true,
            targetTemp: true,
            orderIndex: true,
            createdAt: true,
            updatedAt: true,
            programHash: true,
          },
        }),
      ),
      bounded(
        this.prisma.heatingEvent.findMany({
          where: { thermostat: { userId } },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            roomCurrentTemp: true,
            roomTargetTemp: true,
            source: true,
            createdAt: true,
            deviceId: true,
            hvacAction: true,
            timestampEnd: true,
            timestampStart: true,
            isAnomaly: true,
            proposedEndTime: true,
            userConfimed: true,
            anomalyCheckedAt: true,
          },
        }),
      ),
      bounded(
        this.prisma.recommendation.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            userId: true,
            recommendedFlowTemp: true,
            expectedHeatTimeMin: true,
            confidenceScore: true,
            breakdown: true,
            createdAt: true,
            date: true,
          },
        }),
      ),
      bounded(
        this.prisma.boilerHistory.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            userId: true,
            externalTemp: true,
            suggestedFlowTemp: true,
            actualFlowTemp: true,
            heatingStart: true,
            heatingEnd: true,
            createdAt: true,
          },
        }),
      ),
      bounded(
        this.prisma.gasReading.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            userId: true,
            readingDate: true,
            counterValue: true,
            consumption: true,
            createdAt: true,
            invoiceGasPriceExVat: true,
            invoicePdfMime: true,
            invoicePdfOriginalName: true,
            invoicePdfPath: true,
            invoiceUploadedAt: true,
            isInvoiceReference: true,
            meterImageMime: true,
            meterImageOriginalName: true,
            meterImagePath: true,
            referenceMonth: true,
          },
        }),
      ),
      bounded(
        this.prisma.gasPriceHistory.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            userId: true,
            priceExVat: true,
            vatRate: true,
            effectiveFrom: true,
            effectiveTo: true,
            source: true,
            gasReadingId: true,
            createdAt: true,
          },
        }),
      ),
      bounded(
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            userId: true,
            type: true,
            title: true,
            message: true,
            data: true,
            sentAt: true,
            deliveryOk: true,
            sourceRef: true,
            createdAt: true,
            isRead: true,
          },
        }),
      ),
      bounded(
        this.prisma.notificationPreference.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            userId: true,
            type: true,
            enabled: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ),
      bounded(
        this.prisma.userDevice.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            userId: true,
            platform: true,
            expoPushToken: true,
            isActive: true,
            lastSeenAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ),
      bounded(
        this.prisma.refreshToken.findMany({
          where: { userId },
          orderBy: { id: 'asc' },
          take,
          select: {
            id: true,
            userId: true,
            expiresAt: true,
            revokedAt: true,
            userAgent: true,
            ipAddress: true,
            createdAt: true,
          },
        }),
      ),
    ]);

    const gasReadings = gasReadingRows.map((row) => {
      const { meterImagePath, invoicePdfPath, ...metadata } = row;
      return {
        ...metadata,
        downloads: {
          meterImage: meterImagePath
            ? `/api/gas/reading/${row.id}/meter-image`
            : null,
          invoicePdf: invoicePdfPath
            ? `/api/gas/reading/${row.id}/invoice`
            : null,
        },
      };
    });

    const payload = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      generatedAt: new Date().toISOString(),
      account,
      collections: {
        homeProfiles,
        heatingIntervalLearnings,
        thermostatDevices,
        thermostatPrograms,
        heatingEvents,
        recommendations,
        boilerHistories,
        gasReadings,
        gasPriceHistory,
        notifications,
        notificationPreferences,
        devices,
        sessions,
      },
    };

    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, 'utf8') > config.maxBytes) {
      throw new PayloadTooLargeException(BOUNDS_ERROR);
    }
    return payload;
  }

  private async boundedRows<T>(
    query: Promise<T[]>,
    config: { maxRowsPerCollection: number },
  ): Promise<T[]> {
    const rows = await query;
    if (rows.length > config.maxRowsPerCollection) {
      throw new PayloadTooLargeException(BOUNDS_ERROR);
    }
    return rows;
  }
}
