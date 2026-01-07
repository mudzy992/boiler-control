"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./modules/Auth/auth.module");
const boiler_module_1 = require("./modules/Boiler/boiler.module");
const weather_module_1 = require("./modules/Weather/weather.module");
const schedule_module_1 = require("./modules/Schedule/schedule.module");
const dashboard_module_1 = require("./modules/Dashboard/dashboard.module");
const home_profile_module_1 = require("./modules/HomeProfile/home.profile.module");
const readonly_module_1 = require("./modules/Readonly/readonly.module");
const thermostat_device_module_1 = require("./modules/ThermostatDevice/thermostat.device.module");
const user_module_1 = require("./modules/User/user.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            boiler_module_1.BoilerModule,
            weather_module_1.WeatherModule,
            schedule_module_1.SchedulerModule,
            dashboard_module_1.DashboardModule,
            home_profile_module_1.HomeProfileModule,
            readonly_module_1.ReadonlyModule,
            thermostat_device_module_1.ThermostatDeviceModule,
            user_module_1.UserModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map