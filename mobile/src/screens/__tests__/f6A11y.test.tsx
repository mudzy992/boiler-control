import mockReact from 'react';
import { AccessibilityInfo, Text as mockNativeText } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { AnimatedSplash } from '../../components/AnimatedSplash';

/**
 * F6 (A11Y-15): poštovanje sistemske postavke „Ukloni animacije".
 *
 * WCAG 2.2 SC 2.3.3 (Animation from Interactions): korisnik mora moći isključiti
 * animaciju koja nije neophodna. Splash je jedina animacija u aplikaciji i prije
 * F6 se puštala bez obzira na postavku.
 */

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return { Ionicons: createIcon(), MaterialCommunityIcons: createIcon() };
});

describe('AnimatedSplash — reduced motion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('kad je animacija uklonjena, splash se odmah predaje dalje', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockReturnValue({ remove: jest.fn() } as any);

    const onFinished = jest.fn();
    const result = await render(<AnimatedSplash visible onFinished={onFinished} />);

    await waitFor(() => expect(onFinished).toHaveBeenCalled());

    await result.unmount();
  });

  it('kad animacija nije uklonjena, splash ne završava sinhrono', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockReturnValue({ remove: jest.fn() } as any);

    const onFinished = jest.fn();
    const result = await render(<AnimatedSplash visible onFinished={onFinished} />);

    // Animacija traje 650 + 350 + 300 ms — u prvom trenutku nije gotova.
    expect(onFinished).not.toHaveBeenCalled();

    await result.unmount();
  });
});
