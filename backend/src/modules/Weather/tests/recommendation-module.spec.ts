jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../../common/file-storage.service', () => ({
  FileStorageService: class {},
}));

import { Test } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { RecommendationWeatherService } from '../recommendation-weather.service';

describe('recommendation weather module wiring', () => {
  it('resolves the exported resolver across the full AppModule graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef.get(RecommendationWeatherService)).toBeInstanceOf(
      RecommendationWeatherService,
    );
    await moduleRef.close();
  });
});
