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
exports.TuyaAuthService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_service_1 = require("../../prisma/prisma.service");
let TuyaAuthService = class TuyaAuthService {
    prisma;
    baseUrl = process.env.TUYA_BASE_URL;
    clientId = process.env.TUYA_CLIENT_ID;
    clientSecret = process.env.TUYA_CLIENT_SECRET;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAccessToken() {
        const existing = await this.prisma.tuyaToken.findFirst();
        if (existing && existing.expiresAt > new Date()) {
            return existing.accessToken;
        }
        const now = Date.now();
        const path = '/v1.0/token?grant_type=1';
        const timestamp = now.toString();
        const sign = this.sign('GET', path, timestamp);
        const res = await axios_1.default.get(`${this.baseUrl}${path}`, {
            headers: {
                client_id: this.clientId,
                sign,
                t: timestamp,
                sign_method: 'HMAC-SHA256',
            },
        });
        if (!res.data?.result?.access_token) {
            throw new Error('Tuya token fetch failed');
        }
        const expiresAt = new Date(now + res.data.result.expire_time * 1000 - 60_000);
        await this.prisma.tuyaToken.upsert({
            where: { id: existing?.id ?? 1 },
            update: {
                accessToken: res.data.result.access_token,
                expiresAt,
            },
            create: {
                accessToken: res.data.result.access_token,
                expiresAt,
            },
        });
        return res.data.result.access_token;
    }
    sign(method, path, t) {
        const contentHash = crypto_1.default.createHash('sha256').update('').digest('hex');
        const stringToSign = this.clientId + t + method + '\n' + contentHash + '\n\n' + path;
        return crypto_1.default
            .createHmac('sha256', this.clientSecret)
            .update(stringToSign)
            .digest('hex')
            .toUpperCase();
    }
};
exports.TuyaAuthService = TuyaAuthService;
exports.TuyaAuthService = TuyaAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TuyaAuthService);
//# sourceMappingURL=tuya.auth.service.js.map