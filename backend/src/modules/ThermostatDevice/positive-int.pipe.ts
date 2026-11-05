import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  ParseIntPipe,
} from '@nestjs/common';

@Injectable()
export class PositiveIntPipe extends ParseIntPipe {
  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    const parsed = await super.transform(value, metadata);

    if (parsed < 1) {
      throw new BadRequestException(
        'Validation failed (positive integer is expected)',
      );
    }

    return parsed;
  }
}
