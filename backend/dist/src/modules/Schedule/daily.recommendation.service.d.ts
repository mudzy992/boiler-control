import { PrismaService } from '../../prisma/prisma.service';
import { BoilerService } from '../Boiler/boiler.service';
export declare class DailyRecommendationService {
    private prisma;
    private boilerService;
    private readonly logger;
    constructor(prisma: PrismaService, boilerService: BoilerService);
    generateDailyRecommendations(): Promise<void>;
}
