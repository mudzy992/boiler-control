#!/usr/bin/env bash
#
# „Probni restore" — vraća najnoviji dump u privremenu bazu i poredi brojeve
# redova s onim što je zabilježeno pri dumpu.
#
# Zašto je ovo važnije od samog backupa: backup koji nikad nije vraćen nije
# backup, nego datoteka. Do sada je tvrdnja „imamo dump" bila provjerena samo
# time što fajl postoji — ovo je prvi test koji stvarno čita dump.
#
# Ništa ne dira produkciju: podiže se **novi** `postgres` kontejner bez
# volume-a, u njega se restore-uje, provjere se brojevi, i kontejner se briše.
#
# Primjer:
#   /opt/boiler-control/scripts/backup/restore-verify.sh
#   BACKUP_DIR=/mnt/shared-app-files/boiler-control/backups ./restore-verify.sh
set -Eeuo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/mnt/shared-app-files/boiler-control}"
BACKUP_DIR="${BACKUP_DIR:-$BACKUP_ROOT/backups}"
PG_IMAGE="${PG_IMAGE:-postgres:16}"
SCRATCH_PASSWORD="${SCRATCH_PASSWORD:-scratch-only-not-a-secret}"
CONTAINER="bc-restore-verify-$$"
# Tolerancija: 0 znači „brojevi moraju biti identični". Postoji kao opcija jer
# se u praksi ponekad provjerava stariji dump nakon što je baza narasla.
TOLERANCE="${TOLERANCE:-0}"

log() { printf '%s\n' "$*" >&2; }

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

manifest="$BACKUP_DIR/manifest.json"
[ -f "$manifest" ] || { log "nema manifesta: $manifest"; exit 1; }

dump_name=$(grep -o '"dump": *"[^"]*"' "$manifest" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
[ -n "$dump_name" ] || { log "manifest nema ime dumpa"; exit 1; }
dump_path="$BACKUP_DIR/db/$dump_name"
[ -f "$dump_path" ] || { log "dump ne postoji: $dump_path"; exit 1; }

log "provjeravam: $dump_name ($(du -h "$dump_path" | cut -f1))"

# 1. integritet fajla prema onome što je zapisano pri dumpu
expected_sha=$(grep -o '"dumpSha256": *"[^"]*"' "$manifest" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
if [ -n "$expected_sha" ]; then
  actual_sha=$(sha256sum "$dump_path" | cut -d' ' -f1)
  if [ "$expected_sha" != "$actual_sha" ]; then
    log "SHA256 se ne slaže — dump je oštećen ili izmijenjen"
    log "  očekivano: $expected_sha"
    log "  stvarno:   $actual_sha"
    exit 1
  fi
  log "sha256: ok"
fi

# 2. prazna baza u privremenom kontejneru
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$SCRATCH_PASSWORD" \
  -e POSTGRES_DB=restore_check \
  -v "$BACKUP_DIR/db:/backup:ro" \
  "$PG_IMAGE" >/dev/null

ready=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d restore_check >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[ "$ready" = "1" ] || { log "privremena baza nije spremna"; exit 1; }

# 3. restore
docker exec "$CONTAINER" \
  pg_restore -U postgres -d restore_check --no-owner --no-privileges \
  "/backup/$dump_name" 2>/dev/null \
  || { log "pg_restore je javio greške (vidi gore)"; exit 1; }
log "restore: ok"

# 4. poređenje brojeva redova
mismatch=0
printf '%-18s %10s %10s %s\n' "tabela" "dump" "restore" "rezultat" >&2
while IFS= read -r line; do
  # manifest: "counts": {"User": 3, "HomeProfile": 1, ...}
  table=$(printf '%s' "$line" | sed -n 's/^"\([^"]*\)": *\([0-9]*\).*/\1/p')
  dumped=$(printf '%s' "$line" | sed -n 's/^"\([^"]*\)": *\([0-9]*\).*/\2/p')
  [ -n "$table" ] || continue

  restored=$(docker exec "$CONTAINER" \
    psql -U postgres -d restore_check -tA -c \
    "SELECT count(*) FROM \"$table\"" 2>/dev/null || echo "MISSING")

  if [ "$restored" = "MISSING" ]; then
    printf '%-18s %10s %10s %s\n' "$table" "$dumped" "$restored" "NEMA TABELE" >&2
    mismatch=1
    continue
  fi

  delta=$(( restored > dumped ? restored - dumped : dumped - restored ))
  if [ "$delta" -le "$TOLERANCE" ]; then
    printf '%-18s %10s %10s %s\n' "$table" "$dumped" "$restored" "ok" >&2
  else
    printf '%-18s %10s %10s %s\n' "$table" "$dumped" "$restored" "RAZLIKA" >&2
    mismatch=1
  fi
done < <(grep -o '"counts": *{[^}]*}' "$manifest" | sed 's/.*{//' | tr ',' '\n' | sed 's/^ *//')

if [ "$mismatch" = "1" ]; then
  log "RESTORE NIJE POTVRĐEN — dump se ne može smatrati upotrebljivim"
  exit 1
fi

log "restore-verify: PASS — dump se može vratiti i brojevi se slažu"
exit 0
