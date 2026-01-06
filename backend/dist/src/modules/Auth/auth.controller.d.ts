import { AuthService } from './auth.service';
import { Request } from 'express';
import { RegisterDto } from '../User/dto/register.dto';
interface JwtRequest extends Request {
    user: {
        userId: number;
    };
}
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(body: RegisterDto): Promise<{
        user: {
            email: string;
            name: string | null;
            id: number;
        };
        token: string;
    }>;
    login(body: {
        email: string;
        password: string;
    }): Promise<{
        user: {
            id: number;
            email: string;
            name: string | null;
        };
        token: string;
    }>;
    me(req: JwtRequest): Promise<{
        email: string;
        id: number;
        createdAt: Date;
    } | null>;
}
export {};
