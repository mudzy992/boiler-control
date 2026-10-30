import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * FE2-11 — zajednički test setup.
 *
 * - `@testing-library/jest-dom/vitest` dodaje matchere poput
 *   `toBeInTheDocument()`.
 * - `cleanup()` nakon svakog testa: bez njega bi DOM iz prethodnog testa
 *   ostao montiran i lažno zadovoljio upite sljedećeg.
 * - `window.confirm` je stubovan jer `GasReadingCard` zove `window.confirm`
 *   prije brisanja; jsdom inače baca "not implemented".
 * - `matchMedia` je stubovan jer antd ga čita pri renderu.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
}
