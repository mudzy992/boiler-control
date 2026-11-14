import { WeatherCacheRefreshService } from '../weather-cache-refresh.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Testovi za pozadinsko osvježavanje keša.
 *
 * Zašto postoje, i zašto baš ovi slučajevi: mjereno je da `outdoorTempC`
 * postoji u **1 satu od 36** i da **5 dana** nema ni jedan uzorak, jer keš
 * puni samo korisnički poziv. Popravka uvodi cron koji zove **`getWeather`
 * (puni)**, a ne `getCachedWeather` (čita) — a ta razlika se u testu mora
 * **dokazati**, jer bi zamjena metode tiho vratila isto stanje koje popravljamo.
 */
describe('WeatherCacheRefreshService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('refreshMinutes', () => {
    it('zadano je 30 kad env nije postavljen', () => {
      delete process.env.WEATHER_CACHE_REFRESH_MINUTES;
      expect(WeatherCacheRefreshService.refreshMinutes(undefined)).toBe(30);
    });

    it('prazan string daje zadano', () => {
      expect(WeatherCacheRefreshService.refreshMinutes('')).toBe(30);
      expect(WeatherCacheRefreshService.refreshMinutes('  ')).toBe(30);
    });

    it('vrijedan broj se poštuje', () => {
      expect(WeatherCacheRefreshService.refreshMinutes('15')).toBe(15);
      expect(WeatherCacheRefreshService.refreshMinutes('60')).toBe(60);
    });

    /*
     * Ista granica kao kod timeouta: nula ili negativno u rasporedu nije
     * "nula minuta" nego petlja bez pauze. Nikad se ne smije desiti tiho.
     */
    it.each(['0', '-5', 'abc', 'NaN'])(
      'neispravno "%s" pada na zadano umjesto da postane 0',
      (raw) => {
        expect(WeatherCacheRefreshService.refreshMinutes(raw)).toBe(30);
      },
    );
  });

  describe('refreshConfirmedLocations', () => {
    const home = (id: number, lat: number, lon: number) => ({
      id,
      userId: 1,
      weatherLatitude: lat,
      weatherLongitude: lon,
      weatherTimezone: 'Europe/Sarajevo',
    });

    function build(options: {
      homes: unknown[];
      getWeather?: jest.Mock;
      locationEnabled?: boolean;
    }) {
      const getWeather =
        options.getWeather ?? jest.fn().mockResolvedValue({ status: 'ok' });
      const prisma = {
        homeProfile: { findMany: jest.fn().mockResolvedValue(options.homes) },
      };
      const service = new WeatherCacheRefreshService(
        prisma as never,
        { getWeather } as never,
      );
      if (options.locationEnabled === false) {
        process.env.WEATHER_LOCATION_V2 = 'off';
      } else {
        process.env.WEATHER_LOCATION_V2 = 'on';
      }
      return { service, getWeather, prisma };
    }

    it('poziva getWeather (puni keš), NE getCachedWeather (samo čita)', async () => {
      const { service, getWeather } = build({ homes: [home(3, 43.98, 18.17)] });

      await service.refreshConfirmedLocations();

      expect(getWeather).toHaveBeenCalledTimes(1);
      expect(getWeather).toHaveBeenCalledWith(1, 3);
      /*
       * Suština popravke je METODA, i to se dokazuje ODSUTNOŠĆU alternative.
       *
       * `getWeather` puni, `getCachedWeather` samo čita. Servis u testu dobija
       * samo `getWeather`, pa bi poziv `getCachedWeather` bio
       * `TypeError: getCachedWeather is not a function` i test bi pao.
       *
       * Da je ovdje `expect(getWeather).toHaveBeenCalled()` samo, test bi
       * prošao i da servis čita keš (jer bi tada zvao drugu metodu, a ovaj
       * mock bi ostao nekorišten). Zato se provjerava da je **ovaj** mock
       * pozvan, sa argumentima doma — a alternative nema u objektu.
       */
      expect(getWeather).toHaveBeenCalledWith(1, 3);
    });

    it('dedupira po lokaciji: 3 doma u istom gradu = 1 poziv', async () => {
      const { service, getWeather } = build({
        homes: [
          home(3, 43.98, 18.17),
          home(4, 43.98, 18.17),
          home(5, 43.98, 18.17),
        ],
      });

      const result = await service.refreshConfirmedLocations();

      expect(getWeather).toHaveBeenCalledTimes(1);
      expect(result.skippedDuplicates).toBe(2);
      expect(result.refreshed).toBe(1);
    });

    it('različite lokacije se ne dedupiraju', async () => {
      const { service, getWeather } = build({
        homes: [home(3, 43.98, 18.17), home(4, 44.2, 17.6)],
      });

      const result = await service.refreshConfirmedLocations();

      expect(getWeather).toHaveBeenCalledTimes(2);
      expect(result.skippedDuplicates).toBe(0);
    });

    it('greška jednog doma ne zaustavlja ostale i ne obara poziv', async () => {
      const getWeather = jest
        .fn()
        .mockRejectedValueOnce(new Error('provider down'))
        .mockResolvedValueOnce({ status: 'ok' });
      const { service } = build({
        homes: [home(3, 43.98, 18.17), home(4, 44.2, 17.6)],
        getWeather,
      });

      const result = await service.refreshConfirmedLocations();

      expect(result.failed).toBe(1);
      expect(result.refreshed).toBe(1);
      expect(getWeather).toHaveBeenCalledTimes(2);
    });

    it('ne radi ništa kad je WEATHER_LOCATION_V2 isključen', async () => {
      const { service, getWeather } = build({
        homes: [home(3, 43.98, 18.17)],
        locationEnabled: false,
      });

      const result = await service.refreshConfirmedLocations();

      expect(getWeather).not.toHaveBeenCalled();
      expect(result.homes).toBe(0);
    });

    it('upit traži samo potvrđene lokacije aktivnih korisnika', async () => {
      const { service, prisma } = build({ homes: [] });

      await service.refreshConfirmedLocations();

      const where = (prisma.homeProfile.findMany as jest.Mock).mock.calls[0][0]
        .where;
      expect(where.weatherLocationConfirmedAt).toEqual({ not: null });
      expect(where.user).toEqual({ isActive: true });
    });
  });

  describe('scheduledRefresh', () => {
    it('prvi poziv odmah osvježi, drugi unutar intervala preskače', async () => {
      const getWeather = jest.fn().mockResolvedValue({ status: 'ok' });
      const service = new WeatherCacheRefreshService(
        {
          homeProfile: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 3,
                userId: 1,
                weatherLatitude: 43.98,
                weatherLongitude: 18.17,
                weatherTimezone: 'Europe/Sarajevo',
              },
            ]),
          },
        } as never,
        { getWeather } as never,
      );
      process.env.WEATHER_LOCATION_V2 = 'on';

      const t0 = new Date('2026-11-14T10:00:00Z');
      await service.scheduledRefresh(t0);
      expect(getWeather).toHaveBeenCalledTimes(1);

      // 5 min poslije, a interval je 30 -> preskače.
      process.env.WEATHER_CACHE_REFRESH_MINUTES = '30';
      await service.scheduledRefresh(new Date(t0.getTime() + 5 * 60_000));
      expect(getWeather).toHaveBeenCalledTimes(1);

      // 31 min poslije -> osvježava.
      await service.scheduledRefresh(new Date(t0.getTime() + 31 * 60_000));
      expect(getWeather).toHaveBeenCalledTimes(2);
    });
  });
  describe('DI metadata', () => {
    it('deklarira PrismaService kao tip prvog parametra (bez @Inject Nest bi dobio Object)', () => {
      // `prisma` je tipiziran kao `PrismaService & ConfirmedLocationQuery`; unija
      // sprečava TS da emituje `design:paramtypes`, pa bi bez eksplicitnog
      // @Inject(`PrismaService`) Nest prijavio "can't resolve dependencies ... index [0]".
      // Ovaj test čita emitovanu metadata-u, tj. ono što Nest stvarno vidi.
      const metadata: unknown[] = Reflect.getMetadata(
        'design:paramtypes',
        WeatherCacheRefreshService,
      );
      // Emitovani tip je zaista `Object` — to je razlog zašto @Inject mora postojati.
      expect(metadata[0]).toBe(Object);

      // Nest bilježi `{ index, param }` — polje se zove `param`, ne `token`.
      const injectTokens: Array<{ index: number; param: unknown }> =
        Reflect.getOwnMetadata('self:paramtypes', WeatherCacheRefreshService) ??
        [];
      const prismaToken = injectTokens.find(
        (entry) => entry.index === 0,
      )?.param;
      expect(prismaToken).toBe(PrismaService);
    });
  });
});
