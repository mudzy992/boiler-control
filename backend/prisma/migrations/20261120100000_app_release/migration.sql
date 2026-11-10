-- F15 (admin objavljuje verziju, app skida sa našeg servera): tabela release-a.
--
-- Zašto tabela, a ne env var: do sada je `latestVersion` bio konstanta
-- (`2.0.0`) u `app-config.service.ts`, pa je svaka nova verzija aplikacije
-- tražila redeploy backend-a. Sada admin kroz dashboard ubaci APK i objavi
-- verziju, a `GET /api/app/config` je čita iz baze.
--
-- Zašto `version` UNIQUE: ista verzija se ne objavljuje dvaput. Ako je build
-- pokvaren, objavljuje se nova verzija — prepisivanje bi ostavilo korisnike sa
-- linkom na fajl koji nije onaj koji su skinuli.
--
-- `apkPath` je relativna putanja u `UPLOAD_ROOT_PATH` (npr.
-- `app-releases/boiler-control-1.4.0-14.apk`), ne apsolutna: kontejner i host
-- vide isti volumen pod različitim korijenom, pa apsolutna putanja ne bi
-- preživjela `docker compose up` na drugoj mašini.
--
-- Aditivno: nova tabela, nijedna postojeća kolona se ne mijenja. Nijedan
-- klijent ne čita `AppRelease` dok ne postoji objavljen release — do tada
-- `/api/app/config` vraća zatečene vrijednosti iz env-a.
--
-- Rollback: DROP TABLE "AppRelease"; (APK fajlovi na disku ostaju, ali ih
-- niko ne referencira — sigurno ih je obrisati ručno iz `app-releases/`.)

CREATE TABLE "AppRelease" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "buildNumber" INTEGER NOT NULL,
    "apkPath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "notes" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppRelease_version_key" ON "AppRelease"("version");
CREATE INDEX "AppRelease_publishedAt_idx" ON "AppRelease"("publishedAt");
