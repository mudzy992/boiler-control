import { Injectable, Logger } from '@nestjs/common';

/**
 * MO2-2: ugovor koji mobilna aplikacija čita da odluči smije li raditi.
 *
 * Ovo je JAVNI ugovor — instalirane verzije aplikacije ovise o njemu, pa se
 * polja smiju samo DODAVATI, nikad preimenovati ili uklanjati bez version
 * gatea koji štiti stare klijente.
 */
export interface AppConfig {
  /**
   * Najstarija verzija mobilne aplikacije koja se još smije koristiti.
   * Klijent čija je verzija manja od ove mora prikazati "update required".
   */
  minSupportedVersion: string;
  /** Najnovija dostupna verzija (informativno, za "dostupna je nova verzija"). */
  latestVersion: string;
  /**
   * Kill switch. Kad je `false`, `minSupportedVersion` je `0.0.0` i nijedan
   * klijent ne smije blokirati korisnika — čak ni ako env var kaže suprotno.
   */
  versionGateEnabled: boolean;
}

/**
 * Strogi semver bez prerelease/build dijelova. Namjerno jednostavno: vrijednost
 * dolazi iz env-a i mora biti očito ispravna, a backend ne uvodi `semver`
 * zavisnost (u repou je bila prisutna samo kao fantomska/transitivna).
 */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Najstarija verzija koja se danas nalazi kod korisnika. Dok se ne objavi
 * breaking promjena API ugovora (API-1/API-2), ovo NE treba podizati —
 * podizanje iznad stvarno instalirane verzije zaključalo bi sve postojeće
 * instalacije.
 */
const DEFAULT_MIN_SUPPORTED_VERSION = '1.0.0';

/** Verzija koja se objavljuje uz ovaj kod. */
const DEFAULT_LATEST_VERSION = '2.0.0';

/** Vrijednost koja garantuje da nijedan klijent neće biti blokiran. */
const NEVER_BLOCK_VERSION = '0.0.0';

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  /**
   * Vraća konfiguraciju mobilne aplikacije.
   *
   * Ponašanje je namjerno **fail-safe**: neispravna env vrijednost se loguje i
   * zanemaruje, a vraća se sigurna zadana vrijednost. Servis nikad ne baca —
   * endpoint koji baca zaključao bi korisnike van aplikacije.
   */
  getAppConfig(): AppConfig {
    const versionGateEnabled = this.resolveGateEnabled();

    if (!versionGateEnabled) {
      return {
        minSupportedVersion: NEVER_BLOCK_VERSION,
        latestVersion: this.resolveVersion(
          'MOBILE_LATEST_VERSION',
          DEFAULT_LATEST_VERSION,
        ),
        versionGateEnabled: false,
      };
    }

    return {
      minSupportedVersion: this.resolveVersion(
        'MOBILE_MIN_SUPPORTED_VERSION',
        DEFAULT_MIN_SUPPORTED_VERSION,
      ),
      latestVersion: this.resolveVersion(
        'MOBILE_LATEST_VERSION',
        DEFAULT_LATEST_VERSION,
      ),
      versionGateEnabled: true,
    };
  }

  /**
   * Kill switch. Zadano UKLJUČENO, jer je cijela svrha MO2-2 da gate postoji
   * prije prve promjene API ugovora; s `minSupportedVersion` na stvarno
   * instaliranoj verziji to ne blokira nikoga, a vlasnik ga može ugasiti bez
   * deploya ako endpoint počne vraćati gluposti.
   */
  private resolveGateEnabled(): boolean {
    const raw = process.env.APP_VERSION_GATE_ENABLED;
    if (raw === undefined || raw.trim() === '') {
      return true;
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;

    this.logger.warn(
      `APP_VERSION_GATE_ENABLED ima neispravnu vrijednost "${raw}" — koristim zadano (true).`,
    );
    return true;
  }

  /**
   * Čita verziju iz env-a. Neispravan format se loguje i vraća se zadana
   * vrijednost, jer bi propagiranje tipfelera iz env-a u klijente moglo
   * blokirati korisnike.
   */
  private resolveVersion(envKey: string, fallback: string): string {
    const raw = process.env[envKey];
    if (raw === undefined || raw.trim() === '') {
      return fallback;
    }

    const normalized = raw.trim();
    if (!SEMVER_PATTERN.test(normalized)) {
      this.logger.warn(
        `${envKey} nije u formatu MAJOR.MINOR.PATCH ("${raw}") — koristim zadano "${fallback}".`,
      );
      return fallback;
    }

    return normalized;
  }
}
