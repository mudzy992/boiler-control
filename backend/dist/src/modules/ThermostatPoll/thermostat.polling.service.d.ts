import { ThermostatDevice } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';
export declare class ThermostatPollingService {
    private prisma;
    private adapter;
    private readonly logger;
    constructor(prisma: PrismaService, adapter: IThermostatAdapter);
    pollDevice(device: ThermostatDevice): Promise<void>;
    pollAll(): Promise<void>;
    handleCron(): void;
}
