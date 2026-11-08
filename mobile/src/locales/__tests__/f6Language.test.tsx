import { Text, Pressable } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';
import i18n from '../config';

/**
 * F6 (SET-02): promjena jezika u Postavkama.
 *
 * Na uređaju se dešavalo da `App.tsx` pri pokretanju pročita `app.language` iz
 * `AppStorage`-a i pozove `changeLanguage`, a da se pri tome NE zaustavi
 * renderovanje — pa se prikaže tekst na starom jeziku do sljedećeg montiranja
 * ekrana. Ovaj test čuva tri stvari koje promjenu čine stvarnom:
 *   1. `changeLanguage` mijenja `i18n.language`;
 *   2. sve komponente koje koriste `useTranslation` se ponovo renderuju;
 *   3. i18n podržava tačno `en-US` i `bs-BS` (nema tihog fallbacka na en).
 */
function Probe() {
  const { t } = require('../../hooks/useTranslation').useTranslation();
  return (
    <>
      <Text testID="naslov">{t('settings.title')}</Text>
      <Pressable testID="promijeni" onPress={() => void i18n.changeLanguage('bs-BS')} />
    </>
  );
}

it('changeLanguage prevodi postojeće komponente bez remounta', async () => {
  const result = await render(<Probe />);
  expect(result.getByTestId('naslov').props.children).toBe('Settings');

  await act(async () => {
    fireEvent.press(result.getByTestId('promijeni'));
  });

  expect(i18n.language).toBe('bs-BS');
  expect(result.getByTestId('naslov').props.children).toBe('Postavke');

  await act(async () => {
    await i18n.changeLanguage('en-US');
  });
  expect(result.getByTestId('naslov').props.children).toBe('Settings');
  await result.unmount();
});

it('i18n podržava tačno dva jezika, bez implicitnih varijanti', () => {
  const options = i18n.options as { supportedLngs?: string[]; load?: string };
  // `cimode` dodaje sam i18next (prevod ključeva, koristi se u razvoju), pa je
  // jedini dozvoljeni dodatak — nikakve `bs`/`en` varijante.
  expect((options.supportedLngs ?? []).filter((lng) => lng !== 'cimode')).toEqual([
    'en-US',
    'bs-BS',
  ]);
  expect(options.load).toBe('currentOnly');
});
