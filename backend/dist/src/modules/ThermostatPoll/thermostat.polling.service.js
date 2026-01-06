"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ThermostatPollingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThermostatPollingService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../prisma/prisma.service");
let ThermostatPollingService = ThermostatPollingService_1 = class ThermostatPollingService {
    prisma;
    adapter;
    logger = new common_1.Logger(ThermostatPollingService_1.name);
    constructor(prisma, adapter) {
        this.prisma = prisma;
        this.adapter = adapter;
    }
    async pollDevice(device) {
        try {
            const snapshot = await this.adapter.fetchSnapshot(device.deviceId);
            this.logger.debug(`Snapshot for device ${device.deviceId}: currentTemp=${snapshot.currentTemp}, targetTemp=${snapshot.targetTemp}`);
            const lastEvent = await this.prisma.heatingEvent.findFirst({
                where: { deviceId: device.id },
                orderBy: { timestampStart: 'desc' },
            });
            const heatingOn = snapshot.currentTemp + 1 < snapshot.targetTemp;
            this.logger.debug(`Heating status for device ${device.deviceId}: ${heatingOn ? 'ON' : 'OFF'}`);
            if (lastEvent && lastEvent.timestampEnd == null) {
                if (!heatingOn) {
                    await this.prisma.heatingEvent.update({
                        where: { id: lastEvent.id },
                        data: { timestampEnd: new Date() },
                    });
                    this.logger.log(`Closed heating event ${lastEvent.id} for device ${device.deviceId}`);
                }
            }
            else {
                if (heatingOn) {
                    const newEvent = await this.prisma.heatingEvent.create({
                        data: {
                            deviceId: device.id,
                            timestampStart: new Date(),
                            currentTemp: snapshot.currentTemp,
                            targetTemp: snapshot.targetTemp,
                            hvacAction: heatingOn ? 'HEATING_ON' : 'IDLE',
                            source: 'THERMOSTAT',
                        },
                    });
                    const morningBh = await this.prisma.boilerHistory.findFirst({
                        where: {
                            userId: device.userId,
                            createdAt: { gte: new Date(new Date().setHours(6, 0, 0, 0)) },
                        },
                        orderBy: { createdAt: 'asc' },
                    });
                    if (morningBh) {
                        await this.prisma.boilerHistory.create({
                            data: {
                                userId: device.userId,
                                externalTemp: morningBh.externalTemp,
                                suggestedTemp: morningBh.suggestedTemp,
                                actualTemp: morningBh.actualTemp,
                                heatingStart: newEvent.timestampStart,
                                heatingEnd: newEvent.timestampEnd,
                            },
                        });
                    }
                    this.logger.log(`Created new heating event ${newEvent.id} for device ${device.deviceId}`);
                }
                else {
                    this.logger.debug(`No event created for device ${device.deviceId} (heating OFF)`);
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to poll device ${device.deviceId}: ${error.message}`, error.stack);
        }
    }
    async pollAll() {
        const devices = await this.prisma.thermostatDevice.findMany();
        this.logger.debug(`Polling ${devices.length} thermostat devices...`);
        for (const d of devices) {
            await this.pollDevice(d);
        }
    }
    handleCron() {
        this.logger.debug('Running thermostat polling cron...');
        this.pollAll();
    }
};
exports.ThermostatPollingService = ThermostatPollingService;
__decorate([
    (0, schedule_1.Cron)('*/1 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ThermostatPollingService.prototype, "handleCron", null);
exports.ThermostatPollingService = ThermostatPollingService = ThermostatPollingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('IThermostatAdapter')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], ThermostatPollingService);
//# sourceMappingURL=thermostat.polling.service.js.map