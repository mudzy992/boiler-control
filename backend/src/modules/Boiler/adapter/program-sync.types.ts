import { DayType } from 'src/generated/prisma';

export interface TuyaProgramInterval {
  dayType: DayType; // WORKDAY | SATURDAY | SUNDAY
  startMinute: number; // 0–1439
  targetTemp: number;
  orderIndex: number; // 0..n
}

export type TuyaProgramByDay = Record<DayType, TuyaProgramInterval[]>;
