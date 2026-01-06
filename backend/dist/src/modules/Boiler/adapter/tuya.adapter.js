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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TuyaAdapter = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const tuya_auth_service_1 = require("../../../modules/Tuya/tuya.auth.service");
let TuyaAdapter = class TuyaAdapter {
    tokenService;
    baseUrl = process.env.TUYA_BASE_URL;
    constructor(tokenService) {
        this.tokenService = tokenService;
    }
    async generateHeaders(path, method, body) {
        const token = await this.tokenService.getAccessToken();
        const timestamp = Date.now().toString();
        const nonce = '';
        const bodyStr = body ? JSON.stringify(body) : '';
        const sha256Body = crypto_1.default
            .createHash('sha256')
            .update(bodyStr)
            .digest('hex');
        const signStr = `${method}\n${sha256Body}\n\n${path}`;
        const sign = crypto_1.default
            .createHmac('sha256', process.env.TUYA_CLIENT_SECRET)
            .update(process.env.TUYA_CLIENT_ID + token + timestamp + nonce + signStr)
            .digest('hex')
            .toUpperCase();
        return {
            client_id: process.env.TUYA_CLIENT_ID,
            access_token: token,
            t: timestamp,
            sign_method: 'HMAC-SHA256',
            sign,
            nonce,
        };
    }
    async getDeviceStatus(deviceId) {
        const path = `/v1.0/devices/${deviceId}`;
        const headers = await this.generateHeaders(path, 'GET');
        const res = await axios_1.default.get(`${this.baseUrl}${path}`, { headers });
        if (!res.data.success) {
            throw new Error(`Tuya device fetch failed: ${JSON.stringify(res.data)}`);
        }
        const statusArray = res.data.result.status ?? [];
        return statusArray.reduce((acc, s) => {
            acc[s.code] = s.value;
            return acc;
        }, {});
    }
    async getCurrentTemperature(deviceId) {
        const status = await this.getDeviceStatus(deviceId);
        return status['TempCurrent'] ?? NaN;
    }
    async getTargetTemperature(deviceId) {
        const status = await this.getDeviceStatus(deviceId);
        return status['TempSet'] ?? NaN;
    }
    async isHeatingOn(deviceId) {
        const status = await this.getDeviceStatus(deviceId);
        const tempCurrent = status['TempCurrent'];
        const tempSet = status['TempSet'];
        if (typeof tempCurrent !== 'number' || typeof tempSet !== 'number') {
            return false;
        }
        const deadzone = 1;
        return tempSet - tempCurrent >= deadzone;
    }
    async fetchSnapshot(deviceId) {
        const status = await this.getDeviceStatus(deviceId);
        const currentTemp = status['TempCurrent'] ?? 0;
        const targetTemp = status['TempSet'] ?? 0;
        const powerOn = status['Power'] === true;
        const deadzone = 1;
        const heatingOn = powerOn && targetTemp - currentTemp >= deadzone;
        return {
            currentTemp,
            targetTemp,
            heatingOn,
            timestamp: new Date(),
        };
    }
};
exports.TuyaAdapter = TuyaAdapter;
exports.TuyaAdapter = TuyaAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tuya_auth_service_1.TuyaAuthService])
], TuyaAdapter);
//# sourceMappingURL=tuya.adapter.js.map