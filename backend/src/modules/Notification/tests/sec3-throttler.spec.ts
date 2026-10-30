/**
 * SEC-3 / R-004 — throttler mora stvarno ograničavati.
 *
 * Nalaz je bio `ttl` u **milisekundama** (60 ms) uz `limit: 100`, što je značilo
 * da je 100 zahtjeva dopušteno unutar 60 milisekundi — praktično bez
 * ograničenja. `app.module.ts` sada ima `ttl: 60` (sekunde) i `limit: 100`.
 *
 * Test je u zasebnom fajlu s pravom klasom kontrolera: ručno primijenjeni
 * dekoratori na `prototype` NE registruju guard (izmjereno sondom — svih 105
 * zahtjeva je prolazilo).
 */
import { Test } from '@nestjs/testing';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import request from 'supertest';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Controller('api')
@UseGuards(ThrottlerGuard)
class ThrottlePingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

describe('SEC-3 / R-004: throttler konfiguracija', () => {
  it('ttl u app.module.ts je izražen u milisekundama (>= 60000), uz limit 100', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'app.module.ts'),
      'utf8',
    );
    const limit = Number(src.match(/limit:\s*(\d+)/)?.[1]);
    expect(limit).toBe(100);

    // `ttl` je u MILISEKUNDAMA od @nestjs/throttler v5. Golobrojni `ttl: 60`
    // bi značio 60 ms — praktično bez ograničenja. Zahtijevamo `seconds(...)`.
    const secondsArg = Number(src.match(/ttl:\s*seconds\((\d+)\)/)?.[1]);
    expect(secondsArg).toBeGreaterThanOrEqual(60);
    expect(src).not.toMatch(/ttl:\s*\d/);
  });

  it('stvarni ThrottlerGuard propušta tačno `limit` zahtjeva, ostatak je 429', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: seconds(60), limit: 100 }],
        }),
      ],
      controllers: [ThrottlePingController],
    }).compile();

    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    let ok = 0;
    let blocked = 0;
    for (let i = 0; i < 105; i += 1) {
      const res = await request(app.getHttpServer()).get('/api/ping');
      if (res.status === 200) ok += 1;
      else if (res.status === 429) blocked += 1;
    }
    await app.close();

    expect(ok).toBe(100);
    expect(blocked).toBe(5);
  });
});
