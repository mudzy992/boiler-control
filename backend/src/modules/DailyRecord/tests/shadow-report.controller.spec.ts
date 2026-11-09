import { BadRequestException } from '@nestjs/common';
import { ShadowReportController, validatedWindow } from '../shadow.report.controller';

/**
 * Ulaz u izvještaj (`24` §6.5). Provjerava se **ulaz**: pogrešan datum ili
 * pogrešan dom moraju pasti prije nego se bilo šta pročita.
 */

function setup(options: {
  activeHomeProfileId?: number | null;
  report?: unknown;
} = {}) {
  const forHome = jest.fn().mockResolvedValue(options.report ?? { days: 0 });
  const reports = { forHome };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        activeHomeProfileId:
          options.activeHomeProfileId === undefined
            ? 7
            : options.activeHomeProfileId,
      }),
    },
  };

  const controller = new ShadowReportController(reports as never, prisma as never);
  const req = { user: { userId: 3 } };
  return { controller, req, forHome };
}

describe('ShadowReportController', () => {
  it('koristi aktivni dom kad `homeProfileId` nije poslan', async () => {
    const { controller, req, forHome } = setup();
    await controller.shadowReport(req);
    expect(forHome).toHaveBeenCalledWith(3, 7, {});
  });

  it('eksplicitni dom ima prednost', async () => {
    const { controller, req, forHome } = setup();
    await controller.shadowReport(req, '12', '2026-11-01', '2026-11-30');
    expect(forHome).toHaveBeenCalledWith(3, 12, {
      from: '2026-11-01',
      to: '2026-11-30',
    });
  });

  it('bez aktivnog doma i bez parametra — 400 sa uputom', async () => {
    const { controller, req } = setup({ activeHomeProfileId: null });
    await expect(controller.shadowReport(req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('neispravan `homeProfileId` je 400, ne `NaN` u upitu', async () => {
    const { controller, req, forHome } = setup();
    for (const value of ['abc', '0', '-3', '1.5']) {
      await expect(controller.shadowReport(req, value)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(forHome).not.toHaveBeenCalled();
  });
});

describe('validatedWindow', () => {
  it('prihvata ispravan period i prazne vrijednosti preskače', () => {
    expect(validatedWindow({ from: '2026-11-01', to: '2026-11-30' })).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(validatedWindow({ from: '', to: undefined })).toEqual({});
  });

  it('odbija pogrešan format datuma', () => {
    expect(() => validatedWindow({ from: '01.11.2026' })).toThrow(
      BadRequestException,
    );
    expect(() => validatedWindow({ to: '2026-11-31T00:00:00Z' })).toThrow(
      BadRequestException,
    );
  });

  it('odbija `from` poslije `to`', () => {
    expect(() =>
      validatedWindow({ from: '2026-11-30', to: '2026-11-01' }),
    ).toThrow(BadRequestException);
  });
});
