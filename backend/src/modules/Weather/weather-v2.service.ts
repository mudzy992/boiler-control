import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenMeteoV2Provider } from './openmeteo-v2.provider';
import { getWeatherV2Config } from './weather-v2.config';
import {
  WEATHER_V2_PROVIDER,
  type ConfirmedWeatherLocation,
  type WeatherForecastPayloadV2,
  type WeatherV2Response,
  type WeatherV2Success,
} from './weather-v2.types';

interface OwnedLocationProfile {
  id: number;
  weatherLatitude: number | null;
  weatherLongitude: number | null;
  weatherTimezone: string | null;
  weatherLocationProvider: string | null;
  weatherLocationProviderId: string | null;
  weatherLocationLabel: string | null;
  weatherLocationName: string | null;
  weatherLocationAdmin1: string | null;
  weatherLocationCountry: string | null;
  weatherLocationCountryCode: string | null;
  weatherLocationConfirmedAt: Date | null;
}

interface WeatherCacheRecord {
  cacheKey: string;
  provider: string;
  payload: unknown;
  fetchedAt: Date;
}

@Injectable()
export class WeatherV2Service {
  private readonly logger = new Logger(WeatherV2Service.name);
  private readonly refreshInFlight = new Map<
    string,
    Promise<WeatherCacheRecord>
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: OpenMeteoV2Provider,
  ) {}

  private assertEnabled() {
    if (!getWeatherV2Config().locationEnabled) {
      throw new NotFoundException('Weather v2 is not enabled');
    }
  }

  private async ownedProfile(
    userId: number,
    homeProfileId: number,
  ): Promise<OwnedLocationProfile> {
    const profile = await this.prisma.homeProfile.findFirst({
      where: { id: homeProfileId, userId },
      select: {
        id: true,
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
    });
    if (!profile) throw new NotFoundException('HomeProfile not found');
    return profile;
  }

  private confirmedLocation(
    profile: OwnedLocationProfile,
  ): ConfirmedWeatherLocation | null {
    if (
      profile.weatherLatitude === null ||
      profile.weatherLongitude === null ||
      !profile.weatherTimezone ||
      profile.weatherLocationProvider !== WEATHER_V2_PROVIDER ||
      !profile.weatherLocationProviderId ||
      !profile.weatherLocationLabel ||
      !profile.weatherLocationName ||
      !profile.weatherLocationConfirmedAt
    ) {
      return null;
    }
    return {
      provider: WEATHER_V2_PROVIDER,
      providerId: profile.weatherLocationProviderId,
      label: profile.weatherLocationLabel,
      name: profile.weatherLocationName,
      admin1: profile.weatherLocationAdmin1,
      country: profile.weatherLocationCountry,
      countryCode: profile.weatherLocationCountryCode,
      latitude: profile.weatherLatitude,
      longitude: profile.weatherLongitude,
      timezone: profile.weatherTimezone,
      confirmedAt: profile.weatherLocationConfirmedAt.toISOString(),
    };
  }

  async getLocationCandidates(
    userId: number,
    homeProfileId: number,
    query: string,
  ) {
    this.assertEnabled();
    await this.ownedProfile(userId, homeProfileId);
    const normalized = this.normalizeQuery(query);
    const candidates = await this.provider.geocode(normalized);
    return { query: normalized, candidates };
  }

  async confirmLocation(
    userId: number,
    homeProfileId: number,
    query: string,
    candidateId: string,
  ): Promise<{
    status: 'location_confirmed';
    location: ConfirmedWeatherLocation;
  }> {
    this.assertEnabled();
    await this.ownedProfile(userId, homeProfileId);
    const normalized = this.normalizeQuery(query);
    if (!candidateId || candidateId.length > 128) {
      throw new BadRequestException('A geocoder candidate must be selected');
    }

    // Coordinates are never accepted from the client. The selected ID must
    // still exist in a fresh geocoder response for the same query.
    const candidates = await this.provider.geocode(normalized);
    const selected = candidates.find(
      (candidate) => candidate.providerId === candidateId,
    );
    if (!selected) {
      throw new BadRequestException(
        'Selected geocoder candidate is no longer available',
      );
    }

    const confirmedAt = new Date();
    const result = await this.prisma.homeProfile.updateMany({
      where: { id: homeProfileId, userId },
      data: {
        weatherLatitude: selected.latitude,
        weatherLongitude: selected.longitude,
        weatherTimezone: selected.timezone,
        weatherLocationProvider: selected.provider,
        weatherLocationProviderId: selected.providerId,
        weatherLocationLabel: selected.label,
        weatherLocationName: selected.name,
        weatherLocationAdmin1: selected.admin1,
        weatherLocationCountry: selected.country,
        weatherLocationCountryCode: selected.countryCode,
        weatherLocationConfirmedAt: confirmedAt,
      },
    });
    if (result.count !== 1)
      throw new NotFoundException('HomeProfile not found');
    return {
      status: 'location_confirmed',
      location: { ...selected, confirmedAt: confirmedAt.toISOString() },
    };
  }

  private normalizeQuery(query: string): string {
    const normalized = query?.trim() ?? '';
    if (normalized.length < 2 || normalized.length > 100) {
      throw new BadRequestException(
        'Location query must contain 2-100 characters',
      );
    }
    return normalized;
  }

  private cacheKey(location: ConfirmedWeatherLocation): string {
    const identity = [
      'weather-v2',
      WEATHER_V2_PROVIDER,
      location.latitude.toFixed(5),
      location.longitude.toFixed(5),
      location.timezone,
      '72h',
      '7d',
    ].join('|');
    return createHash('sha256').update(identity).digest('hex');
  }

  async getWeather(
    userId: number,
    homeProfileId: number,
  ): Promise<WeatherV2Response> {
    this.assertEnabled();
    const profile = await this.ownedProfile(userId, homeProfileId);
    const location = this.confirmedLocation(profile);
    if (!location)
      return { version: 2, status: 'location_confirmation_required' };

    const cacheKey = this.cacheKey(location);
    const cached = (await this.prisma.weatherV2Cache.findUnique({
      where: { cacheKey },
    })) as WeatherCacheRecord | null;
    const config = getWeatherV2Config();
    const ageMs = cached
      ? Math.max(0, Date.now() - cached.fetchedAt.getTime())
      : 0;

    if (cached && ageMs < config.staleAfterMs) {
      return this.toResponse(
        location,
        cached,
        config.staleAfterMs,
        config.hideCurrentAfterMs,
      );
    }

    if (cached && config.swrEnabled) {
      this.scheduleRefresh(cacheKey, location);
      return this.toResponse(
        location,
        cached,
        config.staleAfterMs,
        config.hideCurrentAfterMs,
      );
    }

    try {
      const refreshed = await this.refresh(cacheKey, location);
      return this.toResponse(
        location,
        refreshed,
        config.staleAfterMs,
        config.hideCurrentAfterMs,
      );
    } catch {
      if (cached) {
        return this.toResponse(
          location,
          cached,
          config.staleAfterMs,
          config.hideCurrentAfterMs,
        );
      }
      throw new ServiceUnavailableException(
        'Weather is temporarily unavailable',
      );
    }
  }

  private scheduleRefresh(
    cacheKey: string,
    location: ConfirmedWeatherLocation,
  ) {
    if (this.refreshInFlight.has(cacheKey)) return;
    void this.refresh(cacheKey, location).catch(() => {
      this.logger.warn(
        'Weather v2 background refresh failed; keeping last-good data',
      );
    });
  }

  private refresh(
    cacheKey: string,
    location: ConfirmedWeatherLocation,
  ): Promise<WeatherCacheRecord> {
    const existing = this.refreshInFlight.get(cacheKey);
    if (existing) return existing;

    const operation = (async () => {
      const payload = await this.provider.fetchForecast(location);
      const fetchedAt = new Date();
      return (await this.prisma.weatherV2Cache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          provider: WEATHER_V2_PROVIDER,
          payload: payload as any,
          fetchedAt,
        },
        update: {
          provider: WEATHER_V2_PROVIDER,
          payload: payload as any,
          fetchedAt,
        },
      })) as WeatherCacheRecord;
    })();

    const tracked: Promise<WeatherCacheRecord> = operation.finally(() => {
      if (this.refreshInFlight.get(cacheKey) === tracked) {
        this.refreshInFlight.delete(cacheKey);
      }
    });
    this.refreshInFlight.set(cacheKey, tracked);
    return tracked;
  }

  private toResponse(
    location: ConfirmedWeatherLocation,
    cached: WeatherCacheRecord,
    staleAfterMs: number,
    hideCurrentAfterMs: number,
  ): WeatherV2Success {
    const fetchedAt = cached.fetchedAt;
    const ageMs = Math.max(0, Date.now() - fetchedAt.getTime());
    const payload = cached.payload as WeatherForecastPayloadV2;
    const currentHidden = ageMs >= hideCurrentAfterMs;
    return {
      version: 2,
      status: 'ok',
      source: WEATHER_V2_PROVIDER,
      location,
      observedAt: payload.observedAt,
      current: currentHidden ? null : payload.current,
      hourly: payload.hourly,
      daily: payload.daily,
      fetchedAt: fetchedAt.toISOString(),
      ageSeconds: Math.floor(ageMs / 1000),
      freshness: ageMs < staleAfterMs ? 'fresh' : 'stale',
      currentHidden,
    };
  }
}
