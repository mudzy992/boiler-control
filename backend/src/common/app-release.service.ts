import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService, APK_MAX_SIZE_BYTES } from './file-storage.service';

/**
 * `F15`: objavljivanje verzija mobilne aplikacije sa **našeg** servera.
 *
 * Ugovor koji ovaj servis nosi:
 *
 * 1. **Verzija se ne izmišlja.** Čita se iz uploadovanog APK-a
 *    (`assets/app.config` unutar ZIP-a), a admin je može ručno ispraviti.
 *    Automatsko povećanje je posljedica, ne pretpostavka: naredna verzija mora
 *    biti **veća** od posljednje objavljene, inače korisnik sa novijom
 *    instalacijom nikad ne bi dobio obavijest.
 * 2. **APK ostaje na serveru.** Nema Play Store-a i nema vanjskog linka;
 *    `downloadUrl` pokazuje na `/api/app-releases/:id/apk`.
 * 3. **Neuspješan upload ne ostavlja fajl.** Datoteka se upisuje tek poslije
 *    validacije verzije, a ako upis u bazu padne, fajl se briše.
 */

/** Semver bez prerelease dijela — isti oblik koji klijent upoređuje. */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export interface AppReleaseRow {
  id: number;
  version: string;
  buildNumber: number;
  sizeBytes: number;
  notes: string | null;
  isPublished: boolean;
  publishedAt: Date;
}

export interface AppReleaseDto extends AppReleaseRow {
  downloadUrl: string;
}

export interface UploadAppReleaseInput {
  file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
    originalname: string;
  };
  /** Ručna korekcija verzije kad se ne pročita iz APK-a. */
  version?: string;
  buildNumber?: number;
  notes?: string;
  isPublished?: boolean;
}

/**
 * Upoređuje dvije semver verzije. Isti algoritam kao mobilni
 * (`version.config.ts`) — namjerno, jer ako se razlikuju, klijent i server
 * donose različite odluke o istoj verziji.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) return va > vb ? 1 : -1;
  }
  return 0;
}

/**
 * Čita verziju iz `assets/app.config` unutar APK-a.
 *
 * APK je ZIP; zapis može biti kompresovan (metoda 8) ili samo uskladišten
 * (metoda 0). Oba slučaja se podržavaju jer `expo build` koristi kompresiju za
 * JS bundle, a `app.config` je u nekim buildovima uskladišten.
 *
 * Vraća `null` kad ne uspije — **ne baca**. Neuspjeh čitanja je normalan
 * slučaj (drugačiji build alat), a admin tada unosi verziju ručno; bacanje bi
 * značilo da se APK ne može objaviti i kad je verzija očigledna iz naziva.
 */
export function readVersionFromApk(buffer: Buffer): {
  version: string | null;
  buildNumber: number | null;
} {
  const config = readZipEntry(buffer, 'assets/app.config');
  if (!config) return { version: null, buildNumber: null };

  const text = config.toString('utf8');
  const version = /"version"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? null;
  const buildNumber =
    /"(?:versionCode|android\.versionCode|buildNumber)"\s*:\s*(\d+)/.exec(
      text,
    )?.[1];

  return {
    version: version && SEMVER_PATTERN.test(version) ? version : null,
    buildNumber: buildNumber ? Number(buildNumber) : null,
  };
}

/** Minimalni ZIP čitač: centralni direktorij → lokalni header → sadržaj. */
function readZipEntry(archive: Buffer, entryName: string): Buffer | null {
  // End of central directory: potpis 0x06054b50, skenira se od kraja jer se
  // komentar arhive nalazi poslije njega.
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (
    let i = archive.length - 22;
    i >= 0 && i >= archive.length - 66_000;
    i -= 1
  ) {
    if (archive.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const totalEntries = archive.readUInt16LE(eocd + 10);
  const centralOffset = archive.readUInt32LE(eocd + 16);

  let ptr = centralOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (ptr + 46 > archive.length || archive.readUInt32LE(ptr) !== 0x02014b50) {
      return null;
    }
    const method = archive.readUInt16LE(ptr + 10);
    const compressedSize = archive.readUInt32LE(ptr + 20);
    const nameLength = archive.readUInt16LE(ptr + 28);
    const extraLength = archive.readUInt16LE(ptr + 30);
    const commentLength = archive.readUInt16LE(ptr + 32);
    const localOffset = archive.readUInt32LE(ptr + 42);
    const name = archive
      .subarray(ptr + 46, ptr + 46 + nameLength)
      .toString('utf8');

    if (name === entryName) {
      if (archive.readUInt32LE(localOffset) !== 0x04034b50) return null;
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = archive.subarray(dataStart, dataStart + compressedSize);

      if (method === 0) return data;
      if (method === 8) {
        try {
          // `zlib` je dio Node-a; nema nove zavisnosti za jednu funkciju.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const zlib = require('zlib') as typeof import('zlib');
          return zlib.inflateRawSync(data);
        } catch {
          return null;
        }
      }
      return null;
    }

    ptr += 46 + nameLength + extraLength + commentLength;
  }

  return null;
}

@Injectable()
export class AppReleaseService {
  private readonly logger = new Logger(AppReleaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
  ) {}

  /**
   * Najnovija **objavljena** verzija — ona koja se nudi korisnicima.
   *
   * Dvije stvari koje ova metoda mora da poštuje, a nijedna nije očigledna:
   *
   * 1. **Skrivena verzija se ne nudi.** „Sakrij" postoji upravo zato da se
   *    loš build povuče — bio bi besmislen kad bi se sakriveni build i dalje
   *    nudio. Zato `isPublished: true` stoji u upitu, a ne u filteru poslije.
   * 2. **Najnovija je najviša verzija, ne najskorije objavljena.** Ove dvije
   *    se razilaze čim se neka starija verzija ponovo prikaže: da se gleda
   *    samo `publishedAt`, ponovno prikazivanje 1.4.0 poslije 1.6.0 vratilo bi
   *    korisnicima 1.4.0 kao „novu". Skup objavljenih je mali (jedan po
   *    izdanju), pa se najviša verzija traži u kodu istim poređenjem koje
   *    koristi i klijent.
   */
  async latestPublished(): Promise<AppReleaseRow | null> {
    const rows = await this.prisma.appRelease.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        version: true,
        buildNumber: true,
        sizeBytes: true,
        notes: true,
        isPublished: true,
        publishedAt: true,
      },
    });

    let latest: AppReleaseRow | null = null;
    for (const row of rows) {
      if (!latest || compareVersions(row.version, latest.version) > 0) {
        latest = row;
      }
    }
    return latest;
  }

  /**
   * Najviša verzija ikad objavljena, uključujući skrivene.
   *
   * Koristi je **samo** provjera pri uploadu. Razlika prema `latestPublished`
   * je namjerna i rješava tihu zamku: ako je 1.6.0 sakrivena, a provjera gleda
   * samo vidljive, admin bi mogao objaviti 1.5.0 kao „novu" — korisnici koji
   * su već dobili 1.6.0 (dok je bila vidljiva) nikad više ne bi dobili
   * obavijest, jer je njihova verzija novija od svega što se nudi.
   *
   * Zabrana je zato vezana za **istoriju**, a nudenje za **vidljivost**.
   */
  private async highestEver(): Promise<AppReleaseRow | null> {
    const rows = await this.prisma.appRelease.findMany({
      select: {
        id: true,
        version: true,
        buildNumber: true,
        sizeBytes: true,
        notes: true,
        isPublished: true,
        publishedAt: true,
      },
    });

    let highest: AppReleaseRow | null = null;
    for (const row of rows) {
      if (!highest || compareVersions(row.version, highest.version) > 0) {
        highest = row;
      }
    }
    return highest;
  }

  async list(): Promise<AppReleaseRow[]> {
    return this.prisma.appRelease.findMany({
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        version: true,
        buildNumber: true,
        sizeBytes: true,
        notes: true,
        isPublished: true,
        publishedAt: true,
      },
    });
  }

  /**
   * Upload + objava u jednom koraku.
   *
   * Redoslijed je namjeran: prvo se čita verzija iz APK-a, pa se **provjeri**
   * da je veća od posljednje, pa se tek onda upisuje fajl. Da je obrnuto,
   * odbijen upload bi ostavljao stotine megabajta u `app-releases/`.
   */
  async upload(input: UploadAppReleaseInput): Promise<AppReleaseDto> {
    if (!input.file) {
      throw new BadRequestException('Nedostaje APK fajl');
    }
    if (input.file.size > APK_MAX_SIZE_BYTES) {
      throw new BadRequestException('APK prelazi dozvoljenu veličinu');
    }

    const fromApk = readVersionFromApk(input.file.buffer);
    const version = (input.version?.trim() || fromApk.version || '').trim();

    if (!SEMVER_PATTERN.test(version)) {
      throw new BadRequestException(
        'Verzija nije pročitana iz APK-a — unesite je ručno u obliku 1.2.3',
      );
    }

    const previous = await this.highestEver();
    if (previous && compareVersions(version, previous.version) <= 0) {
      throw new ConflictException(
        `Verzija ${version} nije veća od posljednje objavljene (${previous.version})`,
      );
    }

    const buildNumber =
      input.buildNumber ??
      fromApk.buildNumber ??
      buildNumberFromVersion(version);

    const stored = await this.storage.storeAppRelease(
      version,
      buildNumber,
      input.file,
    );

    try {
      const row = await this.prisma.appRelease.create({
        data: {
          version,
          buildNumber,
          apkPath: stored.relativePath,
          sizeBytes: input.file.size,
          notes: input.notes?.trim() || null,
          isPublished: input.isPublished ?? true,
        },
        select: {
          id: true,
          version: true,
          buildNumber: true,
          sizeBytes: true,
          notes: true,
          isPublished: true,
          publishedAt: true,
        },
      });

      this.logger.log(
        `Nova verzija ${row.version} (build ${row.buildNumber}) objavljena: ${stored.relativePath}`,
      );

      return { ...row, downloadUrl: downloadUrlFor(row.id) };
    } catch (error) {
      // Fajl bez reda u bazi je smeće koje niko neće očistiti.
      await this.storage.deleteFile(stored.relativePath);
      throw error;
    }
  }

  /** Uključuje/isključuje vidljivost release-a, bez brisanja fajla. */
  async setPublished(id: number, isPublished: boolean): Promise<AppReleaseDto> {
    const exists = await this.prisma.appRelease.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Release ${id} ne postoji`);

    const row = await this.prisma.appRelease.update({
      where: { id },
      data: { isPublished },
      select: {
        id: true,
        version: true,
        buildNumber: true,
        sizeBytes: true,
        notes: true,
        isPublished: true,
        publishedAt: true,
      },
    });

    return { ...row, downloadUrl: downloadUrlFor(row.id) };
  }

  /** Podaci za download: putanja i veličina, ili `null` ako release ne postoji. */
  async fileFor(
    id: number,
  ): Promise<{ path: string; sizeBytes: number } | null> {
    const row = await this.prisma.appRelease.findUnique({
      where: { id },
      select: { apkPath: true, sizeBytes: true },
    });
    return row ? { path: row.apkPath, sizeBytes: row.sizeBytes } : null;
  }
}

/**
 * `versionCode` iz semvera kad ga APK ne nosi.
 *
 * Formula je monotona i čitljiva: `major*10000 + minor*100 + patch`. Nije
 * zamjena za stvarni `versionCode` iz build-a — samo vrijednost koja raste sa
 * verzijom, da Android ne prijavi „isti build".
 */
export function buildNumberFromVersion(version: string): number {
  const [major, minor, patch] = version.split('.').map(Number);
  return major * 10_000 + minor * 100 + patch;
}

export function downloadUrlFor(id: number): string {
  return `/api/app-releases/${id}/apk`;
}
