import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
  async latest() {
    const latest = await this.releases.latestPublished();
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

  /** Admin: sve objavljene i skrivene verzije, najnovije prve. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  async list() {
    const rows = await this.releases.list();
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
    },
  ) {
    const buildNumber =
      body.buildNumber != null && body.buildNumber !== ''
        ? Number(body.buildNumber)
        : undefined;

    return this.releases.upload({
      file: apk,
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
  return name.replace(/[^\w.\-]/g, '');
}
