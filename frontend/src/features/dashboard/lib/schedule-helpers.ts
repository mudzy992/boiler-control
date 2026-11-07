import dayjs from 'dayjs';
import type { ThermostatProgram } from '../types';

export const getTodayDayType = (): string => {
  const day = dayjs().day();
  if (day === 0) return 'SUNDAY';
  if (day === 6) return 'SATURDAY';
  return 'WORKDAY';
};

export const groupProgramsByDay = (
  programs: ThermostatProgram[],
): Array<{ dayType: string; programs: ThermostatProgram[] }> => {
  const map = new Map<string, ThermostatProgram[]>();
  programs.forEach((p) => {
    if (!map.has(p.dayType)) map.set(p.dayType, []);
    map.get(p.dayType)!.push(p);
  });
  return Array.from(map.entries()).map(([dayType, list]) => ({
    dayType,
    programs: list.sort((a, b) => a.orderIndex - b.orderIndex),
  }));
};

export const findActiveProgram = (
  programs: ThermostatProgram[],
): ThermostatProgram | null => {
  if (!programs.length) return null;
  const today = getTodayDayType();
  const todays = programs
    .filter((p) => p.dayType === today)
    .sort((a, b) => a.startMinute - b.startMinute);
  const nowMin = dayjs().hour() * 60 + dayjs().minute();
  let current: ThermostatProgram | null = null;
  for (const p of todays) {
    if (p.startMinute <= nowMin) current = p;
  }
  return current;
};

export const buildWeatherDisplay = (
  src: Record<string, unknown> | null | undefined,
): {
  outsideTemp: number | null;
  feelsLike: number | null;
  condition: string | null;
  humidity: number | null;
  windSpeed: number | null;
  tempMin: number | null;
  tempMax: number | null;
} | null => {
  if (!src) return null;
  return {
    outsideTemp: (src.temperature as number | undefined) ?? (src.temp as number | undefined) ?? null,
    feelsLike: (src.feelslike as number | undefined) ?? (src.feelsLike as number | undefined) ?? null,
    condition:
      (src.condition_text as string | undefined) ??
      (src.condition as string | undefined) ??
      null,
    humidity: (src.humidity as number | undefined) ?? null,
    windSpeed:
      (src.wind_kph as number | undefined) ??
      (src.windSpeed as number | undefined) ??
      null,
    tempMin: (src.temp_min as number | undefined) ?? (src.tempMin as number | undefined) ?? null,
    tempMax: (src.temp_max as number | undefined) ?? (src.tempMax as number | undefined) ?? null,
  };
};
