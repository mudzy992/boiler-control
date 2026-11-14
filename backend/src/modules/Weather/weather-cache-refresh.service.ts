import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { WeatherV2Service } from './weather-v2.service';
import { getWeatherV2Config } from './weather-v2.config';

/**
 * Pozadinsko osvježavanje keša vremena v2.
 *
 * **Zašto postoji \u2014 mjereno, ne pretpostavljeno.** `getCachedWeather` samo
 * **čita** `WeatherV2Cache`; keš puni isključivo `getWeather()`, kojeg zove
 * `GET /api/weather/v2/current/:id` \u2014 dakle **samo kad korisnik otvori
 * karticu vremena**. Posljedice, izmjerene na produkciji (`14.11.2026`):
 *
 * | mjerenje | vrijednost |
 * |---|---|
 * | sati sa `outdoorTempC` (36 h) | **1** |
 * | pokrivenost uzoraka | **0,8 %** |
 * | dana bez ijednog `outdoorTempC` | **5** |
 * | stanje keša | **27 h star**, vraćao bi 18,3 \u00b0C umjesto ~4 \u00b0C |
 *
 * `outdoorTempC` nije samo mjerni podatak: `daily-balance.ts:133` odbija dan
 * sa `NO_OUTDOOR`, pa bez njega **model kuće (`slopeS`, `internalGainC`) ne
 * nastaje**, a `F_eq` zavisi od `slopeS`. Zato je ovo popravka ispravnosti, a
 * ne \u201eposao za F3.4\u201d.
 *
 * **Zašto NE proširiti `WEATHER_CURRENT_HIDDEN_AFTER_MINUTES`.** Izmjereno
 * (`§10.39`): keš je bio 27 h star i vratio bi 18,3 \u00b0C dok je stvarno ~4 \u00b0C.
 * Duži prozor ne osvježava ništa \u2014 samo prestaje skrivati staru vrijednost, pa
 * ona ulazi u model kao svježa. Odbijen dan je vidljiv; prihvaćen dan sa
 * pogrešnim ulazom nije.
 *
 * **Sigurnosna pravila (svako ima razlog):**
 *
 * 1. **Samo potvrđene lokacije.** `refreshConfirmedLocations` traži redove sa
 *    `weatherLocationConfirmedAt != null` i providerom \u2014 dakle **isti uslov**
 *    kao `confirmedLocation()`, ali kao upit. Bez toga bi cron radio posao za
 *    domove koji v2 uopšte ne koriste.
 * 2. **Interval 30 min** (`WEATHER_CACHE_REFRESH_MINUTES`) prema `staleAfter`
 *    od 15 min: keš je svjež 2\u00d7 duže nego što između osvježavanja, pa
 *    `freshness` ne prelazi u `stale` ni ako jedan ciklus padne.
 * 3. **Deduplikacija po lokaciji.** `getWeather` je po `(userId, homeProfileId)`,
 *    ali keš je po `cacheKey` = lat/lon/tz. Deset kuća u istom gradu zato daje
 *    **jedan** mrežni poziv \u2014 `refreshInFlight` u servisu hvata paralelne, a
 *    ovdje se hvataju **sekvencijalni** (isti `cacheKey` preskače se u petlji).
 * 4. **Greška jednog doma ne zaustavlja ostale** i **ne obara job**: log + broj
 *    u rezultatu. Cron koji padne ostavlja keš starijim, a to je tačno stanje
 *    koje popravljamo.
 * 5. **Isključivo `getWeather` (puni), nikad `getCachedWeather` (čita).** Druga
 *    bi bila besmislena: osvježavanje koje ne osvježava.
 */
/**
 * Minimalni oblik Prisma klijenta koji ovaj servis koristi.
 *
 * **Zašto interfejs, a ne `PrismaService` direktno.** `PrismaService` nasljeđuje
 * generisani klijent iz `src/generated/prisma`, a taj direktorij je u
 * `.gitignore` — u repou stoji **stub** bez modela. Zato `this.prisma.homeProfile`
 * ne postoji u tipu dok se klijent ne generiše (a u ovom okruženju generisanje
 * pada jer `binaries.prisma.sh` nije dostupan).
 *
 * Interfejs rješava oba: provjerava oblik koji servis stvarno koristi i ne
 * zavisi od toga je li klijent generisan. Runtime ponašanje je nepromijenjeno —
 * `PrismaService` ga zadovoljava.
 */
interface ConfirmedLocationQuery {
  homeProfile: {
    findMany(args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
    }): Promise<
      Array<{
        id: number;
        userId: number;
        weatherLatitude: number | null;
        weatherLongitude: number | null;
        weatherTimezone: string | null;
      }>
    >;
  };
}

@Injectable()
export class WeatherCacheRefreshService {
  private readonly logger = new Logger(WeatherCacheRefreshService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService & ConfirmedLocationQuery,
    private readonly weatherV2: WeatherV2Service,
  ) {}

  /**
   * Interval u minutama. `null` = pozadinsko osvježavanje **isključeno**.
   *
   * Zašto podesivo: u testovima i lokalno cron ne treba da ide u mrežu, a u
   * produkciji 30 min je odabrano mjerenjem (v. zaglavlje). `0`, negativno i
   * `NaN` se odbijaju \u2014 isti razlog kao kod `weatherHttpTimeoutMs`: vrijednost
   * koja tiho postane 0 pretvori bi cron u petlju bez pauze.
   */
  static refreshMinutes(
    raw: string | undefined = process.env.WEATHER_CACHE_REFRESH_MINUTES,
  ): number | null {
    if (raw === undefined || raw.trim() === '') return 30;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 30;
    return Math.floor(parsed);
  }

  /**
   * Osvježi keš za sve domove sa potvrđenom lokacijom.
   *
   * Vraća brojeve koji se loguju; `skippedDuplicates` je ono što dokazuje
   * deduplikaciju po lokaciji (v. pravilo 3 u zaglavlju).
   */
  async refreshConfirmedLocations(): Promise<{
    homes: number;
    refreshed: number;
    failed: number;
    skippedDuplicates: number;
  }> {
    const config = getWeatherV2Config();
    // Bez `WEATHER_LOCATION_V2` v2 put ne postoji \u2014 cron tada nema šta da radi.
    if (!config.locationEnabled) {
      return { homes: 0, refreshed: 0, failed: 0, skippedDuplicates: 0 };
    }

    const homes = await this.prisma.homeProfile.findMany({
      where: {
        weatherLocationConfirmedAt: { not: null },
        weatherLatitude: { not: null },
        weatherLongitude: { not: null },
        weatherLocationProviderId: { not: null },
        user: { isActive: true },
      },
      select: {
        id: true,
        userId: true,
        weatherLatitude: true,
        weatherLongitude: true,
        weatherTimezone: true,
      },
      orderBy: { id: 'asc' },
    });

    let refreshed = 0;
    let failed = 0;
    let skippedDuplicates = 0;
    const seen = new Set<string>();

    for (const home of homes) {
      const key = [
        home.weatherLatitude?.toFixed(5),
        home.weatherLongitude?.toFixed(5),
        home.weatherTimezone,
      ].join('|');

      // Ista lokacija, drugi dom: keš je već osvježen u ovom prolazu.
      if (seen.has(key)) {
        skippedDuplicates++;
        continue;
      }
      seen.add(key);

      try {
        /*
         * `getWeather` baca ako provajder padne **i** keš nema podataka.
         * Ako keš ima posljednje dobro stanje, servis ga vrati \u2014 pa je i to
         * uspjeh za potrebe ovog cron-a: keš nije ostao bez podataka.
         */
        await this.weatherV2.getWeather(home.userId, home.id);
        refreshed++;
      } catch (error) {
        failed++;
        this.logger.warn(
          `Osvježavanje keša nije uspjelo za dom ${home.id}: ` +
            `${(error as Error)?.message ?? error}`,
        );
      }
    }

    this.logger.log(
      `Keš vremena: ${homes.length} domova, osvježeno ${refreshed}, ` +
        `neuspjelo ${failed}, preskočeno kao duplikat ${skippedDuplicates}`,
    );

    return { homes: homes.length, refreshed, failed, skippedDuplicates };
  }

  /**
   * Raspored. Interval se **ne može** izraziti u dekoratoru jer dolazi iz env,
   * pa je cron svakih 5 min, a stvarni interval se provjerava unutra preko
   * `lastRunAt`. Tako `WEATHER_CACHE_REFRESH_MINUTES=30` znači 30, a ne
   * \u201esvakih 5, ali preskoči\u201d bez mjerenja vremena.
   */
  private lastRunAt = 0;

  @Cron('*/5 * * * *', {
    name: 'weather-cache-refresh',
    disabled:
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  })
  async scheduledRefresh(now: Date = new Date()): Promise<void> {
    const minutes = WeatherCacheRefreshService.refreshMinutes();
    if (minutes === null) return;

    const dueAt = this.lastRunAt + minutes * 60 * 1000;
    if (this.lastRunAt !== 0 && now.getTime() < dueAt) return;

    this.lastRunAt = now.getTime();
    await this.refreshConfirmedLocations();
  }
}
