export type HeatingProgressMode = 'idle' | 'no-estimate' | 'running' | 'overtime';

export interface HeatingProgressInput {
  now: Date | number;
  startedAt: string | null | undefined;
  expectedHeatTimeMin: number | null | undefined;
  isHeatingActive: boolean;
}

export interface HeatingProgressResult {
  mode: HeatingProgressMode;
  elapsedMin: number;
  expectedMin: number;
  ratio: number;
  overtimeMin: number;
}

const toMs = (value: Date | number): number =>
  typeof value === 'number' ? value : value.getTime();

export const computeHeatingProgress = (
  input: HeatingProgressInput,
): HeatingProgressResult => {
  if (!input.isHeatingActive || !input.startedAt) {
    return {
      mode: 'idle',
      elapsedMin: 0,
      expectedMin: 0,
      ratio: 0,
      overtimeMin: 0,
    };
  }
  const startMs = Date.parse(input.startedAt);
  if (Number.isNaN(startMs)) {
    return {
      mode: 'idle',
      elapsedMin: 0,
      expectedMin: 0,
      ratio: 0,
      overtimeMin: 0,
    };
  }
  const elapsedMin = Math.max(0, (toMs(input.now) - startMs) / 60_000);
  const expectedMin =
    typeof input.expectedHeatTimeMin === 'number' &&
    Number.isFinite(input.expectedHeatTimeMin) &&
    input.expectedHeatTimeMin > 0
      ? input.expectedHeatTimeMin
      : 0;
  if (expectedMin <= 0) {
    return {
      mode: 'no-estimate',
      elapsedMin,
      expectedMin: 0,
      ratio: 0,
      overtimeMin: 0,
    };
  }
  if (elapsedMin > expectedMin) {
    return {
      mode: 'overtime',
      elapsedMin,
      expectedMin,
      ratio: 1,
      overtimeMin: elapsedMin - expectedMin,
    };
  }
  return {
    mode: 'running',
    elapsedMin,
    expectedMin,
    ratio: Math.min(1, elapsedMin / expectedMin),
    overtimeMin: 0,
  };
};

export const resolveOpenHeatingStartedAt = (
  events: Array<{ startedAt?: string; endedAt?: string | null }>,
): string | null => {
  const open = events.find((event) => event.endedAt == null && event.startedAt);
  return open?.startedAt ?? null;
};

export const resolveExpectedHeatTimeMin = (recommendation: {
  expectedHeatTimeMin?: number | null;
  breakdown?: { expectedHeatTimeMin?: number | null } | null;
} | null | undefined): number | null => {
  if (!recommendation) {
    return null;
  }
  if (
    typeof recommendation.expectedHeatTimeMin === 'number' &&
    recommendation.expectedHeatTimeMin > 0
  ) {
    return recommendation.expectedHeatTimeMin;
  }
  const fromBreakdown = recommendation.breakdown?.expectedHeatTimeMin;
  if (typeof fromBreakdown === 'number' && fromBreakdown > 0) {
    return fromBreakdown;
  }
  return null;
};
