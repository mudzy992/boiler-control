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

interface AppReleaseRow {
  id: number;
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
      setSuccessVersion(row.version);
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
  const rows = releasesQuery.data ?? [];
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
