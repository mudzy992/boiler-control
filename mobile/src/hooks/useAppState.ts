import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * MO2-13: React Query polling must follow the native app lifecycle.
 * `refetchInterval` alone keeps running while the app is backgrounded.
 *
 * RN 0.88 types `AppState.currentState` as `string | null | undefined` because
 * the native value can arrive after JS startup. Normalize it to the public
 * AppStateStatus union; a mounted screen is foreground unless RN says
 * otherwise.
 */
function normalizeAppState(value: string | null | undefined): AppStateStatus {
  switch (value) {
    case 'active':
    case 'background':
    case 'inactive':
    case 'extension':
    case 'unknown':
      return value;
    default:
      return 'active';
  }
}

export function useAppState(): AppStateStatus {
  const [appState, setAppState] = useState<AppStateStatus>(() =>
    normalizeAppState(AppState.currentState)
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  return appState;
}

export function useIsAppActive(): boolean {
  return useAppState() === 'active';
}
