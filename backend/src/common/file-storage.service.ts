import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const PDF_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * APK je jedini dozvoljeni „binarni" tip (`F15`). Granica je 200 MB jer je to
 * realna veličina release APK-a sa RN bundle-om; manja bi odbijala ispravne
 * buildove, a veća ne služi ničemu (upload ide kroz memoriju procesa).
 */
export const APK_MAX_SIZE_BYTES = 200 * 1024 * 1024;

export const APK_MIME_TYPES = new Set([
  'application/vnd.android.package-archive',
  'application/octet-stream',
]);

export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const PDF_MIME_TYPES = new Set(['application/pdf']);

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const APK_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

type UploadedFileInput = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

type StoreFileInput = {
  file: UploadedFileInput;
  relativeDir: string;
  allowedMimeTypes: Set<string>;
  maxSizeBytes: number;
};

export type StoredFileInfo = {
  relativePath: string;
  mimeType: string;
  originalName: string;
};

@Injectable()
export class FileStorageService {
  private readonly rootPath =
    process.env.UPLOAD_ROOT_PATH || '/usr/src/app/uploads';

  constructor() {
    void this.ensureDir('');
    void this.ensureDir('gas-readings');
    void this.ensureDir('users');
    void this.ensureDir('app-releases');
  }

  async storeGasReadingImage(
    readingId: number,
    file: UploadedFileInput,
  ): Promise<StoredFileInfo> {
    return this.storeFile({
      file,
      relativeDir: `gas-readings/${readingId}`,
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxSizeBytes: IMAGE_MAX_SIZE_BYTES,
    });
  }

  async storeGasInvoicePdf(
    readingId: number,
    file: UploadedFileInput,
  ): Promise<StoredFileInfo> {
    return this.storeFile({
      file,
      relativeDir: `gas-readings/${readingId}/invoice`,
      allowedMimeTypes: PDF_MIME_TYPES,
      maxSizeBytes: PDF_MAX_SIZE_BYTES,
    });
  }

  async storeUserImage(
    userId: number,
    file: UploadedFileInput,
  ): Promise<StoredFileInfo> {
    return this.storeFile({
      file,
      relativeDir: `users/${userId}`,
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxSizeBytes: IMAGE_MAX_SIZE_BYTES,
    });
  }

  /**
   * `F15`: APK release-a. Datoteka se **ne** prevodi u novi random naziv —
   * ime nosi verziju i build, pa je u folderu odmah vidljivo šta je gdje.
   * Provjera sadržaja je ZIP potpis (`PK\u0003\u0004`): APK je ZIP, i to je
   * jedina provjera koja stvarno razlikuje APK od proizvoljnog binarnog fajla.
   */
  async storeAppRelease(
    version: string,
    buildNumber: number,
    file: UploadedFileInput,
  ): Promise<StoredFileInfo> {
    if (!APK_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Release mora biti .apk datoteka');
    }
    if (file.size > APK_MAX_SIZE_BYTES) {
      throw new BadRequestException('APK prelazi dozvoljenu veličinu');
    }
    if (!this.hasSignature(file.buffer, APK_SIGNATURE)) {
      throw new BadRequestException('Datoteka nije APK (nema ZIP potpis)');
    }

    const safeVersion = version.replace(/[^\d.]/g, '');
    if (!safeVersion) {
      throw new BadRequestException('Neispravna verzija u nazivu datoteke');
    }

    const relativeDir = 'app-releases';
    await this.ensureDir(relativeDir);
    const fileName = `boiler-control-${safeVersion}-${buildNumber}.apk`;
    const relativePath = path.posix.join(relativeDir, fileName);

    await fs.writeFile(this.resolveAbsolutePath(relativePath), file.buffer);

    return {
      relativePath,
      mimeType: 'application/vnd.android.package-archive',
      originalName: this.sanitizeOriginalName(file.originalname),
    };
  }

  createPrivateReadStream(relativePath: string) {
    const absolutePath = this.resolveAbsolutePath(relativePath);
    return createReadStream(absolutePath);
  }

  async deleteFile(relativePath: string | null | undefined): Promise<void> {
    if (!relativePath) return;
    const absolutePath = this.resolveAbsolutePath(relativePath);
    try {
      await fs.unlink(absolutePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async storeFile(input: StoreFileInput): Promise<StoredFileInfo> {
    const { file, relativeDir, allowedMimeTypes, maxSizeBytes } = input;

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File size exceeds upload limit');
    }

    this.validateContent(file);

    const safeDir = this.sanitizeRelativeDir(relativeDir);
    await this.ensureDir(safeDir);

    const extension = this.mimeToExtension(file.mimetype, file.originalname);
    const randomName = `${randomBytes(16).toString('hex')}${extension}`;
    const relativePath = path.posix.join(safeDir, randomName);
    const absolutePath = this.resolveAbsolutePath(relativePath);

    await fs.writeFile(absolutePath, file.buffer);

    return {
      relativePath,
      mimeType: file.mimetype,
      originalName: this.sanitizeOriginalName(file.originalname),
    };
  }

  /**
   * SEC-5: potpis sadržaja je minimalna kontrola, ne parser ili malware scan.
   * Validacija je prije ensureDir/write pa odbijeni upload ne ostavlja fajl.
   */
  private validateContent(file: UploadedFileInput): void {
    const { buffer, mimetype } = file;
    let valid = false;

    if (mimetype === 'application/pdf') {
      valid = this.hasSignature(buffer, PDF_SIGNATURE);
    } else if (mimetype === 'image/jpeg') {
      valid = this.hasSignature(buffer, JPEG_SIGNATURE);
    } else if (mimetype === 'image/png') {
      valid = this.hasSignature(buffer, PNG_SIGNATURE);
    } else if (mimetype === 'image/webp') {
      valid =
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }

    if (!valid) {
      throw new BadRequestException(
        'File content does not match declared file type',
      );
    }
  }

  private hasSignature(buffer: Buffer, signature: Buffer): boolean {
    return (
      buffer.length >= signature.length &&
      buffer.subarray(0, signature.length).equals(signature)
    );
  }

  private sanitizeRelativeDir(dir: string): string {
    const normalized = dir.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw new BadRequestException('Invalid upload directory');
    }
    return normalized;
  }

  private sanitizeOriginalName(name: string): string {
    const base = path.basename(name || 'file');
    const trimmed = base.replace(/[^\w.\- ]/g, '').trim();
    return trimmed || 'file';
  }

  private mimeToExtension(mimeType: string, originalName: string): string {
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    if (mimeType === 'application/pdf') return '.pdf';

    const parsed = path.extname(originalName || '').toLowerCase();
    return parsed || '.bin';
  }

  private async ensureDir(relativeDir: string): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(relativeDir);
    await fs.mkdir(absolutePath, { recursive: true });
  }

  private resolveAbsolutePath(relativePath: string): string {
    const safeRelative = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (safeRelative.includes('..')) {
      throw new BadRequestException('Invalid file path');
    }

    const absolute = path.join(this.rootPath, safeRelative);
    const rootNormalized = path.resolve(this.rootPath);
    const absoluteNormalized = path.resolve(absolute);
    if (!absoluteNormalized.startsWith(rootNormalized)) {
      throw new BadRequestException('Invalid file path');
    }
    return absoluteNormalized;
  }
}
