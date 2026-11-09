#!/usr/bin/env bash
#
# Lokalni backup: Postgres dump + uploads arhiva → bind mount na hostu.
#
# POKREĆE SE NA HOSTU (ne u kontejneru), jer:
#   - kontejner aplikacije je `node:20-slim` i nema `pg_dump`;
#   - dodavanje `postgresql-client` u produkcijsku sliku bi vezalo verziju
#     klijenta za sliku, a `pg_dump` stariji od servera **ne može** dumpati
#     noviji server. Zato dump radi službeni `postgres:<verzija>` kontejner.
#
# Tajne se ne kopiraju u ovaj fajl: `DATABASE_URL` se čita iz env-a aplikacije
# (`docker exec … printenv`) i prosljeđuje kao env varijabla kontejneru za dump.
# Nikad se ne ispisuje.
#
# Primjer (cron / systemd timer):
#   /opt/boiler-control/scripts/backup/backup.sh
#
# Provjera restore-a (obavezno, povremeno):
#   /opt/boiler-control/scripts/backup/restore-verify.sh
set -Eeuo pipefail

# --- podešavanja (sve se može prebrisati iz okoline) ------------------------
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/shared-app-files/boiler-control}"
BACKUP_DIR="${BACKUP_DIR:-$BACKUP_ROOT/backups}"
APP_CONTAINER="${APP_CONTAINER:-boiler-control-backend}"
PG_IMAGE="${PG_IMAGE:-postgres:16}"
DB_NETWORK="${DB_NETWORK:-db_net}"
KEEP_COUNT="${KEEP_COUNT:-30}"        # koliko dumpova/arhiva ostaje
KEEP_DAYS="${KEEP_DAYS:-90}"          # i najviše koliko dana
MIN_FREE_MB="${MIN_FREE_MB:-512}"     # ne dumpaj ako nema mjesta
INCLUDE_UPLOADS="${INCLUDE_UPLOADS:-1}"
# Tabele koje se broje pri dumpu; restore-verify poredi s tim brojevima.
COUNT_TABLES="${COUNT_TABLES:-User HomeProfile Boiler GasReading HeatingEvent DailyRecord Recommendation}"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
db_dir="$BACKUP_DIR/db"
uploads_dir="$BACKUP_DIR/uploads"
log_file="$BACKUP_DIR/backup.log"
manifest="$BACKUP_DIR/manifest.json"
error_file="$BACKUP_DIR/last-error.json"

log() { printf '%s  %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$log_file" >&2; }

fail() {
  local message="$1"
  printf '{"failedAt":"%s","message":"%s"}\n' \
    "$(date -u +%FT%TZ)" "${message//\"/\'}" > "$error_file"
  log "GREŠKA: $message"
  exit 1
}

trap 'fail "prekinuto u liniji $LINENO ($BASH_COMMAND)"' ERR

# --- 1. preflight -----------------------------------------------------------
command -v docker >/dev/null || fail "docker nije dostupan na hostu"
docker inspect -f '{{.State.Running}}' "$APP_CONTAINER" 2>/dev/null | grep -q true \
  || fail "kontejner $APP_CONTAINER ne radi"

mkdir -p "$db_dir" "$uploads_dir" || fail "ne mogu napraviti $BACKUP_DIR"
[ -w "$BACKUP_DIR" ] || fail "$BACKUP_DIR nije upisiv"

free_mb=$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')
[ "${free_mb:-0}" -ge "$MIN_FREE_MB" ] \
  || fail "malo mjesta: ${free_mb}MB < ${MIN_FREE_MB}MB"

# `flock` sprječava dva paralelna dumpa (cron + ručno pokretanje).
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || fail "backup već radi (lock drži drugi proces)"

# --- 2. konekcija -----------------------------------------------------------
# Tajna ostaje u varijabli; `set -x` nije uključen, a `log` je ne prima.
DATABASE_URL_FOR_DUMP="$(docker exec "$APP_CONTAINER" printenv DATABASE_URL 2>/dev/null || true)"
[ -n "${DATABASE_URL_FOR_DUMP}" ] || fail "DATABASE_URL nije nađen u env-u $APP_CONTAINER"

log "počinjem: dump → $db_dir"

dump_name="boiler-$ts.dump"
# `-Fc` (custom format): kompresija, selektivni restore i provjera sadržaja bez
# punog restore-a (`pg_restore --list`).
docker run --rm \
  --network "$DB_NETWORK" \
  -e DATABASE_URL="$DATABASE_URL_FOR_DUMP" \
  -v "$db_dir:/backup" \
  "$PG_IMAGE" \
  pg_dump --format=custom --no-owner --no-privileges --compress=9 \
    --file="/backup/$dump_name" "$DATABASE_URL_FOR_DUMP" \
  >>"$log_file" 2>&1 || fail "pg_dump nije uspio"

dump_path="$db_dir/$dump_name"
[ -s "$dump_path" ] || fail "dump je prazan: $dump_path"

# --- 3. provjera dumpa ------------------------------------------------------
# Dump koji se ne može pročitati nije backup. Ovo je najjeftinija provjera koja
# hvata prekinut transfer i praznu bazu.
table_data_lines=$(docker run --rm -v "$db_dir:/backup:ro" "$PG_IMAGE" \
  pg_restore --list "/backup/$dump_name" 2>>"$log_file" | grep -c 'TABLE DATA' || true)
[ "${table_data_lines:-0}" -gt 0 ] || fail "dump ne sadrži nijednu 'TABLE DATA' stavku"

# --- 4. brojevi redova (za restore-verify) ---------------------------------
counts_json="$(
  docker run --rm --network "$DB_NETWORK" \
    -e DATABASE_URL="$DATABASE_URL_FOR_DUMP" \
    -e TABLES="$COUNT_TABLES" \
    "$PG_IMAGE" \
    psql "$DATABASE_URL_FOR_DUMP" -tA -F'|' -c "
      SELECT t, (xpath('/row/c/text()',
               query_to_xml(format('SELECT count(*) AS c FROM %I', t), false, true, '')))[1]::text
      FROM unnest(string_to_array(current_setting('tables'), ' ')) AS t" \
    2>>"$log_file" || true
)"
[ -n "$counts_json" ] || fail "brojanje redova nije uspjelo"

# --- 5. uploads (slike brojila, računi) -------------------------------------
uploads_name=""
if [ "$INCLUDE_UPLOADS" = "1" ]; then
  uploads_name="uploads-$ts.tar.gz"
  # `--exclude=backups` jer je ovaj direktorij UNUTAR uploads stabla; bez toga
  # bi backup arhivirao sam sebe i rastao svakim danom.
  tar -czf "$uploads_dir/$uploads_name" -C "$BACKUP_ROOT" \
    --exclude=backups . >>"$log_file" 2>&1 || fail "arhiviranje uploads nije uspjelo"
  log "uploads: $uploads_name ($(du -h "$uploads_dir/$uploads_name" | cut -f1))"
fi

# --- 6. manifest ------------------------------------------------------------
# Manifest je jedini fajl koji čita aplikacija (`/health`), pa se piše atomski:
# djelimično napisan JSON bi health učinio „neispravnim" bez razloga.
sha=$(sha256sum "$dump_path" | cut -d' ' -f1)
size=$(stat -c%s "$dump_path")
tmp="$manifest.tmp"
{
  printf '{\n'
  printf '  "createdAt": "%s",\n' "$(date -u +%FT%TZ)"
  printf '  "dump": "%s",\n' "$dump_name"
  printf '  "dumpBytes": %s,\n' "$size"
  printf '  "dumpSha256": "%s",\n' "$sha"
  printf '  "archiveTables": %s,\n' "$table_data_lines"
  if [ -n "$uploads_name" ]; then
    printf '  "uploads": "%s",\n' "$uploads_name"
    printf '  "uploadsBytes": %s,\n' "$(stat -c%s "$uploads_dir/$uploads_name")"
  else
    printf '  "uploads": null,\n'
  fi
  printf '  "counts": {%s}\n' "$(printf '%s' "$counts_json" | awk -F'|' '
      BEGIN { first = 1 }
      { if (!first) printf ", "; first = 0; printf "\"%s\": %s", $1, $2 }
    ')"
  printf '}\n'
} > "$tmp"
mv "$tmp" "$manifest"

rm -f "$error_file"
log "gotovo: $dump_name ($((size / 1024))KB), $table_data_lines tabela sa podacima, sha256 ${sha:0:12}…"

# --- 7. rotacija ------------------------------------------------------------
# Dva kriterija: broj (KEEP_COUNT) i starost (KEEP_DAYS). Samo broj bi kod
# dugog zastoja (backup ne radi mjesec dana) zadržao sve stare, a samo starost
# bi kod čestog pokretanja napunila disk.
prune() {
  local dir="$1"
  local keep="$2"
  find "$dir" -maxdepth 1 -type f -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn \
    | awk -v keep="$keep" 'NR > keep { sub(/^[^ ]+ /, ""); print }' \
    | while read -r f; do log "rotation: brišem $(basename "$f")"; rm -f "$f"; done
  find "$dir" -maxdepth 1 -type f -mtime "+$KEEP_DAYS" -print 2>/dev/null \
    | while read -r f; do log "rotation (>${KEEP_DAYS}d): brišem $(basename "$f")"; rm -f "$f"; done
}

prune "$db_dir" "$KEEP_COUNT"
[ "$INCLUDE_UPLOADS" = "1" ] && prune "$uploads_dir" "$KEEP_COUNT"

exit 0
