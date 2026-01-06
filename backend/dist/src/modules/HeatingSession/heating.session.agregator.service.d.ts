import { PrismaService } from '../../prisma/prisma.service';
import { ThermostatMode } from 'src/generated/prisma/enums';
export declare class HeatingSessionAggregator {
    private prisma;
    private activeSessions;
    constructor(prisma: PrismaService);
    processHeatingEvent(event: {
        deviceId: number;
        homeProfileId: number;
        timestamp: Date;
        currentTemp: number;
        targetTemp: number;
        hvacAction: string;
        mode: ThermostatMode;
        externalTemp: number;
    }): Promise<void>;
    private getIntervalKey;
    private saveSession;
}
