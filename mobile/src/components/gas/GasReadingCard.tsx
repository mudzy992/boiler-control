import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';

import { useTranslation } from '../../hooks/useTranslation';
import { useTokens } from '../../ui/theme';
import { Led, MonoMeta, Pressable, Readout, Sheet, Text } from '../../ui';
import { space } from '../../theme/tokens';
import { formatNumber, formatShortDate, formatTime } from '../../utils/format';

/**
 * Red očitanja (prototip §04).
 *
 * Prije: kartica sa ikonom plamena, dva reda datuma/vremena, obojena
 * „POTROŠNJA" kutija i četiri pune boje značaka (REFERENCA / SLIKA / RAČUN),
 * plus „…" dugme bez ikakve afordance. Tri očitanja su trošila ~460px.
 *
 * Sada: jedan red — brojač u mono brojevima, pa datum · izvedena dnevna
 * potrošnja i cijena desno. Značke su outline; signalna boja ide samo na REF,
 * jer je to jedina oznaka koja nosi odluku. Akcije se otvaraju dodirom na red.
 */

interface GasReading {
  id: number;
  userId: number;
  counterValue: number;
  readingDate: string;
  createdAt: string;
  isInvoiceReference?: boolean;
  referenceMonth?: string | null;
  hasMeterImage?: boolean;
  hasInvoicePdf?: boolean;
  invoiceUploadedAt?: string | null;
}

interface GasReadingCardProps {
  reading: GasReading;
  previousReading?: GasReading;
  onDelete?: (id: number) => void;
  onToggleReference?: (reading: GasReading, isReference: boolean) => void;
  onUploadMeterImage?: (reading: GasReading) => void;
  onUploadInvoice?: (reading: GasReading) => void;
  onDeleteInvoice?: (reading: GasReading) => void;
  onOpenMeterImage?: (reading: GasReading) => void;
  onOpenInvoice?: (reading: GasReading) => void;
  isDeleting?: boolean;
  isMutating?: boolean;
  /** Cijena m³ sa PDV-om, kad je poznata — prikazuje se desno. */
  pricePerM3?: number | null;
}

export const GasReadingCard = React.memo(function GasReadingCard({
  reading,
  previousReading,
  onDelete,
  onToggleReference,
  onUploadMeterImage,
  onUploadInvoice,
  onDeleteInvoice,
  onOpenMeterImage,
  onOpenInvoice,
  isDeleting,
  isMutating,
  pricePerM3,
}: GasReadingCardProps) {
  const { t } = useTranslation();
  const { t: tokens } = useTokens();
  const [showActions, setShowActions] = useState(false);

  const consumption =
    previousReading && previousReading.counterValue >= reading.counterValue
      ? previousReading.counterValue - reading.counterValue
      : null;

  const daysDiff =
    previousReading && dayjs(previousReading.readingDate).isAfter(reading.readingDate)
      ? dayjs(previousReading.readingDate).diff(dayjs(reading.readingDate), 'day')
      : null;

  const dailyConsumption =
    consumption !== null && daysDiff && daysDiff > 0 ? consumption / daysDiff : null;

  const cost = pricePerM3 && consumption !== null ? consumption * pricePerM3 : null;
  const isBusy = Boolean(isDeleting || isMutating);

  const runAction = (action?: () => void) => {
    setShowActions(false);
    if (!action || isBusy) return;
    requestAnimationFrame(() => action());
  };

  const badges: { label: string; tone: 'signal' | 'muted' }[] = [];
  badges.push(
    reading.isInvoiceReference
      ? { label: t('gas.badgeReference'), tone: 'signal' }
      : { label: t('gas.badgeStandard'), tone: 'muted' },
  );
  if (reading.hasMeterImage) badges.push({ label: t('gas.badgeImage'), tone: 'muted' });
  if (reading.hasInvoicePdf) badges.push({ label: t('gas.badgeInvoice'), tone: 'muted' });

  return (
    <View>
      <Pressable
        onPress={() => setShowActions(true)}
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel={`${formatNumber(reading.counterValue)} m³, ${formatShortDate(
          reading.readingDate,
        )} — ${t('gas.actionsMenuTitle')}`}
        accessibilityState={{ disabled: isBusy }}
        style={[
          styles.row,
          {
            opacity: isBusy ? 0.5 : 1,
            backgroundColor: tokens.panel,
            borderColor: tokens.line,
          },
        ]}
      >
        <View style={styles.left}>
          <Readout
            value={formatNumber(reading.counterValue)}
            unit="m³"
            size="md"
            tone={reading.isInvoiceReference ? 'signal' : 'ink'}
          />
          <View style={styles.metaRow}>
            <MonoMeta>
              {`${formatShortDate(reading.readingDate)} · ${formatTime(reading.readingDate)}`}
            </MonoMeta>
            {dailyConsumption !== null ? (
              <MonoMeta>
                {t('gas.dailyValue', { value: formatNumber(dailyConsumption) })}
              </MonoMeta>
            ) : null}
          </View>
          <View style={styles.badges}>
            {badges.map((badge) => (
              <View
                key={badge.label}
                style={[
                  styles.badge,
                  {
                    borderColor: badge.tone === 'signal' ? tokens.signal : tokens.line,
                  },
                ]}
              >
                <Text
                  size="label"
                  weight="monoSemiBold"
                  tone={badge.tone === 'signal' ? 'signal' : 'dim'}
                  style={{ letterSpacing: 0.8 }}
                >
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.right}>
          {consumption !== null ? (
            <MonoMeta>{`+${formatNumber(consumption)} m³`}</MonoMeta>
          ) : null}
          {cost !== null ? (
            <Text size="body" weight="medium">
              {`${formatNumber(cost)} ${t('gas.currencyKM')}`}
            </Text>
          ) : null}
          <View style={styles.chevron}>
            <Led state={reading.isInvoiceReference ? 'on' : 'off'} size={5} />
            <Ionicons name="ellipsis-horizontal" size={14} color={tokens.inkDim} />
            <Text size="label" tone="dim" style={{ opacity: 0 }}>
              {t('gas.actionsMenuTrigger')}
            </Text>
          </View>
        </View>
      </Pressable>

      {/*
        F9 (GAS-ACTIONS-2): akcije su preseljene sa starog `Actionsheet` sloja
        (NativeWind, RN `Modal` bez animacije) na `Sheet`, isti primitiv kao
        svaka druga odluka u aplikaciji. Razlog nije estetika: `Actionsheet` je
        koristio `Modal` bez `mounted` prozora, pa se zatvarao presijecanjem, a
        njegove `Item` komponente nisu imale `disabled` stanje — dvostruki dodir
        na „Obriši" je poslao dva DELETE zahtjeva.
      */}
      <Sheet
        isOpen={showActions}
        onClose={() => setShowActions(false)}
        title={t('gas.actionsMenuTitle')}
        closeLabel={t('common.close')}
        snapPoints={['60%']}
        scrollable
        testID="gas-reading-actions"
      >
        <View>
          {onToggleReference ? (
            <ActionRow
              icon={reading.isInvoiceReference ? 'flag' : 'flag-outline'}
              label={
                reading.isInvoiceReference
                  ? t('gas.actionUnsetReference')
                  : t('gas.actionSetReference')
              }
              onPress={() =>
                runAction(() => onToggleReference(reading, !reading.isInvoiceReference))
              }
            />
          ) : null}
          {onUploadMeterImage ? (
            <ActionRow
              icon={reading.hasMeterImage ? 'images-outline' : 'camera-outline'}
              label={reading.hasMeterImage ? t('gas.actionReplaceImage') : t('gas.actionAddImage')}
              onPress={() => runAction(() => onUploadMeterImage(reading))}
            />
          ) : null}
          {reading.hasMeterImage && onOpenMeterImage ? (
            <ActionRow
              icon="open-outline"
              label={t('gas.actionOpenImage')}
              onPress={() => runAction(() => onOpenMeterImage(reading))}
            />
          ) : null}
          {reading.isInvoiceReference && onUploadInvoice ? (
            <ActionRow
              icon={reading.hasInvoicePdf ? 'refresh-outline' : 'document-outline'}
              label={
                reading.hasInvoicePdf
                  ? t('gas.actionReplaceInvoice')
                  : t('gas.actionAddInvoice')
              }
              onPress={() => runAction(() => onUploadInvoice(reading))}
            />
          ) : null}
          {reading.isInvoiceReference && reading.hasInvoicePdf && onOpenInvoice ? (
            <ActionRow
              icon="open-outline"
              label={t('gas.actionOpenInvoice')}
              onPress={() => runAction(() => onOpenInvoice(reading))}
            />
          ) : null}
          {reading.isInvoiceReference && reading.hasInvoicePdf && onDeleteInvoice ? (
            <ActionRow
              icon="trash-outline"
              label={t('gas.actionDeleteInvoice')}
              destructive
              onPress={() => runAction(() => onDeleteInvoice(reading))}
            />
          ) : null}
          {onDelete ? (
            <ActionRow
              icon="trash-outline"
              label={t('gas.actionDeleteReading')}
              destructive
              disabled={isBusy}
              onPress={() => runAction(() => onDelete(reading.id))}
            />
          ) : null}
        </View>
      </Sheet>
    </View>
  );
});

/**
 * Red akcije u sheetu: puna širina, 52 px, hairline razdjelnik i `disabled`
 * stanje (F9). Prije su `Actionsheet.Item` redovi bili samo `px-2 py-3` bez
 * razdjelnika, pa su se akcije stapale u jedan blok teksta.
 */
function ActionRow({
  icon,
  label,
  destructive = false,
  disabled = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { t: tokens } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={`gas-action-${label}`}
      style={[styles.actionRow, { borderBottomColor: tokens.line, opacity: disabled ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={destructive ? tokens.fault : tokens.ink} />
      <Text
        size="bodyLg"
        weight={destructive ? 'semibold' : 'medium'}
        tone={destructive ? 'fault' : 'ink'}
        style={{ flex: 1 }}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={tokens.inkDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * F7 (GAS-LIST): očitanje je sada KARTICA sa marginama ekrana, ne red
   * zalepljen za ivicu.
   *
   * Prije: `paddingHorizontal: space.md` (12) i `borderBottomWidth` bez
   * `borderBottomColor`, dok zaglavlje liste ima `paddingHorizontal: space.lg`
   * (16). Rezultat je bio dvostruko pogrešan: sadržaj reda je počinjao 4 px
   * lijevo od svakog drugog bloka na ekranu, a ivica reda je koristila RN
   * default crnu — dakle na dark temi crna linija, a na light temi ista crna
   * linija preko bijele ploče. Korisnik je to opisao kao „samo su nabacani".
   *
   * Sada: `marginHorizontal: space.lg` (isto kao zaglavlje), `borderRadius: 4`,
   * hairline ivica u `tokens.line` (crta se inline, jer boja zavisi od teme) i
   * 8 px razmaka između kartica — ritam koji već nose `Panel`/`PanelRow`.
   */
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: 4,
  },
  left: {
    flex: 1,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: 3,
  },
  chevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  /**
   * F7 (GAS-ACTIONS): akcije u sheetu su bile „previše sitne" — 16 px ikona i
   * 13 px tekst u redu visokom koliko i tekst (~20 px), dakle trećina
   * preporučene mete. Sada je red visok `MIN_TOUCH` (44) sa 12 px razmaka,
   * ikonom od 20 px i tekstom `bodyLg` (15) — dodirna meta i vizuelna težina
   * iste kao dugmad u ostatku aplikacije.
   */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
});
