import React from 'react';
import { Box, VStack, HStack, Text, Icon, Pressable, useColorModeValue } from 'native-base';
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
  const deleteColor = useColorModeValue('red.500', 'red.400');
  const consumptionBg = useColorModeValue('blue.50', 'blue.900');
  const consumptionBorder = useColorModeValue('blue.200', 'blue.700');
  const consumptionText = useColorModeValue('blue.700', 'blue.200');
  const standardBadgeBg = useColorModeValue('gray.300', 'gray.600');
  const standardBadgeText = useColorModeValue('gray.700', 'gray.100');
  const hintTextColor = useColorModeValue('gray.500', 'gray.400');

  const formattedDate = dayjs(reading.readingDate).format('DD.MM.YYYY');
  const formattedTime = dayjs(reading.readingDate).format('HH:mm');

  // Calculate consumption difference: previous (newer) - current (older)
  const consumption =
    previousReading && previousReading.counterValue >= reading.counterValue
      ? previousReading.counterValue - reading.counterValue
      : null;

  const daysDiff =
    previousReading && dayjs(previousReading.readingDate).isAfter(reading.readingDate)
      ? dayjs(previousReading.readingDate).diff(dayjs(reading.readingDate), 'day')
      : null;

  const dailyConsumption = consumption && daysDiff && daysDiff > 0 ? consumption / daysDiff : null;

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

          {onDelete && (
            <Pressable
              onPress={() => onDelete(reading.id)}
              disabled={isDeleting}
              _pressed={{ opacity: 0.7 }}
              ml={3}
            >
              <Icon
                as={Ionicons}
                name="trash-outline"
                size={6}
                color={deleteColor}
                opacity={isDeleting ? 0.5 : 1}
              />
            </Pressable>
          )}
        </HStack>

        {/* Consumption difference */}
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

        <VStack space={2}>
          <HStack flexWrap="wrap" space={2}>
            {onToggleReference && (
              <Pressable
                onPress={() => onToggleReference(reading, !reading.isInvoiceReference)}
                disabled={isMutating}
                _pressed={{ opacity: 0.7 }}
              >
                <Box
                  px={3}
                  py={2}
                  rounded="md"
                  bg={reading.isInvoiceReference ? 'orange.500' : 'blue.500'}
                >
                  <Text color="white" fontSize="xs" fontWeight="700">
                    {reading.isInvoiceReference
                      ? t('gas.actionUnsetReference')
                      : t('gas.actionSetReference')}
                  </Text>
                </Box>
              </Pressable>
            )}

            {reading.hasMeterImage && onOpenMeterImage && (
              <Pressable onPress={() => onOpenMeterImage(reading)} disabled={isMutating}>
                <Box px={3} py={2} rounded="md" bg="blue.600">
                  <Text color="white" fontSize="xs" fontWeight="700">
                    {t('gas.actionOpenImage')}
                  </Text>
                </Box>
              </Pressable>
            )}
          </HStack>

          {reading.isInvoiceReference ? (
            <VStack space={2}>
              <Text fontSize="xs" fontWeight="600" color={subtextColor}>
                {t('gas.invoiceActionsTitle')}
              </Text>
              <HStack flexWrap="wrap" space={2}>
                {onUploadInvoice && (
                  <Pressable onPress={() => onUploadInvoice(reading)} disabled={isMutating}>
                    <Box px={3} py={2} rounded="md" bg="green.600">
                      <Text color="white" fontSize="xs" fontWeight="700">
                        {reading.hasInvoicePdf
                          ? t('gas.actionReplaceInvoice')
                          : t('gas.actionAddInvoice')}
                      </Text>
                    </Box>
                  </Pressable>
                )}

                {reading.hasInvoicePdf && onOpenInvoice && (
                  <Pressable onPress={() => onOpenInvoice(reading)} disabled={isMutating}>
                    <Box px={3} py={2} rounded="md" bg="teal.600">
                      <Text color="white" fontSize="xs" fontWeight="700">
                        {t('gas.actionOpenInvoice')}
                      </Text>
                    </Box>
                  </Pressable>
                )}

                {reading.hasInvoicePdf && onDeleteInvoice && (
                  <Pressable onPress={() => onDeleteInvoice(reading)} disabled={isMutating}>
                    <Box px={3} py={2} rounded="md" bg="red.600">
                      <Text color="white" fontSize="xs" fontWeight="700">
                        {t('gas.actionDeleteInvoice')}
                      </Text>
                    </Box>
                  </Pressable>
                )}
              </HStack>
            </VStack>
          ) : (
            <Text fontSize="xs" color={hintTextColor}>
              {t('gas.invoiceReferenceHint')}
            </Text>
          )}
        </VStack>
      </VStack>
    </Box>
  );
};
