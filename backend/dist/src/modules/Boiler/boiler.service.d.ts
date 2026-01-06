import { PrismaService } from '../../prisma/prisma.service';
import { WeatherService } from '../Weather/weather.service';
export declare class BoilerService {
    private prisma;
    private weatherService;
    private readonly logger;
    constructor(prisma: PrismaService, weatherService: WeatherService);
    calculateStartTemp(userId: number, city: string): Promise<number>;
    createMorningBoilerHistory(userId: number, city: string): Promise<{
        id: number;
        createdAt: Date;
        userId: number;
        externalTemp: number;
        suggestedTemp: number;
        actualTemp: number | null;
        heatingStart: Date | null;
        heatingEnd: Date | null;
    }>;
    private calculateCurveTemp;
}
