import { SetMetadata } from '@nestjs/common';

// Key koji ćemo provjeravati u guardu
export const IS_PUBLIC_KEY = 'isPublic';

// Decorator
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
