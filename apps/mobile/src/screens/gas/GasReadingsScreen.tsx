import React, { useState } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RefreshControl, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Heading,
  useColorModeValue,
  Spinner,
  ScrollView,
  Pressable,
  useToast,
  Center,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/client';
import { useErrorHandler } from '../../services/api/error.handler';
import { useTranslation } from '../../hooks/useTranslation';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { GasReadingCard } from '../../components/gas/GasReadingCard';
import { GasForm } from '../../components/gas/GasForm';
import { SecureStorage } from '../../services/storage/SecureStorage';

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
  invoiceGasPriceExVat?: number | null;
}

export const GasReadingsScreen: React.FC = () => {
  const route = useRoute<RouteProp<any, 'GasReadings'>>();
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'year' | 'all' | 'custom'>(
    'week'
  );
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { showError } = useErrorHandler();
  const { t } = useTranslation();

  // Handle deep link to open add modal
  React.useEffect(() => {
    if (route.params?.openAddModal) {
      setShowAddModal(true);
    }
  }, [route.params?.openAddModal]);

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'dark.700');
  const fabBg = useColorModeValue('brand.500', 'brand.600');
  const accentColor = useColorModeValue('brand.500', 'brand.400');
  const filterBg = useColorModeValue('gray.200', 'gray.700');
  const filterActiveBg = useColorModeValue('brand.500', 'brand.600');

  const {
    data: readings = [],
    isLoading,
    isFetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['gas-readings'],
    queryFn: () => apiClient.getGasReadings() as Promise<GasReading[]>,
  });

  // Handle query errors outside the query config to maintain hook order
  React.useEffect(() => {
    if (queryError) {
      showError(queryError, t('gas.loadError') || 'Failed to load gas readings');
    }
  }, [queryError, showError, t]);

  const addMutation = useMutation({
    mutationFn: (data: {
      counterValue: number;
      readingDate: string;
      markAsReference?: boolean;
      meterImage?: { uri: string; name?: string; type?: string };
    }) =>
      apiClient.addGasReadingWithUpload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
      setShowAddModal(false);
      toast.show({
        render: () => (
          <Box bg="green.500" px={3} py={2} rounded="md" mb={2}>
            <Text color="white" fontSize="sm">
              {t('gas.addedSuccess') || 'Gas reading added successfully'}
            </Text>
          </Box>
        ),
        duration: 2000,
        placement: 'top',
      });
    },
    onError: (error: any) => {
      showError(error, t('gas.addError') || 'Failed to add gas reading');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteGasReading(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      toast.show({
        render: () => (
          <Box bg="green.500" px={3} py={2} rounded="md" mb={2}>
            <Text color="white" fontSize="sm">
              {t('gas.deleteSuccess') || 'Gas reading deleted'}
            </Text>
          </Box>
        ),
        duration: 2000,
        placement: 'top',
      });
    },
    onError: (error: any) => {
      showError(error, t('gas.deleteError') || 'Failed to delete gas reading');
    },
  });

  const referenceMutation = useMutation({
    mutationFn: (payload: { id: number; isReference: boolean }) =>
      apiClient.updateGasReference(payload.id, payload.isReference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
    onError: (error: any) => {
      showError(error, t('gas.referenceError') || 'Failed to update reference state');
    },
  });

  const invoiceUploadMutation = useMutation({
    mutationFn: (payload: {
      id: number;
      invoicePdf: { uri: string; name?: string; type?: string };
      invoiceGasPriceExVat?: number;
    }) => apiClient.uploadGasInvoice(payload.id, payload.invoicePdf, payload.invoiceGasPriceExVat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
      toast.show({
        render: () => (
          <Box bg="green.500" px={3} py={2} rounded="md" mb={2}>
            <Text color="white" fontSize="sm">
              {t('gas.invoiceUploaded') || 'Invoice uploaded'}
            </Text>
          </Box>
        ),
        duration: 2000,
        placement: 'top',
      });
    },
    onError: (error: any) => {
      showError(error, t('gas.invoiceUploadError') || 'Failed to upload invoice');
    },
  });

  const invoiceDeleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteGasInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
    onError: (error: any) => {
      showError(error, t('gas.invoiceDeleteError') || 'Failed to delete invoice');
    },
  });

  const resolveDownloadDirectory = () => {
    try {
      return Paths.cache;
    } catch {
      // Continue to document directory fallback.
    }

    try {
      return Paths.document;
    } catch {
      return null;
    }
  };

  const sanitizeFileName = (name: string) =>
    name.replace(/[^a-zA-Z0-9._-]/g, '_');

  const openProtectedFile = async (url: string, fallbackName: string) => {
    const token = await SecureStorage.getToken();
    if (!token) {
      throw new Error('Authentication token missing');
    }

    const baseDirectory = resolveDownloadDirectory();
    if (!baseDirectory) {
      throw new Error('No local storage directory available for downloads');
    }

    const downloadsDirectory = baseDirectory.createDirectory('downloads');
    downloadsDirectory.create({ idempotent: true, intermediates: true });

    const targetFile = new File(
      downloadsDirectory,
      `${Date.now()}-${sanitizeFileName(fallbackName)}`,
    );

    const downloaded = await File.downloadFileAsync(url, targetFile, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      idempotent: true,
    });

    await Linking.openURL(downloaded.uri);
  };

  const handleUploadInvoice = async (reading: GasReading) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      await invoiceUploadMutation.mutateAsync({
        id: reading.id,
        invoicePdf: {
          uri: asset.uri,
          name: asset.name || 'invoice.pdf',
          type: asset.mimeType || 'application/pdf',
        },
      });
    } catch (error: any) {
      showError(error, t('gas.invoiceUploadError') || 'Failed to upload invoice');
    }
  };

  const handleOpenMeterImage = async (reading: GasReading) => {
    try {
      await openProtectedFile(
        apiClient.getGasMeterImageEndpoint(reading.id),
        `meter-${reading.id}.jpg`,
      );
    } catch (error: any) {
      showError(error, t('gas.meterImageOpenError') || 'Failed to open image');
    }
  };

  const handleOpenInvoice = async (reading: GasReading) => {
    try {
      await openProtectedFile(
        apiClient.getGasInvoiceEndpoint(reading.id),
        `invoice-${reading.id}.pdf`,
      );
    } catch (error: any) {
      showError(error, t('gas.invoiceOpenError') || 'Failed to open invoice');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // Filter readings by date range
  const getFilteredReadings = () => {
    const now = new Date();
    const sorted = [...(readings || [])].sort(
      (a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime()
    );

    if (dateFilter === 'custom') {
      if (!customStartDate && !customEndDate) return sorted;
      return sorted.filter((reading) => {
        const readingDate = new Date(reading.readingDate).getTime();
        const start = customStartDate ? customStartDate.getTime() : 0;
        const end = customEndDate ? customEndDate.getTime() : Date.now();
        return readingDate >= start && readingDate <= end;
      });
    }

    let startDate = new Date();
    switch (dateFilter) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        // First day of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        // First day of current year
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    return sorted.filter(
      (reading) => new Date(reading.readingDate).getTime() >= startDate.getTime()
    );
  };

  const filteredReadings = getFilteredReadings();

  // Calculate consumption for filtered period
  const calculatePeriodConsumption = () => {
    if (filteredReadings.length < 2) return 0;
    const sorted = [...filteredReadings].sort(
      (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime()
    );
    const oldest = sorted[0].counterValue;
    const newest = sorted[sorted.length - 1].counterValue;
    return newest - oldest;
  };

  const periodConsumption = calculatePeriodConsumption();

  if (isLoading) {
    return (
      <Box flex={1} bg={bgColor} safeArea>
        <Center flex={1}>
          <VStack space={4} alignItems="center">
            <Spinner size="lg" color={accentColor} />
            <Text fontSize="lg" color={mutedColor}>
              {t('gas.loading') || 'Loading gas readings...'}
            </Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing || isFetching} onRefresh={handleRefresh} />
        }
      >
        <VStack px={5} py={5} space={4} pb={8}>
          {/* Header */}
          <VStack space={1}>
            <Heading size="2xl" color={textColor} fontWeight="700">
              {t('gas.title') || 'Gas Readings'}
            </Heading>
            <Text fontSize="sm" color={subtextColor}>
              {t('gas.subtitle') || 'Track your gas meter readings and consumption'}
            </Text>
          </VStack>

          {/* Date Filter Tabs */}
          <VStack space={2}>
            {/* First Row */}
            <HStack space={2}>
              {(
                [
                  { label: t('gas.filterLastWeek') || 'Last Week', value: 'week' },
                  { label: t('gas.filterMonth') || 'This Month', value: 'month' },
                  { label: t('gas.filterYear') || 'This Year', value: 'year' },
                ] as Array<{ label: string; value: 'week' | 'month' | 'year' }>
              ).map((filter) => (
                <Pressable
                  key={filter.value}
                  onPress={() => setDateFilter(filter.value)}
                  bg={dateFilter === filter.value ? filterActiveBg : filterBg}
                  px={4}
                  py={2}
                  rounded="full"
                  flex={1}
                  _pressed={{
                    opacity: 0.8,
                  }}
                >
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    color={dateFilter === filter.value ? 'white' : textColor}
                    textAlign="center"
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              ))}
            </HStack>
            {/* Second Row */}
            <HStack space={2}>
              <Pressable
                onPress={() => setDateFilter('all')}
                bg={dateFilter === 'all' ? filterActiveBg : filterBg}
                px={4}
                py={2}
                rounded="full"
                flex={1}
                _pressed={{
                  opacity: 0.8,
                }}
              >
                <Text
                  fontSize="xs"
                  fontWeight="600"
                  color={dateFilter === 'all' ? 'white' : textColor}
                  textAlign="center"
                >
                  {t('gas.filterAll') || 'All'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setDateFilter('custom');
                  setShowDateRangePicker(true);
                }}
                bg={dateFilter === 'custom' ? filterActiveBg : filterBg}
                px={4}
                py={2}
                rounded="full"
                flex={1}
                _pressed={{
                  opacity: 0.8,
                }}
              >
                <HStack space={1} alignItems="center" justifyContent="center">
                  <Icon
                    as={Ionicons}
                    name="calendar-outline"
                    size={3}
                    color={dateFilter === 'custom' ? 'white' : textColor}
                  />
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    color={dateFilter === 'custom' ? 'white' : textColor}
                  >
                    {t('gas.filterCustom') || 'Custom'}
                  </Text>
                </HStack>
              </Pressable>
            </HStack>
          </VStack>

          {/* Stats Bar */}
          <VStack space={3}>
            <HStack space={3}>
              <Box
                flex={1}
                bg={cardBg}
                rounded="xl"
                p={4}
                borderWidth={1}
                borderColor={borderColor}
                shadow={1}
              >
                <Text fontSize="2xs" fontWeight="600" color={mutedColor} mb={1}>
                  {t('gas.totalReadings') || 'Total Readings'}
                </Text>
                <Text fontSize="2xl" fontWeight="700" color={textColor}>
                  {filteredReadings.length}
                </Text>
              </Box>
              <Box
                flex={1}
                bg={cardBg}
                rounded="xl"
                p={4}
                borderWidth={1}
                borderColor={borderColor}
                shadow={1}
              >
                <Text fontSize="2xs" fontWeight="600" color={mutedColor} mb={1}>
                  {t('gas.lastReading') || 'Last Reading'}
                </Text>
                <Text fontSize="2xl" fontWeight="700" color={textColor}>
                  {filteredReadings.length > 0
                    ? new Date(filteredReadings[0].readingDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </Text>
              </Box>
            </HStack>
            <Box
              bg={cardBg}
              rounded="xl"
              p={4}
              borderWidth={1}
              borderColor={borderColor}
              shadow={1}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text fontSize="2xs" fontWeight="600" color={mutedColor} mb={1}>
                    {dateFilter === 'week'
                      ? t('gas.consumptionLastWeek')
                      : dateFilter === 'month'
                        ? t('gas.consumptionThisMonth')
                        : dateFilter === 'year'
                          ? t('gas.consumptionThisYear')
                          : dateFilter === 'custom'
                            ? t('gas.consumptionCustom')
                            : t('gas.consumptionTotal')}
                  </Text>
                  <HStack alignItems="baseline" space={1}>
                    <Text fontSize="2xl" fontWeight="700" color={textColor}>
                      {periodConsumption.toFixed(2)}
                    </Text>
                    <Text fontSize="md" fontWeight="600" color={mutedColor}>
                      m³
                    </Text>
                  </HStack>
                </VStack>
                <Icon as={Ionicons} name="flame-outline" size={10} color="orange.500" />
              </HStack>
            </Box>
          </VStack>

          {/* Readings List */}
          {filteredReadings.length === 0 ? (
            <Box
              bg={cardBg}
              rounded="xl"
              borderWidth={1}
              borderColor={borderColor}
              p={8}
              alignItems="center"
            >
              <Icon as={Ionicons} name="document-outline" size={16} color={subtextColor} mb={4} />
              <Text color={subtextColor} textAlign="center" fontSize="md" fontWeight="500" mb={1}>
                {t('gas.noReadingsInPeriod') || 'No readings in this period'}
              </Text>
              <Text color={subtextColor} textAlign="center" fontSize="sm">
                {t('gas.tryOtherPeriod') || 'Try a different time period or add a new reading'}
              </Text>
            </Box>
          ) : (
            <VStack space={3}>
              {filteredReadings.map((reading, idx) => (
                <GasReadingCard
                  key={reading.id}
                  reading={reading}
                  previousReading={idx > 0 ? filteredReadings[idx - 1] : undefined}
                  onDelete={() => deleteMutation.mutate(reading.id)}
                  onToggleReference={(item, isReference) =>
                    referenceMutation.mutate({ id: item.id, isReference })
                  }
                  onUploadInvoice={handleUploadInvoice}
                  onDeleteInvoice={(item) => invoiceDeleteMutation.mutate(item.id)}
                  onOpenMeterImage={handleOpenMeterImage}
                  onOpenInvoice={handleOpenInvoice}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === reading.id}
                  isMutating={
                    referenceMutation.isPending ||
                    invoiceUploadMutation.isPending ||
                    invoiceDeleteMutation.isPending
                  }
                />
              ))}
            </VStack>
          )}
        </VStack>
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        position="absolute"
        bottom={8}
        right={8}
        onPress={() => setShowAddModal(true)}
        bg={fabBg}
        rounded="full"
        w={20}
        h={20}
        alignItems="center"
        justifyContent="center"
        _pressed={{
          opacity: 0.85,
        }}
        shadow={9}
      >
        <Icon as={Ionicons} name="add" size={10} color="white" fontWeight="bold" />
      </Pressable>

      {/* Add Reading Modal */}
      <BottomSheetModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        snapPoints={['75%', '95%']}
      >
        <VStack space={4} flex={1}>
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontSize="lg" fontWeight="bold" color={textColor}>
              {t('gas.addReading') || 'Add Gas Reading'}
            </Text>
            <Pressable onPress={() => setShowAddModal(false)}>
              <Icon as={Ionicons} name="close" size={6} color={textColor} />
            </Pressable>
          </HStack>
          <ScrollView bounces={false} flex={1}>
            <GasForm
              onSubmit={addMutation.mutateAsync}
              isLoading={addMutation.isPending}
              onCancel={() => setShowAddModal(false)}
              existingReadings={readings}
            />
          </ScrollView>
        </VStack>
      </BottomSheetModal>

      {/* Date Range Picker Modal */}
      <BottomSheetModal
        isOpen={showDateRangePicker}
        onClose={() => setShowDateRangePicker(false)}
        snapPoints={['60%', '85%']}
      >
        <VStack space={4}>
          <Text fontSize="lg" fontWeight="bold" color={textColor}>
            {t('gas.dateRange.title') || 'Select Date Range'}
          </Text>
          <VStack space={4}>
            {/* Start Date */}
            <Box>
              <Text fontSize="sm" fontWeight="600" color={textColor} mb={2}>
                {t('gas.dateRange.startDate') || 'Start Date'}
              </Text>
              <Pressable
                onPress={() => setShowStartPicker(true)}
                bg={filterBg}
                px={4}
                py={3}
                rounded="lg"
                borderWidth={1}
                borderColor={borderColor}
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color={textColor} fontSize="sm">
                    {customStartDate
                      ? customStartDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : t('gas.dateRange.selectStart') || 'Select start date'}
                  </Text>
                  <Icon as={Ionicons} name="calendar" size={5} color={subtextColor} />
                </HStack>
              </Pressable>
            </Box>

            {/* End Date */}
            <Box>
              <Text fontSize="sm" fontWeight="600" color={textColor} mb={2}>
                {t('gas.dateRange.endDate') || 'End Date'}
              </Text>
              <Pressable
                onPress={() => setShowEndPicker(true)}
                bg={filterBg}
                px={4}
                py={3}
                rounded="lg"
                borderWidth={1}
                borderColor={borderColor}
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color={textColor} fontSize="sm">
                    {customEndDate
                      ? customEndDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : t('gas.dateRange.selectEnd') || 'Select end date'}
                  </Text>
                  <Icon as={Ionicons} name="calendar" size={5} color={subtextColor} />
                </HStack>
              </Pressable>
            </Box>

            {/* Quick Presets */}
            <VStack space={2}>
              <Text fontSize="xs" fontWeight="600" color={mutedColor} mb={1}>
                {t('gas.dateRange.quickPresets') || 'Quick Presets'}
              </Text>
              <VStack space={2}>
                <HStack space={2}>
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(end.getDate() - 30);
                      setCustomStartDate(start);
                      setCustomEndDate(end);
                    }}
                    bg={filterBg}
                    px={3}
                    py={2}
                    rounded="md"
                    flex={1}
                  >
                    <Text fontSize="xs" color={textColor} textAlign="center">
                      {t('gas.dateRange.last30') || 'Last 30 days'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(end.getDate() - 60);
                      setCustomStartDate(start);
                      setCustomEndDate(end);
                    }}
                    bg={filterBg}
                    px={3}
                    py={2}
                    rounded="md"
                    flex={1}
                  >
                    <Text fontSize="xs" color={textColor} textAlign="center">
                      {t('gas.dateRange.last60') || 'Last 60 days'}
                    </Text>
                  </Pressable>
                </HStack>
                <Pressable
                  onPress={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - 90);
                    setCustomStartDate(start);
                    setCustomEndDate(end);
                  }}
                  bg={filterBg}
                  px={3}
                  py={2}
                  rounded="md"
                >
                  <Text fontSize="xs" color={textColor} textAlign="center">
                    {t('gas.dateRange.last90') || 'Last 90 days'}
                  </Text>
                </Pressable>
              </VStack>
            </VStack>
          </VStack>

          {/* Button group for date range modal */}
          <HStack space={3} w="full" mt={4}>
            <Pressable
              flex={1}
              onPress={() => {
                setCustomStartDate(null);
                setCustomEndDate(null);
                setShowDateRangePicker(false);
              }}
              bg={filterBg}
              py={3}
              rounded="lg"
              alignItems="center"
            >
              <Text fontSize="sm" fontWeight="600" color={textColor}>
                {t('common.clear')}
              </Text>
            </Pressable>
            <Pressable
              flex={1}
              onPress={() => setShowDateRangePicker(false)}
              bg={fabBg}
              py={3}
              rounded="lg"
              alignItems="center"
            >
              <Text fontSize="sm" fontWeight="600" color="white">
                {t('common.save') || 'Apply'}
              </Text>
            </Pressable>
          </HStack>
        </VStack>
      </BottomSheetModal>

      {/* Start Date Picker */}
      {showStartPicker && (
        <DateTimePicker
          value={customStartDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selectedDate) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (selectedDate) {
              setCustomStartDate(selectedDate);
            }
          }}
        />
      )}

      {/* End Date Picker */}
      {showEndPicker && (
        <DateTimePicker
          value={customEndDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selectedDate) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (selectedDate) {
              setCustomEndDate(selectedDate);
            }
          }}
        />
      )}
    </Box>
  );
};
