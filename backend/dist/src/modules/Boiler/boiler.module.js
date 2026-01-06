"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoilerModule = void 0;
const common_1 = require("@nestjs/common");
const boiler_service_1 = require("./boiler.service");
const boiler_controller_1 = require("./boiler.controller");
const weather_module_1 = require("../Weather/weather.module");
const tuya_adapter_1 = require("./adapter/tuya.adapter");
const prisma_service_1 = require("../../prisma/prisma.service");
const tuya_auth_service_1 = require("../Tuya/tuya.auth.service");
let BoilerModule = class BoilerModule {
};
exports.BoilerModule = BoilerModule;
exports.BoilerModule = BoilerModule = __decorate([
    (0, common_1.Module)({
        imports: [weather_module_1.WeatherModule],
        providers: [
            boiler_service_1.BoilerService,
            prisma_service_1.PrismaService,
            tuya_auth_service_1.TuyaAuthService,
            { provide: 'IThermostatAdapter', useClass: tuya_adapter_1.TuyaAdapter },
        ],
        controllers: [boiler_controller_1.BoilerController],
        exports: [boiler_service_1.BoilerService],
    })
], BoilerModule);
//# sourceMappingURL=boiler.module.js.map