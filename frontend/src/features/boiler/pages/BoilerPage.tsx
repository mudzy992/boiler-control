import { useCallback, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageHeader } from "@/shared/components/page-header";
import { QueryState } from "@/shared/components/query-state";
import { TempDialog } from "@/shared/components/temp-dialog";
import { DEFAULT_FLOW_RANGE, resolveFlowRange } from "@/constants/boilerLimits";
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
import { invalidateQueriesAfterTempSet } from "@/shared/lib/invalidate-after-temp-set";
import { DeltaChip } from "../components/delta-chip";

interface BoilerEvent {
  id: number;
  externalTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number | null;
  heatingStart: string | null;
  heatingEnd: string | null;
  createdAt: string;
}

export const BoilerPage = (): JSX.Element => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tempOpen, setTempOpen] = useState(false);
  const [tempInitial, setTempInitial] = useState<number | null>(null);
  const [tempSubmitting, setTempSubmitting] = useState(false);

  // `F13`: granica je po domu — ista forma na dva doma mora vidjeti dva raspona.
  const flowRangeQuery = useQuery({
    queryKey: queryKeys.boilerFlowRange,
    queryFn: () => apiClient.getBoilerFlowRange(),
    staleTime: 1000 * 60 * 30,
  });
  const flowRange = resolveFlowRange(flowRangeQuery.data ?? DEFAULT_FLOW_RANGE);

  const eventsQuery = useQuery({
    queryKey: queryKeys.boilerEvents,
    queryFn: async (): Promise<BoilerEvent[]> => {
      const data = await apiClient.getBoilerEvents();
      return Array.isArray(data) ? data : (data?.events ?? []);
    },
  });

  const events = eventsQuery.data ?? [];
  const status = eventsQuery.isLoading
    ? "loading"
    : eventsQuery.isError
      ? "error"
      : events.length === 0
        ? "empty"
        : "success";

  const handleOpenTemp = useCallback(() => {
    const latest = events[0];
    const fallback =
      typeof latest?.actualFlowTemp === "number"
        ? latest.actualFlowTemp
        : (latest?.suggestedFlowTemp ?? 52);
    setTempInitial(Number(fallback.toFixed(1)));
    setTempOpen(true);
  }, [events]);

  const handleSubmitTemp = useCallback(
    async (value: number) => {
      try {
        setTempSubmitting(true);
        await apiClient.setBoilerCurrentTemp(value);
        setTempOpen(false);
        await invalidateQueriesAfterTempSet(queryClient);
      } catch (error) {
        console.error("Failed to set boiler current temp:", error);
      } finally {
        setTempSubmitting(false);
      }
    },
    [queryClient],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.boiler")}
        description={t("boiler.subtitle")}
        action={
          <Button type="button" onClick={handleOpenTemp}>
            {t("boiler.setCurrentTemp")}
          </Button>
        }
      />
      <QueryState
        status={status}
        onRetry={() => {
          void eventsQuery.refetch();
        }}
        emptyMessage={t("boiler.empty")}
        emptyAction={
          <Button type="button" variant="outline" onClick={handleOpenTemp}>
            {t("boiler.setCurrentTemp")}
          </Button>
        }
      >
        <Card>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("boiler.colCreated")}</TableHead>
                  <TableHead>{t("boiler.colExternal")}</TableHead>
                  <TableHead>{t("boiler.colSuggested")}</TableHead>
                  <TableHead>{t("boiler.colActual")}</TableHead>
                  <TableHead>{t("boiler.colDelta")}</TableHead>
                  <TableHead>{t("boiler.colStart")}</TableHead>
                  <TableHead>{t("boiler.colEnd")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const delta =
                    typeof event.actualFlowTemp === "number"
                      ? event.actualFlowTemp - event.suggestedFlowTemp
                      : null;
                  return (
                    <TableRow key={event.id}>
                      <TableCell>
                        {new Date(event.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{event.externalTemp.toFixed(1)}°C</TableCell>
                      <TableCell>
                        {event.suggestedFlowTemp.toFixed(1)}°C
                      </TableCell>
                      <TableCell>
                        {typeof event.actualFlowTemp === "number"
                          ? `${event.actualFlowTemp.toFixed(1)}°C`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {delta === null ? "—" : <DeltaChip delta={delta} />}
                      </TableCell>
                      <TableCell>
                        {event.heatingStart
                          ? new Date(event.heatingStart).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {event.heatingEnd
                          ? new Date(event.heatingEnd).toLocaleString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </QueryState>
      <TempDialog
        open={tempOpen}
        onOpenChange={setTempOpen}
        initialValue={tempInitial}
        onSubmit={handleSubmitTemp}
        isSubmitting={tempSubmitting}
        range={flowRange}
      />
    </div>
  );
};

BoilerPage.displayName = "BoilerPage";
