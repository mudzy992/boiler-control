# Modul: notifications

Faza 2. Datum: 2026-11-06. Ruta `/notifications`. Fioka na dashboardu koristi isti ključ `notifications`. Preference se uređuju na dashboardu, ne ovdje.

Odgovor na provjeru: lista, filter i označavanje pročitanim mogu se ponovo složiti odavde. `Card` nije importovan. `Button` je antd sa propovima lokalnog dugmeta.

## 1. Svrha i tokovi

1. Podrazumijevano se vide nepročitane, novije prvo.
2. "All" pokazuje sve, isti redoslijed.
3. Klik na nepročitano, ili dugme na kartici, šalje jednu na pročitano.
4. "Mark All Read" šalje sve. Dugme je ugašeno kad nema nepročitanih ili dok traje mutacija.

Nema brisanja. Nema uređivanja preference. Admin test endpoint nije na ovoj strani.

## 2. Struktura

| Fajl | Uloga |
|---|---|
| `features/notifications/pages/NotificationsPage.tsx` | 245 linija |
| `features/notifications/hooks/useNotifications.ts` | lista i preference |

`Card` na linijama 96 i 158 nije importovan. ESLint to javlja.

`Button` i `message` su iz `antd` (linija 8). `message` se ne koristi. ESLint: unused. Ikone su `@ant-design/icons`.

`Button` dobija `variant="primary" | "ghost"` (125, 136). To je API lokalnog dugmeta.

## 3. Tok podataka

`GET /api/notifications`. Ključ `notifications`, stale 1 min. Ako tijelo nije niz, keš je `[]` (`useNotifications.ts` 33).

`POST /api/notifications/:id/read` i `POST /api/notifications/mark-all-read`.

Poslije uspjeha invalidiraju se `notifications` i `notifications-unread-count`. Nijedan `useQuery` u `frontend/src` ne koristi `notificationsUnreadCount` kao svoj ključ. Broj nepročitanih na ovoj stranici je `filter` nad listom (60–63). Invalidacija tog ključa ne mijenja badge. Dashboard fioka čita isti niz i sama filtrira `!isRead`.

Greška mutacije ide u `console.error` (31, 44). Korisnik ne vidi poruku. `message` je importovan za tu svrhu i nije pozvan.

Preference hook postoji i ova stranica ga ne zove.

Redis nema. Nema optimističnog updatea.

## 4. UI

`isError` je engleski tekst bez `t()` i bez retry (94–99).

Loading je spinner. Prazno stanje zavisi od filtera: nema nepročitanih ili nema nijedne. Oba teksta su literali (162–167).

Podnaslov "N total" / "N unread" i dugmad Unread, All, Mark All Read, Mark as Read, Unread badge su van `t()`. Naslov jeste `t('notifications.title')`. Tipovi imaju djelimične ključeve (82–91). Nepoznat tip se prikazuje sirov.

`notif.data` se ispisuje kao JSON (227–234).

`id="content"` se poklapa sa shellom.

## 5. Pristupačnost

Kartica je `div` sa `onClick` (177–179). Nije dugme i nema tastaturu. Unutrašnje dugme ima `stopPropagation` (216–218), pa klik na njega ne okida i roditelja.

Badge "Unread" ima tekst. Broj u krugu je broj, ne samo boja.

Greška nema `role="alert"`.

## 6. Usko grlo

Cijela lista se crta. Nema paginacije u fajlu. Nije mjereno koliko notifikacija korisnik ima. Filter je na klijentu poslije punog GET-a.

N+1 nema. Poll nema. Stale 1 min i refetch na fokus (globalni default).

## 7. Kvalitet

`as AppNotification[]` u hooku. Nema `useEffect`. Nema testa stranice. `message` je mrtav import. Dva puta se može označiti ista stavka: div i dugme zovu istu mutaciju.

## 8. Rizici

- Ključ `notifications` mora ostati dijeljen sa dashboardom. Drugi ključ duplira listu.
- `mark-all-read` i `/:id/read` ostaju postojeći pozivi.
- Preference se ne premještaju ovamo u analizi. Dashboard ih već ima. Spajanje je kasniji UI posao, ne novi API.
- JSON `data` može sadržati polja koja backend stavi u payload. Prepis ne smije početi skrivati polja bez ugovora. Prikaz može biti čitljiviji, ali isti sadržaj.

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| NO-01 | `Card` nije importovan | linije 96, 158; ESLint | kritično | Error i prazno stanje pucaju | S |
| NO-02 | Antd `Button` sa `variant` | linije 8, 125, 136 | visoko | Q1 i stil | S |
| NO-03 | Greška mutacije je samo `console.error` | 31, 44 | visoko | Korisnik misli da je označeno | S |
| NO-04 | Greška liste nema retry i van je `t()` | 94–99 | srednje | Zastoj | S |
| NO-05 | Kartica nije dugme | 177–179 | srednje | Tastatura | S |
| NO-06 | Veći dio chrome teksta je literal | 120–129, 139–146, 162–167, 201, 222 | srednje | Q7 | S |
| NO-07 | `notifications-unread-count` nema čitaoca | hook invalidacija 26–28; `queryKeys.ts` 17 | nisko | Suvišan invalidate | S |

## 10. Prijedlog

shadcn `Card` i `Button`. Lista na grešci: postojeći smisao rečenice kroz `t()` i retry.

Mutacija na grešci prikazuje `role="alert"`. Uspjeh i dalje samo invalidira `notifications`. Ključ unread-count se može prestati invalidirati dok nema upita. To nije promjena API-ja.

Kartica nepročitanog je jedno dugme. Unutrašnje "Mark as Read" ostaje ako treba odvojen hit target, bez drugog poziva na click roditelja.

Filter i prazna stanja kroz `t()`. Ikone više nisu antd. Tip i dalje ima tekstualnu labelu.

JSON detalja ostaje dostupan. Ne rezati polja.

## 11. Testovi

Nema testa. Prije prepisivanja filtera:

- `showAll` false krije pročitane
- uspješan mark-read invalidira `notifications`
- pad mutacije ne mijenja `isRead` u kešu

## 12. Otvoreno

Nema novog pitanja. Preference ostaju na dashboardu dok se shell/dashboard ne prepišu.
