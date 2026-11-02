import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const NULLABLE_STRING = { type: String, nullable: true } as const;
const NULLABLE_NUMBER = { type: Number, nullable: true } as const;
const NULLABLE_BOOLEAN = { type: Boolean, nullable: true } as const;

export class WeatherLocationCandidateDto {
  @ApiProperty({ enum: ['open-meteo'] })
  provider!: 'open-meteo';

  @ApiProperty()
  providerId!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty(NULLABLE_STRING)
  admin1!: string | null;

  @ApiProperty(NULLABLE_STRING)
  country!: string | null;

  @ApiProperty(NULLABLE_STRING)
  countryCode!: string | null;

  @ApiProperty()
  latitude!: number;

  @ApiProperty()
  longitude!: number;

  @ApiProperty({ description: 'IANA timezone returned by the geocoder.' })
  timezone!: string;
}

export class ConfirmedWeatherLocationDto extends WeatherLocationCandidateDto {
  @ApiProperty({ type: String, format: 'date-time' })
  confirmedAt!: string;
}

export class WeatherLocationCandidatesResponseDto {
  @ApiProperty()
  query!: string;

  @ApiProperty({ type: () => WeatherLocationCandidateDto, isArray: true })
  candidates!: WeatherLocationCandidateDto[];
}

export class ConfirmWeatherLocationResponseDto {
  @ApiProperty({ enum: ['location_confirmed'] })
  status!: 'location_confirmed';

  @ApiProperty({ type: () => ConfirmedWeatherLocationDto })
  location!: ConfirmedWeatherLocationDto;
}

export class WeatherCurrentV2Dto {
  @ApiProperty(NULLABLE_NUMBER)
  temperatureC!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  apparentTemperatureC!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  humidityPercent!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  windKph!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  gustKph!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  windDirectionDegrees!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  pressureHpa!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  cloudPercent!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  conditionCode!: number | null;

  @ApiProperty()
  conditionKey!: string;

  @ApiProperty()
  conditionI18nKey!: string;

  @ApiProperty(NULLABLE_BOOLEAN)
  isDay!: boolean | null;
}

export class WeatherHourV2Dto {
  @ApiProperty({ type: String, format: 'date-time' })
  at!: string;

  @ApiProperty(NULLABLE_NUMBER)
  temperatureC!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  apparentTemperatureC!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  humidityPercent!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  precipitationProbabilityPercent!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  precipitationMm!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  windKph!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  gustKph!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  windDirectionDegrees!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  conditionCode!: number | null;

  @ApiProperty()
  conditionKey!: string;

  @ApiProperty()
  conditionI18nKey!: string;

  @ApiProperty(NULLABLE_BOOLEAN)
  isDay!: boolean | null;
}

export class WeatherDayV2Dto {
  @ApiProperty({ ...NULLABLE_STRING, format: 'date', example: '2026-11-02' })
  date!: string | null;

  @ApiProperty(NULLABLE_NUMBER)
  temperatureMinC!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  temperatureMaxC!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  precipitationMm!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  precipitationProbabilityPercent!: number | null;

  @ApiProperty(NULLABLE_NUMBER)
  uvIndex!: number | null;

  @ApiProperty({ ...NULLABLE_STRING, format: 'date-time' })
  sunrise!: string | null;

  @ApiProperty({ ...NULLABLE_STRING, format: 'date-time' })
  sunset!: string | null;

  @ApiProperty(NULLABLE_NUMBER)
  conditionCode!: number | null;

  @ApiProperty()
  conditionKey!: string;

  @ApiProperty()
  conditionI18nKey!: string;
}

export class WeatherV2ResponseDto {
  @ApiProperty({ enum: [2] })
  version!: 2;

  @ApiProperty({ enum: ['ok', 'location_confirmation_required'] })
  status!: 'ok' | 'location_confirmation_required';

  @ApiPropertyOptional({ enum: ['open-meteo'] })
  source?: 'open-meteo';

  @ApiPropertyOptional({ type: () => ConfirmedWeatherLocationDto })
  location?: ConfirmedWeatherLocationDto;

  @ApiPropertyOptional({ ...NULLABLE_STRING, format: 'date-time' })
  observedAt?: string | null;

  @ApiPropertyOptional({ type: () => WeatherCurrentV2Dto, nullable: true })
  current?: WeatherCurrentV2Dto | null;

  @ApiPropertyOptional({ type: () => WeatherHourV2Dto, isArray: true })
  hourly?: WeatherHourV2Dto[];

  @ApiPropertyOptional({ type: () => WeatherDayV2Dto, isArray: true })
  daily?: WeatherDayV2Dto[];

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  fetchedAt?: string;

  @ApiPropertyOptional()
  ageSeconds?: number;

  @ApiPropertyOptional({ enum: ['fresh', 'stale'] })
  freshness?: 'fresh' | 'stale';

  @ApiPropertyOptional()
  currentHidden?: boolean;
}
