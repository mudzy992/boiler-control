import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { TvPairingStatus } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../Auth/auth.service';
import { RefreshTokenService } from '../Auth/refresh-token.service';
import {
  PAIRING_MAX_POLLS,
  PAIRING_TTL_MS,
  generatePairingCode,
  hashCode,
  isPairingCodeShaped,
} from './pairing-code';

/**
 * Uparivanje Android TV-a QR kodom.
 *
 * **Zašto ovako, a ne prijavom na TV-u.** TV daljinski nema tastaturu kojom se
 * unos i lozinka mogu otipkati bez izlaganja; QR kod prenosi **jednokratni
 * kod**, a ne lozinku, i telefon (već prijavljen) ga odobrava. TV nikad ne vidi
 * korisnikovu lozinku.
 *
 * **Četiri pravila koja ovaj servis mora da poštuje** (svako ima test):
 *
 * 1. **Kod se ne čuva u čistom obliku** — samo SHA-256 (`pairing-code.ts`).
 * 2. **Kod je jednokratan**: preuzimanje mijenja stanje u `CLAIMED` i briše
 *    tokene iz reda. Drugi zahtjev sa istim kodom ne dobija ništa.
 * 3. **Tuđi TV se ne može preuzeti**: kod se preuzima bez prijave (to je
 *    poenta), pa je jedina zaštita to da TV dobije tokene **samo ako je
 *    telefon odobrio** i to za tačno taj kod.
 * 4. **Neuspjeh ne otkriva stanje**: nepostojeći kod, istekao kod i kod
 *    drugog korisnika daju **istu** grešku. Razlikovanje bi omogućilo
 *    provjeru „postoji li ovaj kod".
 */
@Injectable()
export class TvPairingService {
  private readonly logger = new Logger(TvPairingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /**
   * TV traži kod. **Bez prijave** — TV još nema korisnika.
   *
   * Vraća i `expiresAt` u ISO obliku da TV može prikazati odbrojavanje bez
   * računanja na osnovu lokalnog sata (koji na TV-u često nije tačan).
   */
  async create(
    deviceLabel?: string,
    tvPushToken?: string,
  ): Promise<{
    code: string;
    expiresAt: string;
    pollIntervalMs: number;
  }> {
    // Kod se generiše u petlji jer je `codeHash` `@unique`: kolizija od ~8,5 ×
    // 10^11 je rijetka, ali bi bez petlje dala 500 umjesto novog koda.
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    let code = generatePairingCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await this.prisma.tvPairingSession.findUnique({
        where: { codeHash: hashCode(code) },
        select: { id: true },
      });
      if (!existing) break;
      code = generatePairingCode();
      if (attempt === 4) {
        throw new BadRequestException(
          'Nije moguće izdati kod — pokušaj ponovo',
        );
      }
    }

    const session = await this.prisma.tvPairingSession.create({
      data: {
        codeHash: hashCode(code),
        // SAMO prva četiri znaka — v. `codeHint` u šemi.
        codeHint: code.slice(0, 4),
        expiresAt,
        approvedByDevice: deviceLabel ?? null,
        // Push token ide uz zahtjev za kod jer je ovo JEDINI POST koji TV
        // smije poslati. Upisuje se u `UserDevice` tek pri odobrenju (v.
        // `approve()`), pa neupareni TV ne može primati ništa.
        tvPushToken: tvPushToken ?? null,
      },
    });

    this.logger.log(
      `[tv-pairing] session ${session.id} created; pushTokenAttached=${tvPushToken ? 'yes' : 'no'}`,
    );

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      // TV pita na 2 s: dovoljno brzo da korisnik ne čeka, a 30 upita u
      // minuti ne opterećuje server.
      pollIntervalMs: 2000,
    };
  }

  /**
   * TV pita je li kod odobren. **Bez prijave** — TV još nema token.
   *
   * Kad telefon odobri, ovaj poziv vraća tokene **i** mijenja stanje u
   * `CLAIMED`, pa drugi poziv sa istim kodom ne dobija ništa.
   */
  async claim(code: string): Promise<
    | { status: 'PENDING' | 'APPROVED' | 'CLAIMED' | 'EXPIRED' | 'REJECTED' }
    | {
        status: 'READY';
        token: string;
        refreshToken: string;
        userId: number;
      }
  > {
    if (!isPairingCodeShaped(code)) {
      throw new NotFoundException('Kod nije pronađen');
    }

    const session = await this.prisma.tvPairingSession.findUnique({
      where: { codeHash: hashCode(code) },
    });

    // Namjerno ista greška za „ne postoji" i „istekao": razlika bi otkrila
    // koji kodovi su postojali.
    if (!session) throw new NotFoundException('Kod nije pronađen');

    if (session.expiresAt.getTime() < Date.now()) {
      if (session.status !== 'EXPIRED' || session.tvPushToken) {
        await this.prisma.tvPairingSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED', tvPushToken: null },
        });
      }
      return { status: 'EXPIRED' };
    }

    if (session.status === 'REJECTED') return { status: 'REJECTED' };
    if (session.status === 'CLAIMED') return { status: 'CLAIMED' };

    if (session.pollCount >= PAIRING_MAX_POLLS) {
      await this.prisma.tvPairingSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED', tvPushToken: null },
      });
      return { status: 'EXPIRED' };
    }

    await this.prisma.tvPairingSession.update({
      where: { id: session.id },
      data: { pollCount: { increment: 1 } },
    });

    if (session.status === 'PENDING') {
      return { status: 'PENDING' };
    }

    // `APPROVED`: izdaj tokene TAČNO jednom.
    if (!session.userId || !session.accessToken || !session.refreshToken) {
      // Nedosljedno stanje (odobreno bez tokena) — ne izdajemo ništa.
      this.logger.warn(
        `[tv-pairing] sesija ${session.id} je APPROVED bez izdatih tokena`,
      );
      throw new NotFoundException('Kod nije pronađen');
    }

    const claimed = await this.prisma.tvPairingSession.updateMany({
      // Uslov na `status` je ono što garantuje jednokratnost: dva paralelna
      // zahtjeva ne mogu oba proći, jer drugi nađe `CLAIMED`.
      where: { id: session.id, status: 'APPROVED' },
      data: { status: 'CLAIMED', claimedAt: new Date() },
    });

    if (claimed.count === 0) {
      return { status: 'CLAIMED' };
    }

    // Fallback retry: a transient database issue during phone approval must
    // not strand the TV token in its short-lived pairing row indefinitely.
    await this.registerTvDevice(
      session.userId,
      session.tvPushToken,
      session.approvedByDevice ?? undefined,
      session.id,
    );

    return {
      status: 'READY',
      token: session.accessToken,
      refreshToken: session.refreshToken,
      userId: session.userId,
    };
  }

  /**
   * Telefon odobrava kod. **Traži prijavu** — telefon već ima sesiju.
   *
   * Ovdje se izdaju tokeni (jednom), vezani za korisnika sa telefona. TV ih
   * preuzima u `claim()`.
   */
  async approve(
    userId: number,
    code: string,
    deviceLabel?: string,
  ): Promise<{ status: TvPairingStatus }> {
    if (!isPairingCodeShaped(code)) {
      throw new NotFoundException('Kod nije pronađen');
    }

    const session = await this.prisma.tvPairingSession.findUnique({
      where: { codeHash: hashCode(code) },
    });

    if (!session) throw new NotFoundException('Kod nije pronađen');
    if (session.expiresAt.getTime() < Date.now()) {
      await this.prisma.tvPairingSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED', tvPushToken: null },
      });
      throw new BadRequestException('Kod je istekao');
    }
    if (session.status !== 'PENDING') {
      // Već odobren/preuzet/odbijen — ne mijenjamo ništa. Odbijanje tuđeg
      // zahtjeva bilo bi način da se tuđi TV prekine.
      throw new BadRequestException('Kod više nije aktivan');
    }

    const accessToken = this.auth.issueAccessToken(userId);
    // `userAgent: 'tv-pairing'` je revizijski trag: u tabeli `RefreshToken` se
    // vidi da sesija nije došla sa telefona/web-a nego iz uparivanja TV-a.
    // Zato je i `revokeAllForUser` može razlikovati ako to ikad zatreba.
    const issued = await this.refreshTokens.issue(userId, {
      userAgent: 'tv-pairing',
    });

    /*
     * `updateMany` sa uslovom `status: 'PENDING'` je zaštita od dvostrukog
     * odobrenja: dva telefona koja skeniraju isti kod ne mogu oba proći, jer
     * drugi nađe `APPROVED` i njegov `count` je 0.
     */
    const approved = await this.prisma.tvPairingSession.updateMany({
      where: { id: session.id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        userId,
        accessToken,
        refreshToken: issued.token,
        approvedByDevice: deviceLabel ?? session.approvedByDevice,
      },
    });

    if (approved.count === 0) {
      // Uto je neko drugi odobrio — naš refresh token je suvišan.
      await this.refreshTokens.revoke(issued.token);
      throw new BadRequestException('Kod više nije aktivan');
    }

    await this.registerTvDevice(
      userId,
      session.tvPushToken,
      deviceLabel,
      session.id,
    );

    return { status: 'APPROVED' };
  }

  /**
   * Upiši TV kao `UserDevice` da bi dobijao push.
   *
   * **Zašto ovdje, a ne da TV sam registruje token.** TV radi samo GET; da bi
   * dobijao notifikacije morao bi zvati `POST /api/notifications/register-token`
   * — drugi upis koji TV ne smije. Zato token dolazi uz zahtjev za kod, a
   * registracija se dešava ovdje, na serveru, kad telefon odobri.
   *
   * **Zašto `kind: 'TV'`.** Bez toga bi notifikacija namijenjena TV-u otišla i
   * na telefon i obrnuto, a korisnik ne bi mogao razlikovati odakle je (v.
   * `getUserTokens(userId, kind)`).
   *
   * **Zašto `upsert` po tokenu, a ne po `userId`.** Isti TV se može ponovo
   * upariti (nakon odjave ili reinstalacije) — tada token već postoji i treba
   * ga **reaktivirati**, ne napraviti duplikat. Duplikat znači dvije
   * notifikacije za isti događaj.
   *
   * Greška ovdje **ne smije** oboriti uparivanje: TV je već dobio tokene i
   * može prikazivati analitiku. Bez push-a je osakaćen, ali upotrebljiv —
   * zato samo logujemo.
   */
  private async registerTvDevice(
    userId: number,
    tvPushToken: string | null,
    deviceLabel: string | undefined,
    pairingSessionId: number,
  ): Promise<void> {
    if (!tvPushToken) {
      this.logger.warn(
        `[tv-pairing] no TV push token to register for user=${userId} session=${pairingSessionId}`,
      );
      return;
    }

    try {
      await this.prisma.userDevice.upsert({
        where: { expoPushToken: tvPushToken },
        create: {
          userId,
          expoPushToken: tvPushToken,
          // TV je Android uređaj; `kind` je ono što ga razdvaja od telefona.
          platform: 'android',
          kind: 'TV',
          label: deviceLabel ?? 'Android TV',
          isActive: true,
        },
        update: {
          userId,
          kind: 'TV',
          label: deviceLabel ?? 'Android TV',
          // Reinstalacija/odjava pa novo uparivanje: token se vraća u pogon.
          isActive: true,
        },
      });
      this.logger.log(
        `[tv-pairing] active TV push device registered for user=${userId} session=${pairingSessionId}`,
      );
    } catch (error) {
      // Zadrži token na sesiji kako bi kvar mogao biti dijagnostikovan ili
      // ponovo obrađen; nikad ne prijavljuj uspjeh registracije ako upsert padne.
      this.logger.warn(
        `[tv-pairing] TV uređaj nije registrovan za push (korisnik ${userId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    // Sesija je samo kratkotrajni transport za token. Nakon potvrđenog upserta
    // brišemo kopiju da token ne ostane trajno u TvPairingSession.
    try {
      await this.prisma.tvPairingSession.update({
        where: { id: pairingSessionId },
        data: { tvPushToken: null },
      });
    } catch (error) {
      this.logger.warn(
        `[tv-pairing] TV push token je registrovan, ali nije uklonjen iz sesije ${pairingSessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Korisnik odbija kod. Traži prijavu, da odbijenicu ne može poslati bilo ko. */
  async reject(
    userId: number,
    code: string,
  ): Promise<{ status: TvPairingStatus }> {
    if (!isPairingCodeShaped(code)) {
      throw new NotFoundException('Kod nije pronađen');
    }

    const session = await this.prisma.tvPairingSession.findUnique({
      where: { codeHash: hashCode(code) },
    });
    if (!session) throw new NotFoundException('Kod nije pronađen');

    /*
     * Tuđu sesiju ne možemo ni odbiti: `REJECTED` prekida TV koji čeka, pa bi
     * to bio način da neko prekine tuđe uparivanje. Zato se traži ili da je
     * sesija još bez vlasnika (prvi koji odbije), ili da je vlasnik isti.
     */
    if (session.userId != null && session.userId !== userId) {
      throw new ForbiddenException('Kod nije aktivan');
    }

    await this.prisma.tvPairingSession.updateMany({
      where: { id: session.id, status: { in: ['PENDING', 'APPROVED'] } },
      data: { status: 'REJECTED', userId, tvPushToken: null },
    });

    return { status: 'REJECTED' };
  }

  /**
   * Stanje svih aktivnih kodova korisnika — za ekran „upareni uređaji".
   *
   * Ovo NIJE `claim`: ne vraća tokene i ne mijenja stanje, samo prikazuje.
   */
  listForUser(userId: number) {
    return this.prisma.tvPairingSession.findMany({
      where: { userId, status: { in: ['APPROVED', 'CLAIMED'] } },
      select: {
        id: true,
        codeHint: true,
        status: true,
        createdAt: true,
        claimedAt: true,
        approvedByDevice: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
