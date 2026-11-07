import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';

import { useTranslation } from '../../hooks/useTranslation';
import { useTokens } from '../../ui/theme';
import { Led, MonoMeta, Pressable, Readout, Text } from '../../ui';
import { space } from '../../theme/tokens';
import { Actionsheet } from '../ui/nativewind';

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
        accessibilityLabel={`${reading.counterValue.toFixed(2)} m³, ${dayjs(
          reading.readingDate,
        ).format('DD.MM')} — ${t('gas.actionsMenuTitle')}`}
        accessibilityState={{ disabled: isBusy }}
        style={[styles.row, { opacity: isBusy ? 0.5 : 1 }]}
      >
        <View style={styles.left}>
          <Readout
            value={reading.counterValue.toFixed(2)}
            unit="m³"
            size="md"
            tone={reading.isInvoiceReference ? 'signal' : 'ink'}
          />
          <View style={styles.metaRow}>
            <MonoMeta>
              {`${dayjs(reading.readingDate).format('DD.MM')} · ${dayjs(
                reading.readingDate,
              ).format('HH:mm')}`}
            </MonoMeta>
            {dailyConsumption !== null ? (
              <MonoMeta>
                {t('gas.dailyValue', { value: dailyConsumption.toFixed(2) })}
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
            <MonoMeta>{`+${consumption.toFixed(2)} m³`}</MonoMeta>
          ) : null}
          {cost !== null ? (
            <Text size="body" weight="medium">
              {`${cost.toFixed(2)} ${t('gas.currencyKM')}`}
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

      <Actionsheet isOpen={showActions} onClose={() => setShowActions(false)}>
        <Actionsheet.Content>
          <MonoMeta style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
            {t('gas.actionsMenuTitle')}
          </MonoMeta>
          {onToggleReference && (
            <Actionsheet.Item
              onPress={() =>
                runAction(() => onToggleReference(reading, !reading.isInvoiceReference))
              }
            >
              <ActionRow
                icon={reading.isInvoiceReference ? 'flag' : 'flag-outline'}
                label={
                  reading.isInvoiceReference
                    ? t('gas.actionUnsetReference')
                    : t('gas.actionSetReference')
                }
              />
            </Actionsheet.Item>
          )}
          {onUploadMeterImage && (
            <Actionsheet.Item onPress={() => runAction(() => onUploadMeterImage(reading))}>
              <ActionRow
                icon={reading.hasMeterImage ? 'images-outline' : 'camera-outline'}
                label={
                  reading.hasMeterImage ? t('gas.actionReplaceImage') : t('gas.actionAddImage')
                }
              />
            </Actionsheet.Item>
          )}
          {reading.hasMeterImage && onOpenMeterImage && (
            <Actionsheet.Item onPress={() => runAction(() => onOpenMeterImage(reading))}>
              <ActionRow icon="open-outline" label={t('gas.actionOpenImage')} />
            </Actionsheet.Item>
          )}
          {reading.isInvoiceReference && onUploadInvoice && (
            <Actionsheet.Item onPress={() => runAction(() => onUploadInvoice(reading))}>
              <ActionRow
                icon={reading.hasInvoicePdf ? 'refresh-outline' : 'document-outline'}
                label={
                  reading.hasInvoicePdf
                    ? t('gas.actionReplaceInvoice')
                    : t('gas.actionAddInvoice')
                }
              />
            </Actionsheet.Item>
          )}
          {reading.isInvoiceReference && reading.hasInvoicePdf && onOpenInvoice && (
            <Actionsheet.Item onPress={() => runAction(() => onOpenInvoice(reading))}>
              <ActionRow icon="open-outline" label={t('gas.actionOpenInvoice')} />
            </Actionsheet.Item>
          )}
          {reading.isInvoiceReference && reading.hasInvoicePdf && onDeleteInvoice && (
            <Actionsheet.Item onPress={() => runAction(() => onDeleteInvoice(reading))}>
              <ActionRow icon="trash-outline" label={t('gas.actionDeleteInvoice')} destructive />
            </Actionsheet.Item>
          )}
          {onDelete && (
            <Actionsheet.Item onPress={() => runAction(() => onDelete(reading.id))}>
              <ActionRow icon="trash-outline" label={t('gas.actionDeleteReading')} destructive />
            </Actionsheet.Item>
          )}
        </Actionsheet.Content>
      </Actionsheet>
    </View>
  );
});

function ActionRow({
  icon,
  label,
  destructive = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  destructive?: boolean;
}) {
  const { t: tokens } = useTokens();
  return (
    <View style={styles.actionRow}>
      <Ionicons name={icon} size={16} color={destructive ? tokens.fault : tokens.ink} />
      <Text size="body" weight={destructive ? 'semibold' : 'medium'} tone={destructive ? 'fault' : 'ink'}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
