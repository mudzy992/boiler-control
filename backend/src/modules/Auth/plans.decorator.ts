import { SetMetadata } from '@nestjs/common';

export const PLANS_KEY = 'plans';
export const Plans = (...plans: string[]) => SetMetadata(PLANS_KEY, plans);
