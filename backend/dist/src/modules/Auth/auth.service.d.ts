import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from '../User/dto/register.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(data: RegisterDto): Promise<{
        user: {
            email: string;
            name: string | null;
            id: number;
        };
        token: string;
    }>;
    login(email: string, password: string): Promise<{
        user: {
            id: number;
            email: string;
            name: string | null;
        };
        token: string;
    }>;
    me(userId: number): Promise<{
        email: string;
        id: number;
        createdAt: Date;
    } | null>;
    private signToken;
}
