import * as React from 'react';
import { AxiosError } from 'axios';
import { useToast } from '../../components/ui/nativewind';
import i18n from '../../locales/config';

/**
 * Error handling utility for consistent error messages across the mobile app.
 * Converts backend errors into user-friendly messages.
 *
 * MO2-5: `showError` je prije samo radio `console.error`, pa korisnik NIJE vidio
 * nijednu grešku — a poziva se 15 puta na 3 ekrana (GasReadingsScreen 12,
 * DashboardScreen 2, HeatingScreen 1). Sada prikazuje toast kroz zajednički UI sloj.
 */

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
}

/**
 * Mapira HTTP status (ili mrežnu grešku) na postojeći `errors.*` i18n ključ.
 * Ključevi su već prevedeni u oba jezika (`src/locales/config.ts`: en 610-619,
 * bs 1199-1206), pa se ne uvode novi tekstovi.
 */
function i18nKeyForStatus(statusCode: number, isNetworkError: boolean): string {
  if (isNetworkError) {
    return 'errors.networkError';
  }
  switch (statusCode) {
    case 400:
    case 422:
      return 'errors.badRequest';
    case 401:
      return 'errors.unauthorized';
    case 403:
      return 'errors.forbidden';
    case 404:
      return 'errors.notFound';
    case 408:
      return 'errors.timeout';
    case 409:
      return 'errors.conflict';
    case 500:
    case 503:
      return 'errors.serverError';
    default:
      return 'errors.serverError';
  }
}

export class ApiError extends Error {
  public statusCode: number;
  public isNetworkError: boolean;
  public userMessage: string;

  constructor(
    statusCode: number,
    message: string,
    isNetworkError: boolean = false,
    userMessage?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isNetworkError = isNetworkError;
    this.userMessage = userMessage || this.getDefaultUserMessage(statusCode);
  }

  private getDefaultUserMessage(statusCode: number): string {
    // MO2-5: prevedeno preko i18n umjesto hardkodovanog engleskog teksta.
    return i18n.t(i18nKeyForStatus(statusCode, this.isNetworkError));
  }
}

/**
 * Parse Axios error into user-friendly ApiError
 */
export function parseApiError(error: unknown): ApiError {
  // Network error (no response)
  if (error instanceof AxiosError && !error.response) {
    // Axios timeout se također javlja bez response-a, ali ima poseban code.
    const isTimeout = error.code === 'ECONNABORTED';
    return new ApiError(
      isTimeout ? 408 : 0,
      error.message || 'Network request failed',
      !isTimeout
    );
  }

  // HTTP error response
  if (error instanceof AxiosError && error.response) {
    const status = error.response.status;
    const data = error.response.data as ApiErrorResponse | undefined;
    const message = data?.message || error.message || 'Unknown error';

    // MO2-5: za 401 uvijek koristimo prevedenu poruku. Backend tekst
    // ("Unauthorized") korisniku ne govori da se treba ponovo prijaviti.
    const userMessage = status === 401 ? undefined : data?.message || undefined;

    return new ApiError(status, message, false, userMessage);
  }

  // Generic error
  if (error instanceof Error) {
    return new ApiError(500, error.message, false);
  }

  return new ApiError(500, 'An unknown error occurred', false);
}

/**
 * Hook for showing error toasts.
 * Usage: const { showError } = useErrorHandler();
 *        showError(error);
 *
 * MO2-5: identitet `showError` je namjerno STABILAN (prazan deps + ref).
 * Pozivna mjesta ga stavljaju u `useEffect` deps, npr.
 * `DashboardScreen.tsx:65-69`:
 *
 *     React.useEffect(() => {
 *       if (error) showError(error, t('dashboard.loadError'));
 *     }, [error, showError, t]);
 *
 * Da je `showError` nova funkcija pri svakom renderu, `toast.show()` bi
 * re-renderovao ekran, efekt bi se ponovo izvršio i nastala bi beskonačna
 * petlja tostova. Ref to spriječava bez obzira na stabilnost `useToast()`.
 */
export function useErrorHandler() {
  const toast = useToast();
  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const showError = React.useCallback((error: unknown, customMessage?: string) => {
    const apiError = error instanceof ApiError ? error : parseApiError(error);
    const finalMessage = customMessage || apiError.userMessage;

    /*
     * F7 (BUG-CRASH): `toast.show({ description: undefined })` je RUŠIO ekran.
     *
     * `ApiError` za mrežnu grešku ima `userMessage` postavljen, ali za 401 ga
     * namjerno NEMA (poruka se prevodi u `i18nKeyForStatus`, a `userMessage`
     * ostaje `undefined`). Bez `customMessage` (npr. `getDashboardHealth` u
     * `DashboardScreen`) `finalMessage` je tada bio `undefined`, pa je toast
     * dobio `description: undefined` i `_description: { color: ..., fontSize: ... }`
     * — NativeWind je pokušao da stilizuje nedefinisan tekst i bacio grešku
     * IZNAD ekrana. Korisnik to vidi kao „aplikacija zabaguje".
     *
     * Zato: poruka NIKAD nije prazna — pada na prevedeni status, a ako i to
     * izostane, na generički `errors.serverError`. Dodatno se cijeli poziv
     * hvata, jer poruka o grešci ne smije srušiti ekran koji grešku prijavljuje.
     */
    const message =
      finalMessage ||
      apiError.userMessage ||
      i18n.t(i18nKeyForStatus(apiError.statusCode, apiError.isNetworkError));

    if (__DEV__) {
      console.error('[API Error]', {
        statusCode: apiError.statusCode,
        message: apiError.message,
        userMessage: finalMessage,
        isNetworkError: apiError.isNetworkError,
      });
    }

    // Stil ide preko zajedničkih Box propova. Ovdje se ne može koristiti
    // `render` obrazac iz DashboardScreen.tsx jer je ovo .ts fajl bez JSX-a.
    try {
      toastRef.current.show({
        description: message,
        duration: 4000,
        placement: 'top',
        bg: 'red.500',
        rounded: 'md',
        px: 3,
        py: 2,
        _description: { color: 'white', fontSize: 'sm' },
        accessibilityAnnouncement: message,
        accessibilityLiveRegion: 'assertive',
      });
    } catch (notifyError) {
      // Posljednja linija odbrane: ako toast padne, greška ide u konzolu, a
      // ekran nastavlja da radi (do sada je ovdje pucao cijeli render).
      console.error('[API Error] toast nije prikazan', notifyError);
    }
  }, []);

  return { showError };
}

/**
 * Standalone verzija za korištenje izvan hookova.
 *
 * NAPOMENA: ime je historijsko — ova funkcija NE prikazuje toast (ne može, jer
 * `useToast` zahtijeva React kontekst). Samo loguje u `__DEV__` i vraća poruku
 * koju pozivalac može sam prikazati. Trenutno nema pozivalaca.
 */
export function showErrorToast(error: unknown, customMessage?: string) {
  const apiError = error instanceof ApiError ? error : parseApiError(error);
  const message = customMessage || apiError.userMessage;

  if (__DEV__) {
    console.error('[API Error]', {
      statusCode: apiError.statusCode,
      message: apiError.message,
      userMessage: message,
      isNetworkError: apiError.isNetworkError,
    });
  }

  return message;
}
