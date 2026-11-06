# Odluka o pristupu implementaciji

Faza 4. Datum: 2026-11-06. Status: **preporuka A — čeka GATE 3 odobrenje**.

## Opcija A — Inkrementalno na `main` (preporučeno)

Novi temelji, pa migracija stranica na istom stablu. Red: I0 tokeni → I1 auth → I2 shell → I3 shadcn primitiv → I4 stanja → I5 dijalog → I6 stranice → I7 uklanjanje antd.

| | |
|---|---|
| Prednosti | Rano zeleni CI; mali diffovi; antd nestaje postepeno; usklađeno sa Q3 rewrite shell/dashboard |
| Mane | Privremeno dva UI jezika (lokalni set + shadcn) dok I7 ne završi |
| Rizik | Srednji — jedna podfaza može pokvariti rutu, ali rollback je jedan commit |
| Trud | M–L ukupno; po podfazi S–M |

## Opcija B — Feature flag `v2` layout

Paralelni shell iza flaga; stare rute ostaju na antd dok se ne prebace.

| | |
|---|---|
| Prednosti | Brzi vizuelni preview bez diranja starih ruta |
| Mane | Dupli layout, dupli meni, sporije uklanjanje antd; flag dug živi |
| Rizik | Visok kompleksnost održavanja |
| Trud | L+ |

## Opcija C — Big-bang rewrite u jednoj grani

Cijeli frontend u jednom PR-u.

| | |
|---|---|
| Prednosti | Čist krajnji rezultat |
| Mane | Dug crveni CI ili ogromni review; operativni rizik |
| Rizik | Visok |
| Trud | L |

## Odluka

**Biramo A.**

Razlozi:

1. Q3 već nalaže rewrite shella i dashboarda, ne feature-flag paralelizam.
2. Frontend CI na `main` je dogovoreni signal; A daje commit po podfazi + `gh run watch`.
3. Sinteza zavisnosti (`04`) mapira se direktno na I0–I7.
4. B i C odgađaju uklanjanje antd-a ili povećavaju rizik bez koristi za ovaj opseg.

Alternativa B se ne aktivira osim ako GATE 3 eksplicitno zatraži flag.
