import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Pressable,
  Actionsheet,
  useColorModeValue,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTranslation } from '../../hooks/useTranslation';

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
  previousReading?: GasReading; // Previous reading in the list (newer reading)
  onDelete?: (id: number) => void;
  onToggleReference?: (reading: GasReading, isReference: boolean) => void;
  onUploadMeterImage?: (reading: GasReading) => void;
  onUploadInvoice?: (reading: GasReading) => void;
  onDeleteInvoice?: (reading: GasReading) => void;
  onOpenMeterImage?: (reading: GasReading) => void;
  onOpenInvoice?: (reading: GasReading) => void;
  isDeleting?: boolean;
  isMutating?: boolean;
}

export const GasReadingCard: React.FC<GasReadingCardProps> = ({
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
}) => {
  const { t } = useTranslation();
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const consumptionBg = useColorModeValue('blue.50', 'blue.900');
  const consumptionBorder = useColorModeValue('blue.200', 'blue.700');
  const consumptionText = useColorModeValue('blue.700', 'blue.200');
  const standardBadgeBg = useColorModeValue('gray.300', 'gray.600');
  const standardBadgeText = useColorModeValue('gray.700', 'gray.100');
  const actionTriggerBg = useColorModeValue('gray.100', 'gray.700');
  const actionTriggerBorder = useColorModeValue('gray.200', 'gray.600');
  const actionTriggerText = useColorModeValue('gray.700', 'gray.200');
  const menuTitleColor = useColorModeValue('gray.500', 'gray.300');
  const destructiveColor = useColorModeValue('red.600', 'red.300');

  const [showActions, setShowActions] = useState(false);

  const formattedDate = dayjs(reading.readingDate).format('DD.MM.YYYY');
  const formattedTime = dayjs(reading.readingDate).format('HH:mm');

  const consumption =
    previousReading && previousReading.counterValue >= reading.counterValue
      ? previousReading.counterValue - reading.counterValue
      : null;

  const daysDiff =
    previousReading && dayjs(previousReading.readingDate).isAfter(reading.readingDate)
      ? dayjs(previousReading.readingDate).diff(dayjs(reading.readingDate), 'day')
      : null;

  const dailyConsumption =
    consumption && daysDiff && daysDiff > 0 ? consumption / daysDiff : null;

  const isBusy = Boolean(isDeleting || isMutating);

  const runAction = (action?: () => void) => {
    setShowActions(false);
    if (!action || isBusy) {
      return;
    }
    requestAnimationFrame(() => action());
  };

  return (
    <Box bg={cardBg} rounded="lg" borderWidth={1} borderColor={borderColor} p={4} mb={3}>
      <VStack space={3}>
        <HStack justifyContent="space-between" alignItems="flex-start">
          <VStack flex={1} space={2}>
            <HStack alignItems="center" space={2}>
              <Icon as={Ionicons} name="flame-outline" size={5} color="orange.500" />
              <Text fontSize="lg" fontWeight="600" color={textColor}>
                {reading.counterValue.toFixed(2)} m³
              </Text>
            </HStack>
            <HStack space={2}>
              {reading.isInvoiceReference ? (
                <Box px={2} py={1} rounded="full" bg="amber.500">
                  <Text fontSize="2xs" color="white" fontWeight="700">
                    {t('gas.badgeReference')}
                  </Text>
                </Box>
              ) : (
                <Box px={2} py={1} rounded="full" bg={standardBadgeBg}>
                  <Text fontSize="2xs" color={standardBadgeText} fontWeight="700">
                    {t('gas.badgeStandard')}
                  </Text>
                </Box>
              )}
              {reading.hasMeterImage && (
                <Box px={2} py={1} rounded="full" bg="blue.500">
                  <Text fontSize="2xs" color="white" fontWeight="700">
                    {t('gas.badgeImage')}
                  </Text>
                </Box>
              )}
              {reading.hasInvoicePdf && (
                <Box px={2} py={1} rounded="full" bg="green.500">
                  <Text fontSize="2xs" color="white" fontWeight="700">
                    {t('gas.badgeInvoice')}
                  </Text>
                </Box>
              )}
            </HStack>
            <HStack space={4}>
              <VStack>
                <Text fontSize="xs" color={subtextColor}>
                  {t('gas.dateLabel')}
                </Text>
                <Text fontSize="sm" fontWeight="500" color={textColor}>
                  {formattedDate}
                </Text>
              </VStack>
              <VStack>
                <Text fontSize="xs" color={subtextColor}>
                  {t('gas.timeLabel')}
                </Text>
                <Text fontSize="sm" fontWeight="500" color={textColor}>
                  {formattedTime}
                </Text>
              </VStack>
            </HStack>
          </VStack>

          <Pressable
            onPress={() => setShowActions(true)}
            disabled={isBusy}
            _pressed={{ opacity: 0.8 }}
            ml={3}
          >
            <Box
              px={3}
              py={2}
              rounded="full"
              bg={actionTriggerBg}
              borderWidth={1}
              borderColor={actionTriggerBorder}
            >
              <HStack space={1.5} alignItems="center">
                <Icon as={Ionicons} name="ellipsis-horizontal" size={4} color={actionTriggerText} />
                <Text fontSize="xs" fontWeight="700" color={actionTriggerText}>
                  {t('gas.actionsMenuTrigger')}
                </Text>
              </HStack>
            </Box>
          </Pressable>
        </HStack>

        {consumption !== null && (
          <Box
            bg={consumptionBg}
            borderWidth={1}
            borderColor={consumptionBorder}
            rounded="md"
            p={3}
          >
            <HStack justifyContent="space-between" alignItems="center">
              <VStack>
                <Text fontSize="xs" color={consumptionText} fontWeight="600">
                  {t('gas.consumption')}
                </Text>
                <Text fontSize="sm" fontWeight="bold" color={consumptionText}>
                  {consumption.toFixed(2)} m³
                </Text>
              </VStack>
              {dailyConsumption !== null && (
                <VStack alignItems="flex-end">
                  <Text fontSize="xs" color={consumptionText} fontWeight="600">
                    {t('gas.dailyLabel')}
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color={consumptionText}>
                    {t('gas.dailyValue', { value: dailyConsumption.toFixed(2) })}
                  </Text>
                </VStack>
              )}
            </HStack>
          </Box>
        )}

        <Actionsheet
          isOpen={showActions}
          onClose={() => setShowActions(false)}
          _backdrop={{
            onTouchEnd: () => setShowActions(false),
            bg: 'rgba(0,0,0,0.1)',
          }}
        >
          <Actionsheet.Content>
            <Text
              fontSize="xs"
              textTransform="uppercase"
              letterSpacing={0.5}
              color={menuTitleColor}
              fontWeight="700"
              mb={1}
            >
              {t('gas.actionsMenuTitle')}
            </Text>

            {onToggleReference && (
              <Actionsheet.Item
                onPress={() =>
                  runAction(() => onToggleReference(reading, !reading.isInvoiceReference))
                }
              >
                <HStack space={2} alignItems="center">
                  <Icon
                    as={Ionicons}
                    name={reading.isInvoiceReference ? 'flag' : 'flag-outline'}
                    size={4}
                    color={textColor}
                  />
                  <Text color={textColor} fontWeight="600">
                    {reading.isInvoiceReference
                      ? t('gas.actionUnsetReference')
                      : t('gas.actionSetReference')}
                  </Text>
                </HStack>
              </Actionsheet.Item>
            )}

            {onUploadMeterImage && (
              <Actionsheet.Item onPress={() => runAction(() => onUploadMeterImage(reading))}>
                <HStack space={2} alignItems="center">
                  <Icon
                    as={Ionicons}
                    name={reading.hasMeterImage ? 'images-outline' : 'camera-outline'}
                    size={4}
                    color={textColor}
                  />
                  <Text color={textColor} fontWeight="600">
                    {reading.hasMeterImage ? t('gas.actionReplaceImage') : t('gas.actionAddImage')}
                  </Text>
                </HStack>
              </Actionsheet.Item>
            )}

            {reading.hasMeterImage && onOpenMeterImage && (
              <Actionsheet.Item onPress={() => runAction(() => onOpenMeterImage(reading))}>
                <HStack space={2} alignItems="center">
                  <Icon as={Ionicons} name="open-outline" size={4} color={textColor} />
                  <Text color={textColor} fontWeight="600">
                    {t('gas.actionOpenImage')}
                  </Text>
                </HStack>
              </Actionsheet.Item>
            )}

            {reading.isInvoiceReference && onUploadInvoice && (
              <Actionsheet.Item onPress={() => runAction(() => onUploadInvoice(reading))}>
                <HStack space={2} alignItems="center">
                  <Icon
                    as={Ionicons}
                    name={reading.hasInvoicePdf ? 'refresh-outline' : 'document-outline'}
                    size={4}
                    color={textColor}
                  />
                  <Text color={textColor} fontWeight="600">
                    {reading.hasInvoicePdf
                      ? t('gas.actionReplaceInvoice')
                      : t('gas.actionAddInvoice')}
                  </Text>
                </HStack>
              </Actionsheet.Item>
            )}

            {reading.isInvoiceReference && reading.hasInvoicePdf && onOpenInvoice && (
              <Actionsheet.Item onPress={() => runAction(() => onOpenInvoice(reading))}>
                <HStack space={2} alignItems="center">
                  <Icon as={Ionicons} name="open-outline" size={4} color={textColor} />
                  <Text color={textColor} fontWeight="600">
                    {t('gas.actionOpenInvoice')}
                  </Text>
                </HStack>
              </Actionsheet.Item>
            )}

            {reading.isInvoiceReference && reading.hasInvoicePdf && onDeleteInvoice && (
              <Actionsheet.Item onPress={() => runAction(() => onDeleteInvoice(reading))}>
                <HStack space={2} alignItems="center">
                  <Icon as={Ionicons} name="trash-outline" size={4} color={destructiveColor} />
                  <Text color={destructiveColor} fontWeight="700">
                    {t('gas.actionDeleteInvoice')}
                  </Text>
                </HStack>
              </Actionsheet.Item>
            )}

            {onDelete && (
              <Actionsheet.Item onPress={() => runAction(() => onDelete(reading.id))}>
                <HStack space={2} alignItems="center">
                  <Icon as={Ionicons} name="trash-outline" size={4} color={destructiveColor} />
                  <Text color={destructiveColor} fontWeight="700">
                    {t('gas.actionDeleteReading')}
                  </Text>
                </HStack>
              </Actionsheet.Item>
            )}
          </Actionsheet.Content>
        </Actionsheet>
      </VStack>
    </Box>
  );
};
