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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeatingSessionAggregator = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let HeatingSessionAggregator = class HeatingSessionAggregator {
    prisma;
    activeSessions = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    async processHeatingEvent(event) {
        const { deviceId } = event;
        let session = this.activeSessions.get(deviceId);
        if (!session && event.hvacAction === 'HEATING_ON') {
            session = {
                homeProfileId: event.homeProfileId,
                deviceId,
                intervalKey: this.getIntervalKey(event.timestamp, event.mode),
                mode: event.mode,
                startTime: event.timestamp,
                initialTemp: event.currentTemp,
                targetTemp: event.targetTemp,
                reached: false,
                externalTempAvg: event.externalTemp,
                flowTempAvg: event.targetTemp,
            };
            this.activeSessions.set(deviceId, session);
            return;
        }
        if (!session)
            return;
        session.flowTempAvg = (session.flowTempAvg + event.targetTemp) / 2;
        session.externalTempAvg =
            (session.externalTempAvg + event.externalTemp) / 2;
        const targetReached = event.currentTemp >= event.targetTemp;
        if (event.hvacAction === 'HEATING_OFF' || targetReached) {
            session.endTime = event.timestamp;
            session.reached = targetReached;
            session.timeToTargetMin = targetReached
                ? (event.timestamp.getTime() - session.startTime.getTime()) / 60000
                : undefined;
            session.overshoot = targetReached
                ? event.currentTemp - session.targetTemp
                : undefined;
            await this.saveSession(session);
            this.activeSessions.delete(deviceId);
        }
    }
    getIntervalKey(timestamp, mode) {
        const day = timestamp.getDay();
        const hour = timestamp.getHours();
        let part = 'day';
        if (hour < 12)
            part = 'morning';
        else if (hour < 18)
            part = 'afternoon';
        else
            part = 'evening';
        return `${mode}_${day}_${part}`;
    }
    async saveSession(session) {
        const existing = await this.prisma.heatingIntervalLearning.findUnique({
            where: {
                homeProfileId_intervalKey: {
                    homeProfileId: session.homeProfileId,
                    intervalKey: session.intervalKey,
                },
            },
        });
        if (existing) {
            const totalSamples = existing.samples + 1;
            const newOffset = (existing.offset * existing.samples +
                (session.targetTemp - session.initialTemp)) /
                totalSamples;
            const newConfidence = Math.min(1, (existing.confidence * existing.samples + 1) / totalSamples);
            await this.prisma.heatingIntervalLearning.update({
                where: { id: existing.id },
                data: {
                    offset: newOffset,
                    confidence: newConfidence,
                    samples: totalSamples,
                    avgReachTimeMin: session.timeToTargetMin || existing.avgReachTimeMin,
                    avgOvershoot: session.overshoot || existing.avgOvershoot,
                    lastUpdated: new Date(),
                },
            });
        }
        else {
            await this.prisma.heatingIntervalLearning.create({
                data: {
                    homeProfileId: session.homeProfileId,
                    intervalKey: session.intervalKey,
                    offset: session.targetTemp - session.initialTemp,
                    confidence: 1,
                    samples: 1,
                    avgReachTimeMin: session.timeToTargetMin,
                    avgOvershoot: session.overshoot,
                    lastUpdated: new Date(),
                },
            });
        }
    }
};
exports.HeatingSessionAggregator = HeatingSessionAggregator;
exports.HeatingSessionAggregator = HeatingSessionAggregator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HeatingSessionAggregator);
//# sourceMappingURL=heating.session.agregator.service.js.map