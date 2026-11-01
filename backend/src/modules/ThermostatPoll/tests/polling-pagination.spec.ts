import { Logger } from '@nestjs/common';
import {
  DEFAULT_POLL_BATCH_SIZE,
  HARD_POLL_BATCH_SIZE,
  POLL_BATCH_SIZE_FLAG,
  POLL_PAGINATION_FLAG,
  pollBatchSize,
  pollPaginationEnabled,
} from '../polling-pagination';

describe('polling-pagination config (PERF-2)', () => {
  const originalFlag = process.env[POLL_PAGINATION_FLAG];
  const originalBatch = process.env[POLL_BATCH_SIZE_FLAG];

  beforeEach(() => {
    delete process.env[POLL_PAGINATION_FLAG];
    delete process.env[POLL_BATCH_SIZE_FLAG];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[POLL_PAGINATION_FLAG];
    else process.env[POLL_PAGINATION_FLAG] = originalFlag;
    if (originalBatch === undefined) delete process.env[POLL_BATCH_SIZE_FLAG];
    else process.env[POLL_BATCH_SIZE_FLAG] = originalBatch;
    jest.restoreAllMocks();
  });

  it('pagination je zadano ukljucena i prihvata strogo on/off', () => {
    expect(pollPaginationEnabled()).toBe(true);
    for (const raw of ['on', 'ON', ' On ']) {
      process.env[POLL_PAGINATION_FLAG] = raw;
      expect(pollPaginationEnabled()).toBe(true);
    }
    for (const raw of ['off', 'OFF', ' Off ']) {
      process.env[POLL_PAGINATION_FLAG] = raw;
      expect(pollPaginationEnabled()).toBe(false);
    }
  });

  it('neispravna zastavica pada na default on, ne na off', () => {
    for (const raw of ['', 'true', '1', 'yes', 'maybe']) {
      process.env[POLL_PAGINATION_FLAG] = raw;
      expect(pollPaginationEnabled()).toBe(true);
    }
  });

  it('batch size ima default, hard cap i odbija neispravne vrijednosti', () => {
    expect(DEFAULT_POLL_BATCH_SIZE).toBe(100);
    expect(HARD_POLL_BATCH_SIZE).toBe(500);
    expect(pollBatchSize()).toBe(DEFAULT_POLL_BATCH_SIZE);
    process.env[POLL_BATCH_SIZE_FLAG] = '25';
    expect(pollBatchSize()).toBe(25);
    process.env[POLL_BATCH_SIZE_FLAG] = String(HARD_POLL_BATCH_SIZE);
    expect(pollBatchSize()).toBe(HARD_POLL_BATCH_SIZE);
    for (const raw of [
      '0',
      '-1',
      '1.5',
      'abc',
      '',
      String(HARD_POLL_BATCH_SIZE + 1),
    ]) {
      process.env[POLL_BATCH_SIZE_FLAG] = raw;
      expect(pollBatchSize()).toBe(DEFAULT_POLL_BATCH_SIZE);
    }
  });
});
