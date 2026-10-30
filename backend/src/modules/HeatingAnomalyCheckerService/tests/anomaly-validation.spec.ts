/**
 * SEC-2 (B-010) — DTO validacija za `PATCH /api/anomalies/:eventId`.
 *
 * Prije popravke `UpdateHeatingAnomalyDto` nije imao NIJEDAN dekorator, a
 * `main.ts` koristi `whitelist: true` + `forbidNonWhitelisted: true`. Posljedica
 * je bila da class-validator skine sva polja (nema metapodataka o tome šta je
 * dozvoljeno), pa je **svaki** legitimni zahtjev dobijao 400 — potvrđeno u
 * `scripts/audit/anomaly_validation_repro.cjs`.
 *
 * Redoslijed je namjeran: owner provjera (SEC-2 prvi dio) je već na mjestu, pa
 * ovi validatori ne mogu postati način da se zaobiđe vlasništvo.
 */
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { UpdateHeatingAnomalyDto } from '../dto/heating-anomaly.dto';

/** Ista konfiguracija kao `main.ts:36-43`. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

async function validate(payload: unknown) {
  return pipe.transform(payload, {
    type: 'body',
    metatype: UpdateHeatingAnomalyDto,
  });
}

describe('SEC-2: DTO validacija anomalije', () => {
  it('`{ confirm: true }` prolazi (prije popravke davalo 400)', async () => {
    const result = await validate({ confirm: true });
    expect(result.confirm).toBe(true);
  });

  it('prazan body prolazi — oba polja su opciona', async () => {
    await expect(validate({})).resolves.toBeDefined();
  });

  it('ISO datum prolazi i postaje Date', async () => {
    const result = await validate({ proposedEndTime: '2026-10-30T12:30:00Z' });
    expect(result.proposedEndTime).toBeInstanceOf(Date);
    expect(result.proposedEndTime.toISOString()).toBe(
      '2026-10-30T12:30:00.000Z',
    );
  });

  it('neispravan datum je odbijen', async () => {
    await expect(
      validate({ proposedEndTime: 'nije-datum' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('nepoznato polje je odbijeno (forbidNonWhitelisted)', async () => {
    await expect(
      validate({ confirm: true, userId: 999 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pokušaj podvale `userId` u tijelu ne prolazi ni kao polje', async () => {
    // Vlasništvo dolazi isključivo iz JWT-a; tijelo ga ne može dodati.
    await expect(validate({ userId: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('obja polja zajedno prolaze', async () => {
    const result = await validate({
      confirm: true,
      proposedEndTime: '2026-10-30T12:30:00Z',
    });
    expect(result.confirm).toBe(true);
    expect(result.proposedEndTime).toBeInstanceOf(Date);
  });
});
