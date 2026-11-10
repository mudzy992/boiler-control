import type { JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import { queryKeys } from "@/lib/queryKeys";
import { DEFAULT_FLOW_RANGE, resolveFlowRange } from "@/constants/boilerLimits";
import { Bell, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/shared/components/page-header";
import { QueryState } from "@/shared/components/query-state";
import { StatusBanner } from "@/shared/components/status-banner";
import { TempDialog } from "@/shared/components/temp-dialog";
import { Button } from "@/shared/components/ui/Button";
import { RecommendationBreakdown } from "../../heating/components/RecommendationBreakdown";
import { DashboardAlerts } from "../components/dashboard-alerts";
import { DashboardEventsPanel } from "../components/dashboard-events-panel";
import { DashboardKpiRow } from "../components/dashboard-kpi-row";
import { DashboardNotificationsSheet } from "../components/dashboard-notifications-sheet";
import { DashboardPrefsSheet } from "../components/dashboard-prefs-sheet";
import { DashboardSchedule } from "../components/dashboard-schedule";
import { DashboardStatusBand } from "../components/dashboard-status-band";
import { DashboardSystemCards } from "../components/dashboard-system-cards";
import { useDashboardPage } from "../hooks/use-dashboard-page";

export const DashboardPage = (): JSX.Element => {
  const { t } = useTranslation();
  const d = useDashboardPage();

  /*
   * `F13`: raspon polazne je po domu, pa se pita server. Rezervni 46–55 važi
   * dok odgovor ne stigne; `staleTime` je dug jer se granice mijenjaju samo
   * kad vlasnik izmijeni profil doma.
   */
  const flowRangeQuery = useQuery({
    queryKey: queryKeys.boilerFlowRange,
    queryFn: () => apiClient.getBoilerFlowRange(),
    staleTime: 1000 * 60 * 30,
  });
  const flowRange = resolveFlowRange(flowRangeQuery.data ?? DEFAULT_FLOW_RANGE);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.overview")}
        action={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => d.setNotifOpen(true)}
            >
              <Bell className="h-4 w-4" aria-hidden />
              {t("notifications.title")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => d.setPrefsOpen(true)}
            >
              <Settings className="h-4 w-4" aria-hidden />
              {t("notifications.preferences")}
            </Button>
          </>
        }
      />
      {d.tempSaved ? (
        <StatusBanner
          variant="success"
          message={t("dashboard.tempUpdated")}
          onDismiss={() => d.setTempSaved(false)}
          dismissLabel={t("common.dismiss")}
        />
      ) : null}
      <QueryState
        status={d.status}
        emptyMessage={t("dashboard.noData")}
        onRetry={d.refetchDashboard}
      >
        {d.data ? (
          <>
            <DashboardStatusBand
              isHeatingActive={d.isHeatingActive}
              roomCurrentTemp={d.data.roomCurrentTemp}
              roomTargetTemp={d.data.roomTargetTemp}
              expectedHeatTimeMin={d.expectedHeatTimeMin}
              heatingStartedAt={d.heatingStartedAt}
              onSetTemp={d.openSetTemp}
            />
            <DashboardKpiRow
              healthScore={d.healthScore}
              anomalyRate={d.data.anomalyRate}
            />
            <DashboardSystemCards
              weather={d.weatherDisplay}
              boiler={d.data.boiler}
              onSetTemp={d.openSetTemp}
            />
            <RecommendationBreakdown
              breakdown={d.data.recommendation?.breakdown}
            />
            <DashboardAlerts warnings={d.warnings} />
            <DashboardSchedule
              scheduleByDay={d.scheduleByDay}
              activeProgram={d.activeProgram}
            />
            <DashboardEventsPanel
              from={d.fromDate}
              to={d.toDate}
              onFromChange={d.setFromDate}
              onToChange={d.setToDate}
              summaryMetrics={d.summaryMetrics}
              buckets={d.buckets}
              events={d.eventsWithBucket}
              activeBucket={d.activeBucket}
              onActiveBucketChange={d.setActiveBucket}
            />
          </>
        ) : null}
      </QueryState>
      <DashboardNotificationsSheet
        open={d.notifOpen}
        onOpenChange={d.setNotifOpen}
        loading={d.notificationsLoading}
        isError={d.notificationsError}
        onRetry={d.refetchNotifications}
        notifications={d.unread}
        onMarkAsRead={(id) => void d.handleMarkRead(id)}
      />
      <DashboardPrefsSheet
        open={d.prefsOpen}
        onOpenChange={d.setPrefsOpen}
        loading={d.prefsLoading}
        isError={d.prefsError}
        onRetry={d.refetchPrefs}
        preferences={d.prefs}
        onToggle={(type, enabled) => void d.handlePrefToggle(type, enabled)}
      />
      <TempDialog
        open={d.tempOpen}
        onOpenChange={d.setTempOpen}
        initialValue={d.tempValue}
        onSubmit={d.submitSetTemp}
        isSubmitting={d.tempSubmitting}
        range={flowRange}
      />
    </div>
  );
};
