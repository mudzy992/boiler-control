#!/usr/bin/env bash
#
# Lokalni build — mobilna i TV aplikacija, sa automatskim dizanjem verzije.
#
#   ./scripts/build/build-menu.sh
#
# ## Zašto skripta postoji
#
# Lokalni build je dosad tražio da se pamti: koji folder, koja `EXPO_TV`
# varijanta, da li `prebuild --clean`, i — najčešće zaboravljeno — da se
# `version` u `package.json` digne **prije** builda. Zaboravljena verzija ne
# pravi grešku: APK se izgradi i nosi isti `versionCode`, pa ga Android odbije
# kao „već instalirano" ili, gore, tiho instalira kao istu verziju.
#
# ## Šta se diže i šta ne
#
# Digne se `version` u `package.json` i `package-lock.json`. `versionCode` se
# **ne piše** — `app.config.js` ga izvodi iz `version` (formula
# `major*10000 + minor*100 + patch`), pa bi ručni upis bio drugi izvor istine.
#
# ## Sigurnosna mreža
#
# Verzija se diže **prije** builda, ali ako build padne — vraća se. Bez toga bi
# propali build ostavio broj koji nijedan APK ne nosi, pa bi sljedeći uspješan
# build preskočio broj i istorija više ne bi bila čitljiva.
#
# Koristi se `set -euo pipefail`: svaka greška prekida, nedefinisana varijabla
# je greška, a pad u cijevi se ne gubi. Bez toga bi `gradle` mogao pasti a
# skripta nastaviti kao da je uspjelo.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSIONS_JS="$REPO_ROOT/scripts/build/versions.js"
SIGNING_JS="$REPO_ROOT/scripts/build/android-signing.js"
MOBILE_DIR="$REPO_ROOT/mobile"
TV_DIR="$REPO_ROOT/tv"

# Boje samo kad je terminal — u CI logu bi ANSI sekvence bile smeće.
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; CYAN=""; RESET=""
fi

# --- pomoćne -----------------------------------------------------------------

say()  { printf '%s\n' "$*"; }
info() { printf '%s%s%s\n' "$CYAN" "$*" "$RESET"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
die()  { printf '%s✗%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

# Node je jedina obavezna zavisnost: verzije se čitaju i pišu kroz `versions.js`,
# da pravilo o semveru i `package-lock.json` postoji na jednom mjestu.
require_node() {
  command -v node >/dev/null 2>&1 || die "Node.js nije u PATH-u."
  [ -f "$VERSIONS_JS" ] || die "Nedostaje $VERSIONS_JS"
}

# Provjeri da folder ima zavisnosti; bez toga `expo` komande padaju na
# „@expo/cli not found", što ne kaže šta treba uraditi.
require_deps() {
  local dir="$1" name="$2"
  [ -d "$dir/node_modules" ] || {
    warn "Nema node_modules u $name/."
    say "    Pokreni: cd ${name} && npm install"
    return 1
  }
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' nije u PATH-u. $2"
}

# Vrijednosti iz versions.js — jedan izvor formule.
version_of() { node -e "console.log(require('$VERSIONS_JS').readVersion('$1'))"; }
code_of()    { node -e "console.log(require('$VERSIONS_JS').versionCode('$1'))"; }

# --- verzija -----------------------------------------------------------------

BUMP="patch"          # zadnje korišteno dizanje, pamti se kroz meni
LAST_RESTORE=""       # <dir>|<stara verzija> — za poništavanje ako build padne
LAST_RESTORE_FILE=""  # gdje je zapisano, da preživi i `Ctrl+C`

remember_restore() {
  LAST_RESTORE_FILE="$REPO_ROOT/.build-restore"
  printf '%s|%s\n' "$1" "$2" > "$LAST_RESTORE_FILE"
}

clear_restore() {
  rm -f "$LAST_RESTORE_FILE"
}

# Ako prethodni build padne, verzija ostane dignuta. Ovo je jedina stvar koja
# to ispravi, pa se poziva i pri izlasku i pri grešci.
restore_on_exit() {
  local payload=""
  [ -f "$LAST_RESTORE_FILE" ] && payload="$(cat "$LAST_RESTORE_FILE")"
  [ -n "$payload" ] || return 0

  local dir="${payload%%|*}"
  local prev="${payload##*|}"
  node -e "require('$VERSIONS_JS').restoreVersion('$dir','$prev')" >/dev/null 2>&1
  warn "Build nije dovršen — verzija vraćena na $prev."
  clear_restore
}

trap restore_on_exit EXIT INT TERM

# Digni verziju i zapamti staru radi poništavanja.
bump_app_version() {
  local dir="$1" name="$2"
  local current next
  current="$(version_of "$dir")"
  next="$(node -e "console.log(require('$VERSIONS_JS').bumpVersion('$current','$BUMP'))")"

  remember_restore "$dir" "$current"
  local out
  out="$(node -e "
    const v = require('$VERSIONS_JS').setVersion('$dir', '$next');
    console.log(v.previous + ' ' + v.next + ' ' + v.previousCode + ' ' + v.nextCode);
  ")"
  # shellcheck disable=SC2086
  set -- $out
  ok "$name: $1 → $2   (versionCode $3 → $4)"
}

# Prikaži trenutne verzije obje aplikacije.
show_versions() {
  echo
  printf '%sVERZIJE%s\n' "$BOLD" "$RESET"
  printf '  %-12s %-8s %s\n' "aplikacija" "version" "versionCode"
  local app dir v dir_label
  for app_dir in "mobile:$MOBILE_DIR" "tv:$TV_DIR"; do
    dir_label="${app_dir%%:*}"
    dir="${app_dir##*:}"
    v="$(version_of "$dir")"
    printf '  %-12s %-8s %s\n' "$dir_label" "$v" "$(code_of "$v")"
  done
  printf '  %s%s%s\n' "$DIM" "formula: ${BOLD}major*10000 + minor*100 + patch${RESET}${DIM} (u app.config.js)" "$RESET"
  printf '  %sverzija se u meniju diže prije builda, tip izmjene: %s%s\n\n' \
    "$DIM" "$BUMP" "$RESET"
}

# --- build -------------------------------------------------------------------

# `EXPO_TV=1` je obavezan za TV: bez njega `prebuild` generiše običnu Android
# aplikaciju koja se NE pojavljuje na TV početnom ekranu (nema
# LEANBACK_LAUNCHER). To se ne vidi iz koda, samo iz manifesta.
run_build() {
  local dir="$1" name="$2" variant="$3"
  shift 3
  local -a env_prefix=()
  [ "$variant" = "tv" ] && env_prefix=(env EXPO_TV=1)

  info "▶ Build: $name ($variant)"
  (
    cd "$dir"
    "${env_prefix[@]}" "$@"
  )
  ok "Build dovršen: $name ($variant)"
}

# Svjež `prebuild`: briše `android/` i generiše ga iz `app.config.js`.
# `--clean` je namjerno: bez njega stari `android/` drži staru verziju i stari
# manifest, pa izmjena u `app.config.js` tiho ne važi.
prebuild_of() {
  local dir="$1" variant="$2"
  local -a env_prefix=()
  [ "$variant" = "tv" ] && env_prefix=(env EXPO_TV=1)

  info "▶ prebuild --clean ($variant)"
  ( cd "$dir" && "${env_prefix[@]}" npx expo prebuild --platform android --clean )
  ok "prebuild dovršen"

  ensure_release_signing "$dir" "$variant"
}

# `expo prebuild` UVIJEK generiše `release { signingConfig signingConfigs.debug }`
# — tj. release APK potpisan DEBUG ključem (izmjereno 17.11.). Ako je preko tog
# `applicationId` već instaliran APK iz EAS builda (svoj ključ), instalacija
# lokalnog pada sa:
#
#   „App not installed as package conflicts with an existing package"
#
# Poruka ne pominje potpis ni keystore, pa se lako pripiše verziji. Zato se
# potpis provjerava prije builda, a ne poslije neuspjele instalacije.
ensure_release_signing() {
  local dir="$1" name="$2"

  if [ -f "$dir/android/keystore.properties" ]; then
    # Keystore postoji: uskladi release potpis prije nego što gradle krene.
    if node "$SIGNING_JS" wire "$dir" >/dev/null 2>&1; then
      ok "$name: release potpisan keystore-om iz android/keystore.properties"
    else
      warn "$name: keystore.properties postoji, ali potpis nije postavljen"
    fi
    return 0
  fi

  local signed_with
  signed_with="$(node "$SIGNING_JS" check "$dir" 2>/dev/null | head -1 | sed 's/.*: //')"
  if [ "$signed_with" = "debug" ]; then
    warn "$name: release APK će biti potpisan DEBUG ključem."
    say "    To radi samo ako na uređaju NIJE instaliran EAS build iste aplikacije."
    say "    U suprotnom Android odbija instalaciju: 'package conflicts with an existing package'."
    say "    Rješenje: android/keystore.properties (storeFile, storePassword, keyAlias, keyPassword),"
    say "    pa pokreni ovaj build ponovo — potpis se tada uskladi automatski."
    say "    Ili prvo odinstaliraj aplikaciju: adb uninstall ${name/@/-}"
  fi
}

build_apk_release() {
  local dir="$1" name="$2" variant="$3"
  require_deps "$dir" "$name" || return 1

  prebuild_of "$dir" "$variant"
  run_build "$dir" "$name" "$variant" \
    ./android/gradlew -p android assembleRelease

  local apk_dir="$dir/android/app/build/outputs/apk/release"
  if [ -f "$apk_dir/app-release.apk" ]; then
    local dest="$REPO_ROOT/dist/$name-$(version_of "$dir").apk"
    mkdir -p "$REPO_ROOT/dist"
    cp "$apk_dir/app-release.apk" "$dest"
    ok "APK: ${dest#$REPO_ROOT/}"
  else
    warn "APK nije nađen u $apk_dir — gradle je prošao bez izlaza?"
  fi
}

build_debug() {
  local dir="$1" name="$2" variant="$3" device="${4:-}"
  require_deps "$dir" "$name" || return 1

  prebuild_of "$dir" "$variant"
  local -a args=(--variant debug)
  [ -n "$device" ] && args+=(--device "$device")
  run_build "$dir" "$name" "$variant" npx expo run:android "${args[@]}"
}

start_dev_server() {
  local dir="$1" name="$2" variant="$3"
  require_deps "$dir" "$name" || return 1

  # TV traži `prebuild` prije `run:android`; bez toga manifest nema
  # LEANBACK_LAUNCHER i aplikacija se ne pojavi na TV-u.
  if [ "$variant" = "tv" ]; then
    prebuild_of "$dir" "$variant"
  fi
  info "▶ Dev server: $name (Ctrl+C za izlaz)"
  run_build "$dir" "$name" "$variant" npx expo start
}

run_tests() {
  local dir="$1" name="$2"
  require_deps "$dir" "$name" || return 1
  info "▶ Typecheck: $name"
  ( cd "$dir" && npx tsc --noEmit )
  ok "tsc čist"
  info "▶ Testovi: $name"
  ( cd "$dir" && npx jest --forceExit )
}

# `npm ci` u CI-ju pada ako se verzije u `package.json` i `package-lock.json`
# ne slažu — a poruka ne kaže na koji fajl misli. Provjera je ovdje da se to
# vidi prije nego što se commitom pokvari CI.
check_lock_version() {
  local dir="$1" name="$2"
  local pkg_v lock_v=""
  pkg_v="$(version_of "$dir")"
  [ -f "$dir/package-lock.json" ] || { warn "$name: nema package-lock.json"; return 0; }
  lock_v="$(node -e "console.log(require('$dir/package-lock.json').version ?? '')" 2>/dev/null || echo '')"
  if [ "$pkg_v" = "$lock_v" ]; then
    ok "$name: package.json i package-lock.json usklađeni ($pkg_v)"
  else
    warn "$name: NEUSKLAĐENO — package.json $pkg_v, package-lock.json ${lock_v:-<nema>}"
    warn "    popravi: cd $name && npm install --package-lock-only"
    return 1
  fi
}

# Je li release APK potpisan istim ključem kao dosadašnji buildovi.
#
# `debug` potpis nije greška po sebi — greška je INSTALIRATI ga preko APK-a
# potpisanog drugim ključem. Zato se ovdje samo prijavljuje, sa objašnjenjem.
check_signing() {
  local dir="$1" name="$2"
  local out signed_with
  out="$(node "$SIGNING_JS" check "$dir" 2>/dev/null || true)"

  if [ -z "$out" ] || [ "${out%%$'\n'*}" = "nema android/ — pokreni prebuild" ]; then
    # Nema prebuild-a: nema šta da se provjeri (i to je normalno stanje repoa).
    ok "$name: android/ nije generisan (potpis se provjerava poslije prebuild-a)"
    return 0
  fi

  signed_with="$(printf '%s\n' "$out" | head -1 | sed 's/.*: //')"
  if [ "$signed_with" = "release" ]; then
    ok "$name: release potpisan keystore-om"
  else
    warn "$name: release potpisan DEBUG ključem (ne može preko EAS builda iste aplikacije)"
  fi
}

run_preflight() {
  echo
  local problems=0
  for tool in node npx git; do
    if command -v "$tool" >/dev/null 2>&1; then
      ok "$tool: $(command -v "$tool")"
    else
      warn "$tool: NEMA"
      problems=$((problems + 1))
    fi
  done

  # Android build traži JDK i SDK. Bez njih `gradlew` padne sa porukom koja
  # ne kaže da je uzrok nedostajući JDK.
  if command -v java >/dev/null 2>&1; then
    ok "java: $(java -version 2>&1 | head -1)"
  else
    warn "java: NEMA — release/debug build neće raditi"
    problems=$((problems + 1))
  fi
  if [ -n "${ANDROID_HOME:-}" ] || [ -n "${ANDROID_SDK_ROOT:-}" ]; then
    ok "ANDROID_HOME: ${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
  else
    warn "ANDROID_HOME/ANDROID_SDK_ROOT: nije postavljen"
    problems=$((problems + 1))
  fi
  if command -v adb >/dev/null 2>&1; then
    local devices
    devices="$(adb devices | awk 'NR>1 && $2=="device"' | wc -l | tr -d ' ')"
    ok "adb: $devices povezanih uređaja"
  else
    warn "adb: NEMA — instalacija na uređaj neće raditi"
  fi

  for app_dir in "mobile:$MOBILE_DIR" "tv:$TV_DIR"; do
    local dir_label="${app_dir%%:*}" dir="${app_dir##*:}"
    if [ -d "$dir/node_modules" ]; then
      ok "$dir_label/node_modules: postoji"
    else
      warn "$dir_label/node_modules: nema — pokreni: cd $dir_label && npm install"
    fi
    check_lock_version "$dir" "$dir_label" || problems=$((problems + 1))
    check_signing "$dir" "$dir_label"
  done

  echo
  if [ "$problems" -eq 0 ]; then
    ok "Sve potrebno je na mjestu."
  else
    warn "$problems stvari nedostaje (v. gore). Dev server radi i bez Androida."
  fi
}

# --- menu --------------------------------------------------------------------

pause() { printf '\n%sEnter za nastavak…%s' "$DIM" "$RESET"; read -r _ || true; }

choose_bump() {
  echo
  say "Kako dignuti verziju prije builda?"
  say "  1) patch  — ispravka        ($(node -e "console.log(require('$VERSIONS_JS').bumpVersion('$(version_of "$MOBILE_DIR")','patch'))") za mobilni)"
  say "  2) minor  — nova funkcionalnost"
  say "  3) major  — velika promjena"
  say "  4) bez dizanja — ponovni build iste verzije"
  printf '%s> %s' "$BOLD" "$RESET"
  local choice
  read -r choice || true
  case "$choice" in
    1|"") BUMP="patch" ;;
    2)    BUMP="minor" ;;
    3)    BUMP="major" ;;
    4)    BUMP="" ;;
    *)    warn "Nepoznat izbor — koristim patch."; BUMP="patch" ;;
  esac
}

# Digni verziju (ako nije izabrano „bez dizanja") pa pokreni build.
with_version() {
  local dir="$1" name="$2"
  shift 2
  choose_bump
  if [ -n "$BUMP" ]; then
    bump_app_version "$dir" "$name"
  else
    warn "Verzija ostaje $(version_of "$dir")."
  fi
  "$@"
}

menu() {
  while true; do
    clear 2>/dev/null || true
    printf '%s╔══════════════════════════════════════════════════════╗%s\n' "$BOLD" "$RESET"
    printf '%s║  Boiler Control — lokalni build                      ║%s\n' "$BOLD" "$RESET"
    printf '%s╚══════════════════════════════════════════════════════╝%s\n' "$BOLD" "$RESET"
    show_versions
    say "${BOLD}MOBILNA APLIKACIJA${RESET}"
    say "  1) Dev server (Expo) — bez builda"
    say "  2) Debug build + instalacija na uređaj"
    say "  3) Release APK (lokalni gradle)"
    say "  4) Testovi + typecheck"
    say ""
    say "${BOLD}TV APLIKACIJA${RESET}"
    say "  5) Dev server (Expo, EXPO_TV=1)"
    say "  6) Debug build + instalacija na TV"
    say "  7) Release APK (lokalni gradle)"
    say "  8) Testovi + typecheck"
    say ""
    say "${BOLD}OSTALO${RESET}"
    say "  9) Provjeri okolinu (java, adb, SDK, node_modules)"
    say "  v) Samo digni verziju, bez builda"
    say "  q) Izlaz"
    printf '\n%s> %s' "$BOLD" "$RESET"

    local choice
    read -r choice || exit 0
    case "$choice" in
      1) start_dev_server "$MOBILE_DIR" "mobile" "phone"; pause ;;
      2) with_version "$MOBILE_DIR" "mobile" build_debug "$MOBILE_DIR" "mobile" "phone"; pause ;;
      3) with_version "$MOBILE_DIR" "mobile" build_apk_release "$MOBILE_DIR" "mobile" "phone"; clear_restore; pause ;;
      4) run_tests "$MOBILE_DIR" "mobile"; pause ;;
      5) start_dev_server "$TV_DIR" "tv" "tv"; pause ;;
      6) with_version "$TV_DIR" "tv" build_debug "$TV_DIR" "tv" "tv"; pause ;;
      7) with_version "$TV_DIR" "tv" build_apk_release "$TV_DIR" "tv" "tv"; clear_restore; pause ;;
      8) run_tests "$TV_DIR" "tv"; pause ;;
      9) run_preflight; pause ;;
      v) with_version "$MOBILE_DIR" "mobile" true; clear_restore
         with_version "$TV_DIR" "tv" true; clear_restore; pause ;;
      q|Q) exit 0 ;;
      *) warn "Nepoznat izbor: $choice"; sleep 1 ;;
    esac
  done
}

require_node

# Ne-interaktivni režim: `build-menu.sh --versions` ispiše stanje i izađe.
# Koristi se u CI-ju/provjerama, pa meni nije jedini ulaz.
case "${1:-}" in
  --versions) show_versions; exit 0 ;;
  --check) run_preflight; exit 0 ;;
  --signing)
    # Stanje potpisa za obje aplikacije, bez prebuild-a.
    for app_dir in "mobile:$MOBILE_DIR" "tv:$TV_DIR"; do
      dir_label="${app_dir%%:*}"
      dir="${app_dir##*:}"
      printf '%s: ' "$dir_label"
      node "$SIGNING_JS" check "$dir" | tr '\n' ' '
      printf '\n'
    done
    exit 0 ;;
  --help|-h)
    say "Upotreba: $0 [--versions|--check|--signing|--help]"
    say "  bez argumenata  interaktivni meni"
    say "  --versions      ispiši verzije obje aplikacije i izađi"
    say "  --check         provjeri okolinu (java, adb, SDK, node_modules, potpis)"
    say "  --signing       čime je potpisan release APK (mobilni i TV)"
    exit 0 ;;
esac

menu
