/**
 * MAINT-2 — dokaz da aplikacija izvršava stvarne Redis komande.
 *
 * Prije ove stavke CI je podizao `redis:7` i izvozio `REDIS_URL`
 * (`.github/workflows/backend-audit.yml:29-35, 46`), ali aplikacija nije imala
 * Redis klijenta, pa ta integracija nije dokazivala ništa. Ovi testovi
 * zatvaraju tu rupu.
 *
 * Dva suitea:
 *   1. „inertan bez REDIS_URL" — pokreće se UVIJEK (i lokalno i u CI) i dokazuje
 *      opt-in ugovor: bez konfiguracije nema socketa i nema bacanja.
 *   2. „stvarne komande" — gated na `REDIS_URL`. Lokalno taj suite je preskočen
 *      (nema Redis servera), u CI se STVARNO izvršava jer workflow izvozi
 *      `REDIS_URL=redis://127.0.0.1:6379` uz health-checked `redis:7` servis.
 *
 * Komande koje aplikacija izdaje, sve preko `ioredis` klijenta u
 * `RedisHealthService` (nikako preko vanjskog `redis-cli`):
 *   PING · SET key val NX PX ttl · GET key · PTTL key · DEL key
 */
import { RedisHealthService } from '../redis-health.service';

/** Jedinstven prefiks ključeva da paralelni runovi ne gaze jedni druge. */
const PREFIX = `maint2:${process.pid}:${Date.now()}`;

describe('MAINT-2: RedisHealthService je inertan bez REDIS_URL', () => {
  const ORIGINAL = process.env.REDIS_URL;
  let service: RedisHealthService;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    service = new RedisHealthService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    if (ORIGINAL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = ORIGINAL;
  });

  it('enabled === false kad REDIS_URL nije postavljen', () => {
    expect(service.enabled).toBe(false);
  });

  it('ping() vraća { enabled: false, connected: false } i ne baca', async () => {
    const status = await service.ping();

    expect(status).toEqual({ enabled: false, connected: false });
  });

  it('lease operacije vraćaju null umjesto da otvaraju vezu', async () => {
    expect(await service.acquireLease(`${PREFIX}:inert`, 1000)).toBeNull();
    expect(await service.readLease(`${PREFIX}:inert`)).toBeNull();
    expect(await service.leaseTtlMs(`${PREFIX}:inert`)).toBeNull();
    expect(await service.releaseLease(`${PREFIX}:inert`, 'x')).toBeNull();
  });

  it('neispravan REDIS_URL ne ruši proces — servis ostaje inertan', async () => {
    process.env.REDIS_URL = 'not-a-redis-url';
    const broken = new RedisHealthService();

    // Ne smije baciti; greška se guta u `connected: false`.
    const status = await broken.ping();
    expect(status.enabled).toBe(true);
    expect(status.connected).toBe(false);
    expect(typeof status.error).toBe('string');
    // Tajne/URL se ne ispisuju u polju greške koje ide u odgovor.
    expect(status.error ?? '').not.toContain('not-a-redis-url');

    await broken.onModuleDestroy();
  });
});

const describeWithRedis = process.env.REDIS_URL ? describe : describe.skip;

describeWithRedis(
  'MAINT-2: RedisHealthService izvršava stvarne Redis komande',
  () => {
    let service: RedisHealthService;
    const key = `${PREFIX}:lease`;

    beforeAll(() => {
      service = new RedisHealthService();
    });

    afterAll(async () => {
      await service.onModuleDestroy();
    });

    beforeEach(async () => {
      // Čist start po testu, bez oslanjanja na redoslijed.
      const client = await service.readLease(key);
      if (client !== null) {
        await service.releaseLease(key, client);
      }
    });

    it('enabled === true kad je REDIS_URL postavljen', () => {
      expect(service.enabled).toBe(true);
    });

    it('PING: server odgovara PONG s izmjerenom latencijom', async () => {
      const status = await service.ping();

      expect(status.enabled).toBe(true);
      expect(status.connected).toBe(true);
      expect(status.pong).toBe('PONG');
      expect(typeof status.latencyMs).toBe('number');
      expect(status.latencyMs ?? -1).toBeGreaterThanOrEqual(0);
      expect(status.error).toBeUndefined();
    });

    it('SET NX PX upisuje ključ, a GET ga vraća', async () => {
      const lease = await service.acquireLease(key, 5000, 'worker-a');

      expect(lease).not.toBeNull();
      expect(lease?.acquired).toBe(true);
      expect(await service.readLease(key)).toBe('worker-a');
    });

    it('SET NX ne prepisuje postojeći ključ (NX semantika)', async () => {
      const first = await service.acquireLease(key, 5000, 'worker-a');
      const second = await service.acquireLease(key, 5000, 'worker-b');

      expect(first?.acquired).toBe(true);
      expect(second?.acquired).toBe(false);
      // Vrijednost prvog je netaknuta — dokaz da NX nije prepisao.
      expect(await service.readLease(key)).toBe('worker-a');
    });

    it('PX zaista postavlja TTL koji ističe', async () => {
      await service.acquireLease(key, 5000, 'worker-a');

      const ttl = await service.leaseTtlMs(key);
      expect(ttl).not.toBeNull();
      // Mora biti postavljen (nije -1 = bez TTL-a) i unutar traženog prozora.
      expect(ttl ?? -1).toBeGreaterThan(0);
      expect(ttl ?? -1).toBeLessThanOrEqual(5000);
    });

    it('DEL s pogrešnom vrijednošću NE briše tuđi lease', async () => {
      await service.acquireLease(key, 5000, 'worker-a');

      expect(await service.releaseLease(key, 'worker-b')).toBe(0);
      expect(await service.readLease(key)).toBe('worker-a');
    });

    it('DEL s tačnom vrijednošću briše ključ', async () => {
      await service.acquireLease(key, 5000, 'worker-a');

      expect(await service.releaseLease(key, 'worker-a')).toBe(1);
      expect(await service.readLease(key)).toBeNull();
      // PTTL nad nepostojećim ključem je -2.
      expect(await service.leaseTtlMs(key)).toBe(-2);
    });
  },
);
