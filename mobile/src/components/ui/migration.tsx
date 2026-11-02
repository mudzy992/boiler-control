import React, { createContext, useContext } from 'react';

export const UI_SCREENS = [
  'Analytics',
  'Dashboard',
  'GasAnalysis',
  'GasForm',
  'GasReadings',
  'Heating',
  'HomeManagement',
  'Login',
  'Navigation',
  'NotificationPreferences',
  'Notifications',
  'Profile',
  'Register',
  'Schedule',
  'Settings',
  'UpdateRequired',
] as const;

export type UiScreen = (typeof UI_SCREENS)[number];
export type UiImplementation = 'legacy' | 'nativewind';

/**
 * Temporary build-time rollout control. An explicit list overrides the
 * defaults below: `all`, `none`, or comma-separated screen IDs. The entire
 * mechanism is removed when MO2-14 removes the legacy implementation.
 */
const DEFAULT_NATIVEWIND_SCREENS = new Set<UiScreen>([
  'Login',
  'Register',
  'UpdateRequired',
]);

function nativeWindEnabled(screen: UiScreen): boolean {
  const override = process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS?.trim();
  if (override === 'all') return true;
  if (override === 'none') return false;
  if (override) {
    return new Set(override.split(',').map((item: string) => item.trim())).has(screen);
  }
  return DEFAULT_NATIVEWIND_SCREENS.has(screen);
}

// Exported only for overlay boundaries: custom toast content is rendered by
// the root provider and must retain the implementation selected by its caller.
export const UiImplementationContext = createContext<UiImplementation>('legacy');

export function UiImplementationProvider({
  screen,
  children,
}: {
  screen: UiScreen;
  children: React.ReactNode;
}) {
  const implementation = nativeWindEnabled(screen) ? 'nativewind' : 'legacy';
  return (
    <UiImplementationContext.Provider value={implementation}>
      {children}
    </UiImplementationContext.Provider>
  );
}

export function useUiImplementation(): UiImplementation {
  return useContext(UiImplementationContext);
}

export function withUiImplementation<P extends object>(
  screen: UiScreen,
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <UiImplementationProvider screen={screen}>
      <Component {...props} />
    </UiImplementationProvider>
  );
  Wrapped.displayName = `WithUiImplementation(${Component.displayName ?? Component.name ?? screen})`;
  return Wrapped;
}
