import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * MAINT-2 — opt-in Redis klijent i zdravstvena provjera.
 *
 * Zašto postoji: CI podiže `redis:7` servis i izvozi `REDIS_URL`
 * (`.github/workflows/backend-audit.yml:29-35, 46`), ali aplikacija nikad nije
 * imala Redis klijenta — `grep REDIS_URL|ioredis|createClient src/` bio je
 * prazan, a `fallback-strategy.service.ts:70` je samo komentar „can be extended
 * to Redis". Rezultat je bio da Redis integracija u CI ne dokazuje ništa.
 *
 * UGOVOR O PONAŠANJU (kompatibilnost unazad):
 *   - Bez `REDIS_URL` servis je POTPUNO inertan: ne otvara socket, ne baca,
 *     `enabled === false`, a `/health` ne dodaje `redis` polje. Instalirane
 *     mobilne verzije i postojeći potrošači ne vide nikakvu razliku.
 *   - S `REDIS_URL` klijent se kreira LIJENO (`lazyConnect`) — tek prva
 *     komanda otvara vezu. Time instanciranje servisa (npr. u svakom testu
 *     koji učita AppModule) ne ostavlja otvoren socket i ne ruši Jest.
 *   - Greške veze se gutaju i pretvaraju u `connected: false`. Zdravstvena
 *     provjera nikad ne smije srušiti proces koji bi inače radio.
 *   - Tajne se ne loguju: ispisuje se isključivo `err.message`.
 *
 * Servis NE uvodi redove, workere ni keširanje poslovnih podataka — to su
 * arhitektonske odluke izvan obima MAINT-2 (MASTER-ROADMAP „Šta NE raditi").
 */

export interface RedisHealthStatus {
  /** Da li je Redis uopšte uključen (`REDIS_URL` postavljen). */
  enabled: boolean;
  /** Da li je `PING` prošao. */
  connected: boolean;
  /** Odgovor servera na `PING`, obično `"PONG"`. */
  pong?: string;
  /** Trajanje `PING` komande u milisekundama. */
  latencyMs?: number;
  /** Poruka greške kad veza nije uspostavljena. Bez tajni. */
  error?: string;
}

export interface RedisLease {
  key: string;
  value: string;
  ttlMs: number;
  /** `true` samo ako je `SET ... NX` zaista upisao ključ. */
  acquired: boolean;
}

@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisHealthService.name);
  private client: Redis | null = null;
  private unavailable = false;

  /**
   * Klijent se kreira tek pri prvom pozivu. Bez `REDIS_URL` se odluka
   * pamti u `unavailable` da se env ne čita na svaku komandu.
   */
  private getClient(): Redis | null {
    if (this.client) return this.client;
    if (this.unavailable) return null;

    const url = process.env.REDIS_URL;
    if (!url) {
      this.unavailable = true;
      return null;
    }

    try {
      const client = new Redis(url, {
        // Ne otvaraj socket pri konstrukciji — instanciranje servisa (npr. u
        // svakom testu koji učita AppModule) ne smije ostaviti otvorenu vezu.
        lazyConnect: true,
        // Offline red MORA biti uključen: s lazyConnect prva komanda pokreće
        // connect(), a socket još nije writeable. Bez reda ioredis odmah baca
        // "Stream isn't writeable and enableOfflineQueue options is false"
        // (izmjereno lokalno, MAINT-2). Red komande samo privremeno zadrži.
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        // Ne pokušavaj zauvijek: zdravstvena provjera treba brzo odustati, pa
        // se i komande u redu odbace umjesto da vise.
        retryStrategy: (attempt: number) =>
          attempt > 2 ? null : Math.min(attempt * 200, 1000),
      });
      client.on('error', (err: Error) => {
        this.logger.warn(`Redis greška: ${err.message}`);
      });
      this.client = client;
      return client;
    } catch (err) {
      // Neispravan URL i sl. — ostajemo inertni umjesto da rušimo aplikaciju.
      this.unavailable = true;
      this.logger.warn(
        `Redis klijent se ne može kreirati: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /** Da li je Redis uključen. Sinonim za `REDIS_URL` postavljen + klijent moguć. */
  get enabled(): boolean {
    return this.getClient() !== null;
  }

  /** `PING` — najjeftinija stvarna Redis komanda iz aplikacije. */
  async ping(): Promise<RedisHealthStatus> {
    const client = this.getClient();
    if (!client) return { enabled: false, connected: false };

    const startedAt = Date.now();
    try {
      const pong = await client.ping();
      return {
        enabled: true,
        connected: true,
        pong,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      return {
        enabled: true,
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * `SET key value NX PX ttlMs` — zauzimanje lease-a.
   * Vraća `acquired: false` (NE baca) kad ključ već postoji, što je NX
   * semantika i osnova za idempotentno zaključavanje.
   */
  async acquireLease(
    key: string,
    ttlMs: number,
    value = `${process.pid}:${Date.now()}`,
  ): Promise<RedisLease | null> {
    const client = this.getClient();
    if (!client) return null;

    const result = await client.set(key, value, 'PX', ttlMs, 'NX');
    return { key, value, ttlMs, acquired: result === 'OK' };
  }

  /** `GET key` — čitanje vrijednosti lease-a. */
  async readLease(key: string): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;
    return client.get(key);
  }

  /** `PTTL key` — preostali TTL u milisekundama; `-2` = ključ ne postoji. */
  async leaseTtlMs(key: string): Promise<number | null> {
    const client = this.getClient();
    if (!client) return null;
    return client.pttl(key);
  }

  /**
   * `DEL key`, ali samo ako vrijednost odgovara — sprječava da jedan radnik
   * obriše tuđi lease nakon što mu je TTL istekao.
   */
  async releaseLease(key: string, value: string): Promise<number | null> {
    const client = this.getClient();
    if (!client) return null;

    const current = await client.get(key);
    if (current !== value) return 0;
    return client.del(key);
  }

  /**
   * Sigurno gašenje: `quit()` uz fallback na `disconnect()` ako server ne
   * odgovori. Bez ovoga bi proces visio na otvorenom socketu.
   */
  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (!client) return;

    // `quit()` čeka odgovor servera. Nad klijentom koji se nikad nije povezao
    // (status 'wait' uz lazyConnect) ili koji je već ugašen ('end') to bi
    // visilo, pa se takvi gase sinhrono.
    const status = client.status;
    if (status === 'wait' || status === 'end') {
      client.disconnect();
      return;
    }

    try {
      // Ograničeno čekanje: ako server ne odgovori, prisilno prekini.
      await Promise.race([
        client.quit(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('quit timeout')), 1000),
        ),
      ]);
    } catch {
      client.disconnect();
    }
  }
}
