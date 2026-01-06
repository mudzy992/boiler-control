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
var DailyRecommendationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyRecommendationService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../prisma/prisma.service");
const boiler_service_1 = require("../Boiler/boiler.service");
let DailyRecommendationService = DailyRecommendationService_1 = class DailyRecommendationService {
    prisma;
    boilerService;
    logger = new common_1.Logger(DailyRecommendationService_1.name);
    constructor(prisma, boilerService) {
        this.prisma = prisma;
        this.boilerService = boilerService;
    }
    async generateDailyRecommendations() {
        this.logger.log('Starting daily boiler recommendations...');
        const users = await this.prisma.user.findMany();
        for (const user of users) {
            try {
                if (!user.homeLocation)
                    continue;
                const startTemp = await this.boilerService.createMorningBoilerHistory(user.id, user.homeLocation);
                this.logger.log(`User ${user.id} morning BoilerHistory created with suggested: ${startTemp.suggestedTemp}°C`);
            }
            catch (err) {
                this.logger.error(`Failed for user ${user.id}: ${err}`);
            }
        }
        this.logger.log('Daily recommendations finished.');
    }
};
exports.DailyRecommendationService = DailyRecommendationService;
__decorate([
    (0, schedule_1.Cron)('0 6 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DailyRecommendationService.prototype, "generateDailyRecommendations", null);
exports.DailyRecommendationService = DailyRecommendationService = DailyRecommendationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        boiler_service_1.BoilerService])
], DailyRecommendationService);
//# sourceMappingURL=daily.recommendation.service.js.map