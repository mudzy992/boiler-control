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
var BoilerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoilerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const weather_service_1 = require("../Weather/weather.service");
let BoilerService = BoilerService_1 = class BoilerService {
    prisma;
    weatherService;
    logger = new common_1.Logger(BoilerService_1.name);
    constructor(prisma, weatherService) {
        this.prisma = prisma;
        this.weatherService = weatherService;
    }
    async calculateStartTemp(userId, city) {
        const home = await this.prisma.homeProfile.findFirst({ where: { userId } });
        if (!home)
            throw new Error('HomeProfile not found');
        const { temp_min, temp_max } = await this.weatherService.getTodayWeather(city);
        const weightedTemp = 0.7 * (temp_min ?? 0) + 0.3 * (temp_max ?? 0);
        this.logger.log(`Weighted external temperature for user ${userId}: ${weightedTemp}`);
        const events = await this.prisma.heatingEvent.findMany({
            where: {
                thermostat: { userId },
                timestampStart: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
        });
        let learningOffset = 0;
        events.forEach((e) => {
            const delta = e.targetTemp - e.currentTemp;
            const weight = e.timestampEnd ? 0.05 : 0.1;
            learningOffset += delta * weight;
        });
        this.logger.debug(`Calculated learningOffset: ${learningOffset}`);
        let startTemp = this.calculateCurveTemp(weightedTemp);
        startTemp += learningOffset;
        startTemp = Math.max(35, Math.min(56, startTemp));
        const roundedStartTemp = Number(startTemp.toFixed(2));
        this.logger.log(`Calculated startTemp for user ${userId}: ${roundedStartTemp}`);
        await this.prisma.boilerHistory.create({
            data: {
                userId,
                externalTemp: weightedTemp,
                suggestedTemp: roundedStartTemp,
            },
        });
        const heatDurations = events
            .filter((e) => e.timestampEnd)
            .map((e) => (e.timestampEnd.getTime() - e.timestampStart.getTime()) / 60000);
        const expectedHeatTimeMin = heatDurations.length
            ? heatDurations.reduce((a, b) => a + b, 0) / heatDurations.length
            : 30;
        const confidenceScore = Math.min(1, Math.max(0.1, heatDurations.length / 10));
        await this.prisma.recommendation.create({
            data: {
                userId,
                date: new Date(),
                recommendedFlowTemp: roundedStartTemp,
                expectedHeatTimeMin,
                confidenceScore,
            },
        });
        await this.prisma.homeProfile.update({
            where: { id: home.id },
            data: {
                learningOffset: learningOffset,
                learningConfidence: confidenceScore,
            },
        });
        return roundedStartTemp;
    }
    async createMorningBoilerHistory(userId, city) {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(6, 0, 0, 0);
        const lastBh = await this.prisma.boilerHistory.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        const lastActualTemp = lastBh?.suggestedTemp ?? 50;
        const suggestedTemp = await this.calculateStartTemp(userId, city);
        const { temp_min, temp_max } = await this.weatherService.getTodayWeather(city);
        const externalTemp = 0.7 * (temp_min ?? 0) + 0.3 * (temp_max ?? 0);
        const bh = await this.prisma.boilerHistory.create({
            data: {
                userId,
                externalTemp,
                suggestedTemp,
                actualTemp: lastActualTemp,
            },
        });
        this.logger.log(`Morning BoilerHistory for user ${userId}: suggested=${suggestedTemp}, actual=${lastActualTemp}, external=${externalTemp}`);
        return bh;
    }
    calculateCurveTemp(ext) {
        if (ext >= 10)
            return 45;
        if (ext <= -15)
            return 56;
        return 51 - ext * 0.3;
    }
};
exports.BoilerService = BoilerService;
exports.BoilerService = BoilerService = BoilerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        weather_service_1.WeatherService])
], BoilerService);
//# sourceMappingURL=boiler.service.js.map