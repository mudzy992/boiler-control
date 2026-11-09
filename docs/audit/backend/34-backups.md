# 34 — Lokalni backup i probni restore

Datum: 2026-11-08. Odluka vlasnika: backup ide **lokalno**, na bind mount
`/mnt/shared-app-files/boiler-control` — isti disk na kojem su slike brojila i
računi, ali poseban disk na hostu.

## Šta postoji

| Dio | Fajl | Šta radi |
|---|---|---|
| Backup | `scripts/backup/backup.sh` | `pg_dump -Fc` + arhiva uploads-a → `backups/`, manifest, rotacija |
| Probni restore | `scripts/backup/restore-verify.sh` | vraća zadnji dump u privremenu bazu i poredi brojeve redova |
| Stanje u `/health` | `backend/src/common/backup-status.ts` | čita `manifest.json`; prijavljuje zastarjelost i zadnju grešku |
| Raspored | `deploy/systemd/boiler-control-backup.{service,timer}` | dnevno u 03:20 |
| Provjera | `deploy/systemd/boiler-control-restore-verify.{service,timer}` | nedjeljom u 04:10 |

Struktura na disku:

```
/mnt/shared-app-files/boiler-control/
├── <slike brojila, računi…>          # UPLOAD_ROOT_PATH u kontejneru
└── backups/
    ├── manifest.json                 # čita ga aplikacija (/health)
    ├── last-error.json               # samo kad backup padne
    ├── backup.log
    ├── db/boiler-20261108T032000Z.dump
    └── uploads/uploads-20261108T032000Z.tar.gz
```

## Zašto dump NE radi kontejner aplikacije

Produkcijska slika je `node:20-slim` i nema `pg_dump`. Dodavanje
`postgresql-client` bi vezalo verziju klijenta za sliku — a **`pg_dump` stariji
od servera ne može dumpati noviji server** (Debian bookworm daje 15; ako je
server 16 ili 17, dump pada ili, gore, prolazi sa upozorenjem). Zato dump radi
službeni `postgres:<verzija>` kontejner (`PG_IMAGE`, zadano `postgres:16`), na
istoj Docker mreži kao aplikacija (`DB_NETWORK`, zadano `db_net`).

`DATABASE_URL` se **ne kopira** u skriptu: čita se iz env-a aplikacije
(`docker exec … printenv DATABASE_URL`) i prosljeđuje kao env varijabla. Nikad se
ne ispisuje — u log ide samo ime dumpa i sha256.

## Zašto je probni restore važniji od backupa

Backup koji nikad nije vraćen nije backup, nego datoteka. `restore-verify.sh`:

1. provjeri `sha256` dumpa prema manifestu (hvata oštećenje/prepis);
2. podigne **novi** `postgres` kontejner bez volume-a (produkcija se ne dira);
3. `pg_restore` u njega;
4. poredi broj redova u `User`, `HomeProfile`, `Boiler`, `GasReading`,
   `HeatingEvent`, `DailyRecord`, `Recommendation` s brojevima zapisanim pri dumpu;
5. obriše kontejner i vrati PASS/FAIL.

Ako tabela nedostaje ili se broj ne slaže — FAIL, i dump se ne smatra
upotrebljivim.

## `/health` prijavljuje stanje

Kad je `BACKUP_DIR` postavljen (u compose-u:
`/usr/src/app/uploads/backups`), `GET /health` dobija polje `backup`:

```json
"backup": {
  "lastBackupAt": "2026-11-08T02:20:11.000Z",
  "ageHours": 9.6,
  "stale": false,
  "dumpBytes": 481234,
  "uploadsIncluded": true,
  "lastError": null
}
```

Pravila:

- `BACKUP_DIR` nije postavljen → polja **nema** (isto pravilo kao `redis`, pa se
  tijelo odgovora ne mijenja tamo gdje backup nije konfigurisan).
- nema `manifest.json` → `lastBackupAt: null`, `stale: true` („nikad nije
  napravljen" je zastarjelo, ne nepoznato).
- stariji od 36 h (`DEFAULT_MAX_AGE_HOURS`) → `stale: true`.
- `lastError` se prijavljuje **samo ako je novija** od zadnjeg uspjeha.
- **`status` ostaje `ok`.** Zastario backup ne smije izbaciti zdrav proces iz
  rotacije; readiness bi time postao laž.

## Instalacija (host)

```bash
# 1. skripte na host
sudo mkdir -p /opt/boiler-control
sudo cp -r scripts/backup /opt/boiler-control/scripts/

# 2. raspored
sudo cp deploy/systemd/boiler-control-backup.* /etc/systemd/system/
sudo cp deploy/systemd/boiler-control-restore-verify.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now boiler-control-backup.timer boiler-control-restore-verify.timer

# 3. prvi backup odmah (ne čekati 03:20)
sudo systemctl start boiler-control-backup.service
journalctl -u boiler-control-backup.service -n 30

# 4. prvi probni restore
sudo systemctl start boiler-control-restore-verify.service
journalctl -u boiler-control-restore-verify.service -n 40
```

Provjera izvana: `curl -s https://api.boiler-control.ba101.top/api/health | jq .backup`.

Coolify alternativa (ako se ne želi systemd): Coolify → Scheduled Tasks →
`/opt/boiler-control/scripts/backup/backup.sh`, dnevno. Ovdje je systemd
preporučen jer skripta koristi `docker` na hostu.

## Kako se vraća kad zatreba (RTO)

```bash
# 1. ZAUSTAVI pisanje: zaustavi backend (inače se baza mijenja pod restore-om)
docker stop boiler-control-backend

# 2. Napravi dump TRENUTNOG stanja prije restore-a — restore je nepovratan
/opt/boiler-control/scripts/backup/backup.sh

# 3. Vrati zadnji dobar dump u produkcijsku bazu
docker run --rm --network db_net -e DATABASE_URL="$(docker exec boiler-control-backend printenv DATABASE_URL)" \
  -v /mnt/shared-app-files/boiler-control/backups/db:/backup:ro postgres:16 \
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" /backup/<dump>.dump

# 4. Vrati uploads
tar -xzf /mnt/shared-app-files/boiler-control/backups/uploads/<arhiva>.tar.gz \
  -C /mnt/shared-app-files/boiler-control

# 5. Podigni backend i provjeri
docker start boiler-control-backend && curl -s .../api/health
```

## Šta ovo štiti, a šta ne

**Štiti od:** slučajnog `DELETE`, pokvarene migracije, korumpirane tabele, i
„juče je radilo".

**NE štiti od:** kvara diska, ransomware-a, krađe servera, požara. Backup je na
**istom disku** kao i podaci — jedan kvar briše i jedno i drugo. Zato:

> **Ovo nije 10/10 stanje.** Za to treba druga kopija van hosta (drugi disk,
> S3/B2, ili barem `rsync` na drugu mašinu). Dok to ne postoji, backup pokriva
> najčešći scenario (ljudska greška), ali ne najgori (gubitak diska).

## Šta nije provjereno

- Skripte su testirane sa **lažnim `docker`-om** (stub): manifest, brojevi,
  rotacija (3 pokretanja → 2 dumpa uz `KEEP_COUNT=2`), i putanja greške
  (`last-error.json` + `exit 1`). **Nijedan `pg_dump`/`pg_restore` nije stvarno
  izvršen** — u sandboxu nema Docker-a ni Postgres-a.
- `systemd` jedinice nisu pokrenute; sintaksa nije provjerena `systemd-analyze`.
- `/health` polje `backup` nije viđeno na živom API-ju.
- Engrami: `pg_dump`/`pg_restore` u `postgres:16` slici; ako je produkcijski
  server 17+, `PG_IMAGE` mora biti `postgres:17`.
