import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const PDF_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const PDF_MIME_TYPES = new Set(['application/pdf']);

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
