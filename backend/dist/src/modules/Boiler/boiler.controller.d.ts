import { BoilerService } from './boiler.service';
export declare class BoilerController {
    private boilerService;
    constructor(boilerService: BoilerService);
    getStartTemp(city: string, userId: string): Promise<{
        city: string;
        suggestedTemp: number;
    }>;
}
