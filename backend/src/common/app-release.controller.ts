import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AppReleaseService } from './app-release.service';
import { FileStorageService, APK_MAX_SIZE_BYTES } from './file-storage.service';
import { JwtAuthGuard } from '../modules/Auth/jwt-auth.guard';
import { RolesGuard } from '../modules/Auth/role.guard';
import { Roles } from '../modules/Auth/roles.decorator';
import { Public } from '../modules/Auth/public.decorator';

/**
 * `F15`: admin objavljuje APK, mobilni skida sa **našeg** servera.
 *
 * Download (`GET /apk`) je javan namjerno: aplikacija koja je ispod minimalne
 * verzije ne može ni da se prijavi (version gate blokira i login ekran), pa bi
 * autentifikovani download zaključao korisnika bez izlaza — imao bi poruku
 * „obavezno ažuriraj" i link koji traži token koji ne može dobiti.
 *
 * Admin rute su zaštićene `JwtAuthGuard` + `RolesGuard` (`ADMIN`).
 */
@Controller('api/app-releases')
export class AppReleaseController {
  constructor(
    private readonly releases: AppReleaseService,
    private readonly storage: FileStorageService,
  ) {}

  /**
   * Javna lista za klijenta: samo najnovija objavljena verzija.
   *
   * Vraća `null`-polja kad nema objavljenog release-a — klijent tada ne
   * prikazuje ništa, što je istina (nema nove verzije).
   */
  @Public()
  @Get('latest')
  async latest(@Query('platform') platform?: string) {
    /*
     * `platform` je opcion **samo** za nazadnu kompatibilnost: stariji mobilni
     * klijenti ovu rutu zovu bez parametra i moraju i dalje dobiti mobilno
     * izdanje. Nedostatak parametra NIJE „sve platforme" — to bi TV-u vratilo
     * mobilni APK.
     *
     * Nepoznata vrijednost (`?platform=tv` malim slovima, `?platform=WEB`) se
     * odbija, a ne pretvara u `PHONE`: tiho pretvaranje bi TV-u dalo mobilni
     * APK, a to je greška koju korisnik vidi kao „ne može se instalirati".
     */
    const resolved = platform == null ? 'PHONE' : platform.toUpperCase();
    if (resolved !== 'PHONE' && resolved !== 'TV') {
      throw new BadRequestException(
        `Platforma mora biti PHONE ili TV (dobijeno: ${platform}).`,
      );
    }

    const latest = await this.releases.latestPublished(resolved);
    if (!latest) {
      return { release: null };
    }
    return {
      release: {
        ...latest,
        downloadUrl: `/api/app-releases/${latest.id}/apk`,
      },
    };
  }

  /**
   * Javna lista NAJNOVIJIH izdanja po platformi — za login ekran.
   *
   * **Zašto zasebna ruta, a ne dva poziva `latest`.** Login ekran prikazuje
   * oba linka (mobilni i TV) i to prije prijave; dva paralelna poziva znače dva
   * stanja učitavanja i dvije greške koje treba spojiti u jedan prikaz. Ova
   * ruta vraća **jedan** objekat, pa ekran ima jedno stanje.
   *
   * Platforma bez objavljenog izdanja dobija `null` — ekran tada **ne
   * prikazuje** taj link. Bolje bez linka nego link na 404.
   */
  @Public()
  @Get('available')
  async available() {
    const [phone, tv] = await Promise.all([
      this.releases.latestPublished('PHONE'),
      this.releases.latestPublished('TV'),
    ]);

    const asLink = (
      row: Awaited<ReturnType<typeof this.releases.latestPublished>>,
    ) =>
      row
        ? {
            version: row.version,
            buildNumber: row.buildNumber,
            sizeBytes: row.sizeBytes,
            notes: row.notes,
            publishedAt: row.publishedAt.toISOString(),
            downloadUrl: `/api/app-releases/${row.id}/apk`,
          }
        : null;

    return { phone: asLink(phone), tv: asLink(tv) };
  }

  /** Admin: sve objavljene i skrivene verzije, najnovije prve. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  async list(@Query('platform') platform?: string) {
    const rows = await this.releases.list(
      platform === 'TV' || platform === 'PHONE' ? platform : undefined,
    );
    return rows.map((row) => ({
      ...row,
      downloadUrl: `/api/app-releases/${row.id}/apk`,
    }));
  }

  /** Admin: upload APK-a. Verzija se čita iz `assets/app.config`, uz ručnu ispravku. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  @UseInterceptors(
    FileInterceptor('apk', {
      limits: { fileSize: APK_MAX_SIZE_BYTES },
    }),
  )
  async upload(
    @UploadedFile() apk: any,
    @Body()
    body: {
      version?: string;
      buildNumber?: string;
      notes?: string;
      isPublished?: string;
      platform?: string;
    },
  ) {
    const buildNumber =
      body.buildNumber != null && body.buildNumber !== ''
        ? Number(body.buildNumber)
        : undefined;

    /*
     * Platforma iz forme. Nedostatak se odbija u servisu, a ne pretpostavlja
     * ovdje: `?? 'PHONE'` bi TV APK tiho upisao kao mobilni.
     */
    const platform = body.platform?.toUpperCase() ?? '';

    return this.releases.upload({
      file: apk,
      platform: platform as 'PHONE' | 'TV',
      version: body.version,
      buildNumber: Number.isFinite(buildNumber) ? buildNumber : undefined,
      notes: body.notes,
      // Multipart polja su uvijek tekst: `'false'` mora postati `false`, a ne
      // istinit string — zato se poredi, a ne konvertuje u boolean.
      isPublished:
        body.isPublished == null ? undefined : body.isPublished !== 'false',
    });
  }

  /** Admin: sakrij/prikaži verziju bez brisanja fajla. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/published')
  async setPublished(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isPublished: boolean },
  ) {
    return this.releases.setPublished(id, body.isPublished !== false);
  }

  /**
   * Javni download APK-a.
   *
   * `Content-Disposition: attachment` je obavezan: bez njega Android browser
   * otvara bajtove kao tekst. Ime fajla nosi verziju, pa korisnik u
   * „Preuzimanja" vidi šta je skinuo.
   */
  @Public()
  @Get(':id/apk')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.releases.fileFor(id);
    if (!file) throw new NotFoundException(`Release ${id} ne postoji`);

    res.set({
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(file.sizeBytes),
      'Content-Disposition': `attachment; filename="${fileNameFor(file.path)}"`,
    });

    return new StreamableFile(this.storage.createPrivateReadStream(file.path));
  }
}

function fileNameFor(path: string): string {
  const name = path.split('/').pop() ?? 'boiler-control.apk';
  return name.replace(/[^\w.-]/g, '');
}
