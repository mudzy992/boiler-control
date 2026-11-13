#!/usr/bin/env bash
# Jedna anotacija iz jednog mjerenja.
#
# **Zašto ovo postoji.** GitHub prihvata najviše **50 anotacija po job-u** i
# tiho odbacuje ostatak. Baseline job ima 9 mjerenja, a svako je dosad
# emITovalo svaku liniju sa dva razmaka kao zasebnu anotaciju (~10 po mjerenju).
# Zato je redoslijed koraka odlučivao šta se vidi: F4.5/F4.6/F4.7 su prolazile,
# a **F3.4 i F3.5 — zadnja dva mjerenja — nikad nisu stizala do anotacija**.
# Nalaz je postojao u logu, ali log se u ovom okruženju ne može preuzeti, pa je
# mjerenje bilo praktično nevidljivo.
#
# Rješenje: jedan `::notice::` po mjerenju, sa prefiksom (F4.5, F3.4…) i
# **presudom prvom**, jer je presuda ono što se čita. Detalji ostaju u logu.
#
# Upotreba:
#   emit_notice.sh F4.5 "$RUNNER_TEMP/osc.log"
#
# `%`, CR i LF se escape-uju jer `::notice::` je protokol, ne tekst: neescape-ovan
# `%` GitHub čita kao escape sekvencu, a nova linija prekida anotaciju.

set -u

PREFIX="${1:?prefix je obavezan (npr. F4.5)}"
LOG="${2:?putanja do loga je obavezna}"

if [ ! -f "$LOG" ]; then
  echo "::warning::${PREFIX}: log ${LOG} ne postoji — mjerenje nije ni pokrenuto"
  exit 0
fi

# Presuda je ona linija koja nosi odluku. Redoslijed je namjerno:
#   1. skriptin VLASTITI `::notice::` — neka mjerenja (F3.4) sama znaju šta je
#      presuda i već je formuliraju; ne treba im naš izbor
#   2. `SAZETAK:` — mjerenja koja ga imaju (noviji dizajn)
#   3. presuda velikim slovima (STABLE, MODEL_BELOW_OLD_FLOOR, CURVE_IS_…)
#   4. prva linija sa dva razmaka (starija mjerenja bez SAZETKA)
#   5. zadnja neprazna linija — nikad prazna anotacija
#
# Slučaj 1 je važan: bez njega bi F3.4 anotacija bila posljednja linija
# markdown tabela, a presuda koju je skripta već izračunala bi se izgubila.
own=$(grep -m1 '^::notice::' "$LOG" 2>/dev/null | sed 's/^::notice:://' || true)
if [ -n "$own" ]; then
  # Skripta već ima presudu; samo je prosljeđujemo uz prefiks.
  safe=$(printf '%s' "$own" | tr -d '\r' | sed 's/%/%25/g' | tr '\n' ' ')
  echo "::notice::${PREFIX}${safe}"
  exit 0
fi

summary=$(grep -m1 '^  SAZETAK:' "$LOG" 2>/dev/null || true)
if [ -z "$summary" ]; then
  summary=$(grep -m1 -E '^  [A-Z][A-Z0-9_]{3,}: ' "$LOG" 2>/dev/null || true)
fi
if [ -z "$summary" ]; then
  summary=$(grep -m1 '^  ' "$LOG" 2>/dev/null || true)
fi
if [ -z "$summary" ]; then
  summary=$(grep -v '^[[:space:]]*$' "$LOG" 2>/dev/null | tail -1 || true)
fi

# Escape za anotacijski protokol.
safe=$(printf '%s' "$summary" \
  | tr -d '\r' \
  | sed 's/%/%25/g; s/$//' \
  | tr '\n' ' ')

echo "::notice::${PREFIX}${safe}"
