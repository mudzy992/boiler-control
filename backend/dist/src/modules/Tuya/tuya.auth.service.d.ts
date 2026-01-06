import { PrismaService } from 'src/prisma/prisma.service';
export declare class TuyaAuthService {
    private prisma;
    private readonly baseUrl;
    private readonly clientId;
    private readonly clientSecret;
    constructor(prisma: PrismaService);
    getAccessToken(): Promise<string>;
    private sign;
}
