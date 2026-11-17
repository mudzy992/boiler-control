/**
 * Potpisivanje Android build-a.
 *
 * **Zašto ovi testovi postoje.** Izmjereno 17.11.: `expo prebuild` generiše
 * `release { signingConfig signingConfigs.debug }`, pa je lokalni release APK
 * potpisan DEBUG ključem, a EAS build svojim. Android za isti `applicationId`
 * traži isti potpis — instalacija jednog preko drugog pada sa
 * „App not installed as package conflicts with an existing package".
 *
 * Poruka ne pominje potpis, pa se lako pripiše verziji. Ovi testovi drže
 * razliku: alat mora PREPOZNATI debug potpis i moći ga zamijeniti.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { inspectSigning, readKeystoreProperties, wireSigning } = require('../android-signing');

/** Gradle kakav `expo prebuild` STVARNO generiše (izmjereno 17.11.). */
const PREBUILT_GRADLE = `
android {
    defaultConfig {
        applicationId 'com.boilercontrol.app'
        versionCode 20000
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}
`;

function makeApp({ gradle = PREBUILT_GRADLE, properties = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signing-'));
  const appDir = path.join(dir, 'android', 'app');
  fs.mkdirSync(appDir, { recursive: true });
  if (gradle !== null) {
    fs.writeFileSync(path.join(appDir, 'build.gradle'), gradle);
  }
  if (properties) {
    fs.writeFileSync(path.join(dir, 'android', 'keystore.properties'), properties);
  }
  return dir;
}

const PROPERTIES = [
  'storeFile=release.jks',
  'storePassword=tajna1',
  'keyAlias=release',
  'keyPassword=tajna2',
].join('\n');

let dirs = [];
const tmp = (opts) => {
  const d = makeApp(opts);
  dirs.push(d);
  return d;
};
afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('prepoznavanje potpisa', () => {
  it('prebuild rezultat je potpisan DEBUG ključem — to je uzrok konflikta', () => {
    // Ako ovaj test padne, `expo prebuild` je promijenio šablon i alat treba
    // ponovo izmjeriti — ne pretpostaviti.
    const result = inspectSigning(tmp());
    expect(result.signedWith).toBe('debug');
    expect(result.hasKeystore).toBe(false);
  });

  it('bez android/ vraća no-prebuild, ne puca', () => {
    const dir = tmp();
    fs.rmSync(path.join(dir, 'android'), { recursive: true, force: true });
    expect(inspectSigning(dir).state).toBe('no-prebuild');
  });
});

describe('keystore.properties', () => {
  it('čita sva četiri polja, ignorisanje komentara', () => {
    const dir = tmp({ properties: `# komentar\n\n${PROPERTIES}\n` });
    expect(readKeystoreProperties(dir)).toEqual({
      storeFile: 'release.jks',
      storePassword: 'tajna1',
      keyAlias: 'release',
      keyPassword: 'tajna2',
    });
  });

  it('bez fajla vraća null — to je normalno stanje, ne greška', () => {
    expect(readKeystoreProperties(tmp())).toBeNull();
  });

  it('nepotpun fajl se ODBIJA, ne tiho prihvata', () => {
    // Build koji padne na pola puta je gori od jasne poruke prije početka.
    const dir = tmp({ properties: 'storeFile=a.jks\n' });
    expect(() => readKeystoreProperties(dir)).toThrow(/nema polja/);
  });
});

describe('postavljanje release potpisa', () => {
  it('zamjenjuje debug potpis na release', () => {
    const dir = tmp({ properties: PROPERTIES });
    wireSigning(dir);

    expect(inspectSigning(dir).signedWith).toBe('release');
  });

  it('dodaje release signingConfig sa putanjom RELATIVNOM na android/', () => {
    /*
     * Apsolutna putanja bi vezala build za jednu mašinu: niko drugi ne bi
     * mogao da napravi APK, a greška bi bila „keystore not found".
     */
    const dir = tmp({ properties: PROPERTIES });
    wireSigning(dir);

    const gradle = fs.readFileSync(path.join(dir, 'android/app/build.gradle'), 'utf8');
    expect(gradle).toContain("storeFile rootProject.file('release.jks')");
    // Keystore se ne stavlja u repo, nego se reference drže van njega.
    expect(gradle).not.toContain(dir);
  });

  it('je idempotentan — drugo pokretanje ne mijenja fajl', () => {
    const dir = tmp({ properties: PROPERTIES });
    wireSigning(dir);
    const first = fs.readFileSync(path.join(dir, 'android/app/build.gradle'), 'utf8');

    wireSigning(dir);
    const second = fs.readFileSync(path.join(dir, 'android/app/build.gradle'), 'utf8');

    expect(second).toBe(first);
  });

  it('bez keystore.properties ODBIJA i kaže zašto — ne pravi tiho debug build', () => {
    const dir = tmp();
    expect(() => wireSigning(dir)).toThrow(/keystore\.properties/);
  });

  it('bez prebuild-a baca jasnu poruku', () => {
    const dir = tmp({ gradle: null });
    expect(() => wireSigning(dir)).toThrow(/prebuild/);
  });
});
