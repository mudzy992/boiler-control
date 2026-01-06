"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const tuya_adapter_1 = require("../Boiler/adapter/tuya.adapter");
const tuya_auth_service_1 = require("../Tuya/tuya.auth.service");
const thermostat_polling_service_1 = require("../ThermostatPoll/thermostat.polling.service");
const boiler_module_1 = require("../Boiler/boiler.module");
const daily_recommendation_service_1 = require("./daily.recommendation.service");
let SchedulerModule = class SchedulerModule {
};
exports.SchedulerModule = SchedulerModule;
exports.SchedulerModule = SchedulerModule = __decorate([
    (0, common_1.Module)({
        imports: [schedule_1.ScheduleModule.forRoot(), boiler_module_1.BoilerModule],
        providers: [
            thermostat_polling_service_1.ThermostatPollingService,
            tuya_auth_service_1.TuyaAuthService,
            { provide: 'IThermostatAdapter', useClass: tuya_adapter_1.TuyaAdapter },
            daily_recommendation_service_1.DailyRecommendationService,
        ],
        exports: [thermostat_polling_service_1.ThermostatPollingService],
    })
], SchedulerModule);
//# sourceMappingURL=schedule.module.js.map