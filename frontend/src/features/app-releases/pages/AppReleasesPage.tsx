import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { apiClient } from "@/services/api";
import { PageHeader } from "@/shared/components/page-header";
import { QueryState } from "@/shared/components/query-state";
import { Button } from "@/shared/components/ui/Button";
import { Card, CardContent } from "@/shared/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/ui";

/**
 * `F15`: admin objavljuje novu verziju mobilne aplikacije.
 *
 * Tri stvari koje ekran ne smije raditi:
 *
 * 1. **Ne izmišlja verziju.** Polje se popunjava onim što server pročita iz
 *    `assets/app.config` u APK-u; ako čitanje ne uspije, admin je unosi ručno i
 *    to mora biti očigledno iz forme (poruka uz polje).
 * 2. **Ne dozvoljava istu ili manju verziju.** Server to odbija (`409`), a
 *    forma isti tekst prikazuje prije nego što se 200 MB pošalje.
 * 3. **Ne tvrdi da je upload prošao prije odgovora servera.** Stanje dugmeta
 *    prati `mutation.isPending`, a uspjeh se prikazuje tek sa servera.
 */

type ReleasePlatform = "PHONE" | "TV";

interface AppReleaseRow {
  id: number;
  /**
   * Kojoj aplikaciji izdanje pripada. Do F17 ovo polje nije postojalo, pa je
   * TV APK iste verzije kao mobilni padao na jedinstvenom `version`. Sada su
   * izdanja odvojena, a tabela mora da **pokaže** koja je koja — bez toga dvije
   * iste verzije izgledaju kao duplikat.
   */
  platform: ReleasePlatform;
  version: string;
  buildNumber: number;
  sizeBytes: number;
  notes: string | null;
  isPublished: boolean;
  publishedAt: string;
  downloadUrl: string;
}

const RELEASES_QUERY_KEY = ["app-releases"] as const;

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AppReleasesPage = (): JSX.Element => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  /*
   * Platforma je eksplicitna u formi, sa `PHONE` kao početnom vrijednošću —
   * ne zato što je vjerovatnija, nego zato što se vidi i može promijeniti.
   * Server odbija upload bez platforme, pa se ne može desiti da TV APK tiho
   * prođe kao mobilni.
   */
  const [platform, setPlatform] = useState<ReleasePlatform>("PHONE");
  const [filter, setFilter] = useState<ReleasePlatform | "ALL">("ALL");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successVersion, setSuccessVersion] = useState<string | null>(null);

  const releasesQuery = useQuery({
    queryKey: RELEASES_QUERY_KEY,
    queryFn: () => apiClient.get<AppReleaseRow[]>("/app-releases"),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t("appReleases.errorNoFile"));

      const form = new FormData();
      form.append("apk", file);
      // Platforma je OBAVEZNA: server odbija upload bez nje umjesto da
      // pretpostavi mobilni — pogrešna pretpostavka bi TV APK tiho upisala
      // kao mobilni release.
      form.append("platform", platform);
      if (version.trim()) form.append("version", version.trim());
      if (notes.trim()) form.append("notes", notes.trim());

      // `upload()` je jedini put koji ne prolazi kroz JSON instancu — v.
      // `api.ts`. Isti poziv kroz `post()` bio je uzrok `400 "Nedostaje APK
      // fajl"`: instanca pretvori `FormData` u JSON i fajl nestane.
      return apiClient.upload<AppReleaseRow>("/app-releases", form);
    },
    onSuccess: (row) => {
      setFile(null);
      setVersion("");
      setNotes("");
      setFormError(null);
      setSuccessVersion(
        `${row.version} (${row.platform === "TV" ? "TV" : "mobilni"})`,
      );
      void queryClient.invalidateQueries({ queryKey: RELEASES_QUERY_KEY });
    },
    onError: (error) => {
      // Poruka servera je konkretna („verzija nije veća od…"), pa se prikazuje
      // ona — generički tekst bi sakrio jedini podatak koji admin treba.
      setSuccessVersion(null);
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : t("appReleases.errorGeneric"),
      );
    },
  });

  const publishMutation = useMutation({
    mutationFn: (input: { id: number; isPublished: boolean }) =>
      apiClient.patch<AppReleaseRow>(`/app-releases/${input.id}/published`, {
        isPublished: input.isPublished,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RELEASES_QUERY_KEY });
    },
  });

  /*
   * `file` je jedini uslov za upload. Stanje se prikazuje tekstom, a ne samo
   * kroz `disabled` na dugmetu — korisnik koji odabere datoteku mora vidjeti
   * da je stvarno primljena (ime i veličina), a ne da nagađa zašto dugme ne radi.
   */
  const allRows = releasesQuery.data ?? [];
  const rows =
    filter === "ALL"
      ? allRows
      : allRows.filter((row) => row.platform === filter);
  const status = releasesQuery.isLoading
    ? "loading"
    : releasesQuery.isError
      ? "error"
      : rows.length === 0
        ? "empty"
        : "success";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("appReleases.title")}
        description={t("appReleases.subtitle")}
      />

      <Card>
        <CardContent className="space-y-4 pt-4">
          {/*
            Platforma je PRVA kontrola, prije fajla. Razlog: ona određuje šta
            „nova verzija" znači (poređenje je unutar platforme), pa admin mora
            izabrati aplikaciju prije nego što izabere APK — inače se dešava da
            se TV APK pošalje kao mobilni i tiho prođe ako je verzija veća.
          */}
          <fieldset className="space-y-1">
            <legend className="block text-sm font-medium text-ink">
              {t("appReleases.platformLabel")}
            </legend>
            <div className="flex gap-4">
              {(["PHONE", "TV"] as const).map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-ink"
                >
                  <input
                    type="radio"
                    name="app-release-platform"
                    value={value}
                    checked={platform === value}
                    onChange={() => setPlatform(value)}
                    disabled={uploadMutation.isPending}
                  />
                  {value === "TV"
                    ? t("appReleases.platformTv")
                    : t("appReleases.platformPhone")}
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-dim">
              {t("appReleases.platformHint")}
            </p>
          </fieldset>

          <div className="space-y-1">
            <label
              htmlFor="app-release-apk"
              className="block text-sm font-medium text-ink"
            >
              {t("appReleases.fileLabel")}
            </label>
            <input
              id="app-release-apk"
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setSuccessVersion(null);
                setFormError(null);
              }}
              disabled={uploadMutation.isPending}
              className="block w-full text-sm text-ink-muted"
            />
            <p className="text-xs text-ink-dim">
              {t("appReleases.versionHint")}
            </p>
            {/*
              Potvrda izbora. Bez nje se „Choose file" ponaša kao crna kutija:
              browser ne pokaže uvijek ime fajla (a `.apk` se uz to često ne
              prepoznaje), pa korisnik ne zna je li datoteka uopšte primljena.
            */}
            <p
              className={file ? "text-xs text-ok" : "text-xs text-warn"}
              data-testid="app-release-file-state"
            >
              {file
                ? t("appReleases.fileSelected", {
                    name: file.name,
                    size: formatSize(file.size),
                  })
                : t("appReleases.fileNotSelected")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="app-release-version"
                className="block text-sm font-medium text-ink"
              >
                {t("appReleases.versionLabel")}
              </label>
              <input
                id="app-release-version"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="1.4.0"
                inputMode="numeric"
                disabled={uploadMutation.isPending}
                className="w-full rounded border border-line bg-raised px-3 py-2 text-sm text-ink"
              />
              <p className="text-xs text-ink-dim">
                {t("appReleases.versionManualHint")}
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="app-release-notes"
                className="block text-sm font-medium text-ink"
              >
                {t("appReleases.notesLabel")}
              </label>
              <input
                id="app-release-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("appReleases.notesPlaceholder")}
                disabled={uploadMutation.isPending}
                className="w-full rounded border border-line bg-raised px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-fault">
              {formError}
            </p>
          ) : null}

          {successVersion ? (
            <p role="status" className="text-sm text-ok">
              {t("appReleases.success", { version: successVersion })}
            </p>
          ) : null}

          <Button
            onClick={() => {
              setFormError(null);
              uploadMutation.mutate();
            }}
            disabled={!file || uploadMutation.isPending}
          >
            {uploadMutation.isPending
              ? t("appReleases.uploading")
              : t("appReleases.upload")}
          </Button>
        </CardContent>
      </Card>

      {/*
        Filter postoji jer se poslije F17 u istoj tabeli nalaze dvije aplikacije
        sa nezavisnim brojevima. Bez filtera lista izgleda kao da verzije
        skaču naprijed-nazad (2.0.0, 1.0.0, 1.9.0, 1.0.0 …).
      */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-muted">
          {t("appReleases.filterLabel")}
        </span>
        {(["ALL", "PHONE", "TV"] as const).map((value) => (
          <Button
            key={value}
            variant={filter === value ? "primary" : "ghost"}
            onClick={() => setFilter(value)}
          >
            {value === "ALL"
              ? t("appReleases.filterAll")
              : value === "TV"
                ? t("appReleases.platformTv")
                : t("appReleases.platformPhone")}
          </Button>
        ))}
      </div>

      <QueryState
        status={status}
        onRetry={() => {
          void releasesQuery.refetch();
        }}
        emptyMessage={t("appReleases.empty")}
      >
        <Card>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("appReleases.colPlatform")}</TableHead>
                  <TableHead>{t("appReleases.colVersion")}</TableHead>
                  <TableHead>{t("appReleases.colBuild")}</TableHead>
                  <TableHead>{t("appReleases.colSize")}</TableHead>
                  <TableHead>{t("appReleases.colPublished")}</TableHead>
                  <TableHead>{t("appReleases.colState")}</TableHead>
                  <TableHead>{t("appReleases.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge tone={row.platform === "TV" ? "info" : "muted"}>
                        {row.platform === "TV"
                          ? t("appReleases.platformTv")
                          : t("appReleases.platformPhone")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.version}
                      {row.notes ? (
                        <span className="block text-xs text-ink-dim">
                          {row.notes}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.buildNumber}</TableCell>
                    <TableCell>{formatSize(row.sizeBytes)}</TableCell>
                    <TableCell>
                      {dayjs(row.publishedAt).format("DD.MM.YYYY HH:mm")}
                    </TableCell>
                    <TableCell>
                      {row.isPublished ? (
                        <Badge tone="ok">
                          {t("appReleases.statePublished")}
                        </Badge>
                      ) : (
                        <Badge tone="muted">
                          {t("appReleases.stateHidden")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          publishMutation.mutate({
                            id: row.id,
                            isPublished: !row.isPublished,
                          })
                        }
                        disabled={publishMutation.isPending}
                      >
                        {row.isPublished
                          ? t("appReleases.hide")
                          : t("appReleases.show")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </QueryState>

      {/*
        `F15`: „Povuci" nije brisanje i nije skrivanje iz historije — povlači
        ponudu korisnicima. Bez ovog teksta admin ne može znati da li je
        povlačenje trajno, pa se pravilo piše uz tabelu, a ne u dokumentaciji.
      */}
      <p className="text-xs text-ink-dim">{t("appReleases.hideHint")}</p>
    </div>
  );
};
