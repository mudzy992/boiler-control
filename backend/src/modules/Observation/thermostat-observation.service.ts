import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  observationBucketIndex,
  observationBucketStart,
} from './observation-bucket';

/**
 * Vremenska serija stanja uređaja — jedini pisac `ThermostatObservation`
 * redova (`17` §13 korak 2).
 *
 * Serija je ono bez čega nema učenja: `a` i `b` iz `17` §6 ne mogu se
 * izračunati iz jednog očitanja po uređaju (`ThermostatDevice.roomCurrentTemp`
 * se prepisuje svake minute) ni iz dva po ciklusu (`HeatingEvent`).
 */

export type ObservationSource = 'TUYA' | 'MANUAL';

export interface ObservationSample {
  deviceId: number;
  homeProfileId: number;
  /** Stvarni trenutak očitanja; bucket se računa iz njega. */
  now: Date;
  roomTempC: number | null;
  targetTempC: number | null;
  isHeating: boolean;
  outdoorTempC: number | null;
  flowSetC: number | null;
  source?: ObservationSource;
}

export type ObservationWriteResult = 'created' | 'exists' | 'skipped';

/**
 * `null` ostaje `null` — nikad 0. Nesmislen broj (`NaN`, `Infinity`) takođe
 * postaje `null`, jer bi u bazi izgledao kao mjerenje.
 */
export function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Prisma prijavljuje unique-violation kao `code === 'P2002'`. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Gornja granica internog praćenja bucketa. Nije poslovno pravilo nego
 * sigurnost za pamćenje: ako se prekorači, mapa se prazni i najviše se izgubi
 * po jedan pokušaj upisa po uređaju — unique indeks i dalje čuva seriju.
 */
const MAX_TRACKED_DEVICES = 10_000;

@Injectable()
export class ThermostatObservationService {
  private readonly logger = new Logger(ThermostatObservationService.name);

  /**
   * Zadnji upisani bucket po uređaju. Ovo je **optimizacija**, ne garancija:
   * bez nje bi svaki minutni ciklus pokušao upis koji u 4 od 5 slučajeva pada
   * na unique indeksu. Garant je `@@unique([deviceId, at])` u bazi, pa gubitak
   * ove mape (restart) znači samo jedan suvišan pokušaj.
   */
  private readonly lastBucketByDevice = new Map<number, number>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Je li ovaj trenutak novi bucket za uređaj? Služi da polling ne troši
   * čitanje vanjske temperature na cikluse koji ionako ne bi upisali ništa.
   * Nije garancija (garant je unique indeks) — samo najava.
   */
  isDue(deviceId: number, now: Date): boolean {
    return (
      this.lastBucketByDevice.get(deviceId) !==
      observationBucketStart(now).getTime()
    );
  }

  async record(sample: ObservationSample): Promise<ObservationWriteResult> {
    const bucket = observationBucketStart(sample.now);
    const bucketKey = bucket.getTime();

    if (this.lastBucketByDevice.get(sample.deviceId) === bucketKey) {
      return 'skipped';
    }

    if (this.lastBucketByDevice.size > MAX_TRACKED_DEVICES) {
      this.lastBucketByDevice.clear();
      this.logger.warn(
        `Praćenje bucketa je prešlo ${MAX_TRACKED_DEVICES} uređaja — mapa je očišćena.`,
      );
    }

    try {
      await this.prisma.thermostatObservation.create({
        data: {
          deviceId: sample.deviceId,
          homeProfileId: sample.homeProfileId,
          at: bucket,
          roomTempC: finiteOrNull(sample.roomTempC),
          targetTempC: finiteOrNull(sample.targetTempC),
          isHeating: sample.isHeating,
          outdoorTempC: finiteOrNull(sample.outdoorTempC),
          flowSetC: finiteOrNull(sample.flowSetC),
          source: sample.source ?? 'TUYA',
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Bucket je već zapisan (drugi proces ili restart) — to nije greška.
        this.lastBucketByDevice.set(sample.deviceId, bucketKey);
        return 'exists';
      }
      // Prava greška: bucket se NE bilježi kao obrađen, pa naredni ciklus
      // pokušava ponovo umjesto da pet minuta ostane prazno.
      throw error;
    }

    this.lastBucketByDevice.set(sample.deviceId, bucketKey);
    return 'created';
  }

  /** Samo za testove i za buduće brisanje uređaja. */
  forgetDevice(deviceId: number): void {
    this.lastBucketByDevice.delete(deviceId);
  }

  /** Broj bucketa koji pripadaju datom trenutku — za test i za dijagnostiku. */
  static bucketIndex(now: Date): number {
    return observationBucketIndex(now);
  }
}
