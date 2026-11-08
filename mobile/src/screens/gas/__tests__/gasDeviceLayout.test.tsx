import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { AppThemeProvider } from '../../../theme/AppTheme';
import { Button } from '../../../ui/Button';
import { Pressable } from '../../../ui/Pressable';
import { Segmented } from '../../../ui/Segmented';
import i18n from '../../../locales/config';

/**
 * F9 (GAS-DEVICE-LAYOUT): regresija sa korisnikovih snimaka ekrana.
 *
 * Snimke su pokazale tri kvara koja testovi na snapshot nisu uhvatili, jer
 * snapshot samo pamti kako drvo IZGLEDA u Jestu, a ne kako se stil prenosi na
 * uređaj:
 *
 *  1. `Pressable` je primao `style` kao FUNKCIJU, a NativeWind 4 preslikava
 *     `style` pa funkcijski stil propadne — na uređaju tada nestanu okvir,
 *     visina i `flexDirection: 'row'`. Zato su dugmad u sheetu izgledala kao
 *     goli tekst, a redovi akcija su se složili u kolonu.
 *  2. `gas.readingCount` bez plural pravila u runtime-u vraća sam ključ.
 *  3. Traka Očitanja/Analiza bez `flexBasis: 0` slepi dvije riječi.
 *
 * Testovi provjeravaju uzrok (da `style` IDE DIREKTNO u RN `Pressable`, da
 * bazni ključ postoji, da segment ima `flexBasis`), a ne boju i piksele.
 */
describe('F9 — raspored na uređaju', () => {
  it('Pressable predaje stil direktno RN Pressable-u (ne funkcijom)', async () => {
    // RNTL 14: `render` je async — bez `await`-a vraća Promise, ne drvo.
    const view = await render(
      <AppThemeProvider colorMode="dark">
        <Pressable
          testID="meta"
          style={{ minHeight: 52, flexDirection: 'row', borderWidth: 1 }}
        >
          <Text>dijete</Text>
        </Pressable>
      </AppThemeProvider>,
    );

    const meta = view.getByTestId('meta');
    const flat = StyleSheet.flatten(meta.props.style);
    // Prije popravke `style` je bila funkcija, pa `flatten` nije mogao da
    // pročita NI JEDNO svojstvo — ovo je tačno ono što se vidi na snimci.
    expect(typeof meta.props.style).not.toBe('function');
    expect(flat.minHeight).toBe(52);
    expect(flat.flexDirection).toBe('row');
    expect(flat.borderWidth).toBe(1);
  });

  it('Button nosi okvir i visinu dodirne mete, bez obzira na varijantu', async () => {
    const view = await render(
      <AppThemeProvider colorMode="dark">
        <Button label="Uslikaj" variant="secondary" onPress={() => {}} testID="dugme" />
      </AppThemeProvider>,
    );
    const flat = StyleSheet.flatten(view.getByTestId('dugme').props.style);
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    expect(flat.borderWidth).toBe(1);
    expect(flat.backgroundColor).toBeDefined();
    expect(flat.backgroundColor).not.toBe('transparent');
  });

  it('segmented segment ima flexBasis 0 da se opcije ne slepe', async () => {
    const view = await render(
      <AppThemeProvider colorMode="dark">
        <Segmented
          options={[
            { value: 'readings', label: 'Očitanja' },
            { value: 'analysis', label: 'Analiza' },
          ]}
          value="readings"
          onChange={() => {}}
          testID="traka"
        />
      </AppThemeProvider>,
    );
    const flat = StyleSheet.flatten(view.getByTestId('traka-readings').props.style);
    // Bez `flexBasis: 0` širina se dijeli po sadržaju riječi, pa se
    // „OČITANJA" i „ANALIZA" slepe u jedan niz — tačno kako je na snimci.
    expect(flat.flexBasis).toBe(0);
    expect(flat.flex).toBe(1);
    // Traka kao cjelina ostaje red; pojedinačni segment je kolona sadržaja.
    const traka = StyleSheet.flatten(view.getByTestId('traka').props.style);
    expect(traka.flexDirection).toBe('row');
  });

  it('gas.readingCount nikad ne vraća sirovi ključ', () => {
    const bs = i18n.t('gas.readingCount', { count: 131, lng: 'bs-BS' });
    expect(bs).not.toBe('gas.readingCount');
    expect(bs).toContain('131');
    // Bazni ključ je sigurnosna mreža za runtime bez plural pravila.
    const resource = i18n.getResourceBundle('bs-BS', 'translation') as {
      gas: Record<string, string>;
    };
    expect(resource.gas.readingCount).toBeDefined();
    expect(resource.gas.readingCount).not.toBe('');
  });
});
