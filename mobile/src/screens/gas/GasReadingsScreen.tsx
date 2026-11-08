import React, { useState } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import { FlatList, RefreshControl, Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  useColorModeValue,
  Pressable,
  useToast,
} from '../../components/ui/nativewind';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/client';
import { useErrorHandler } from '../../services/api/error.handler';
import { useTranslation } from '../../hooks/useTranslation';
import { GasReadingCard } from '../../components/gas/GasReadingCard';
import { GasForm } from '../../components/gas/GasForm';

import { useTokens } from '../../ui/theme';
import { formatDate, formatInteger, formatNumber, formatShortDate } from '../../utils/format';
import { space } from '../../theme/tokens';
import { SecureStorage } from '../../services/storage/SecureStorage';
import {
  Button,
  EmptyState,
  MonoLabel,
  MonoMeta,
  Panel,
  PanelRow,
  Readout,
  Screen,
  ScreenHeader,
  Sheet,
  FilterMenuTrigger,
  FilterMenuOptions,
  SkeletonRows,
} from '../../ui';
// MO2-16 (MO-020): dijeljeni servis za direktorij preuzetih dokumenata, da
// postavke i ovaj ekran čiste ISTU putanju.
import {
  getDownloadsDirectory,
  purgeDownloadsDirectory,
} from '../../services/storage/downloadCache';

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

type GasReadingsScreenProps = {
  /**
   * F1 (nalaz UX-03): Plin više nije ugniježđeni tab navigator, pa traku
   * „Očitanja | Analiza" ovdje prosljeđuje `GasScreen` i ona se renderuje u
   * zaglavlju ekrana — jedna traka, jedan nivo navigacije.
   */
  headerSlot?: React.ReactNode;
  /** Otvara Analizu iz zaglavlja (prije je to bio drugi tab bar). */
  onOpenAnalysis?: () => void;
};

const GasReadingsScreenContent: React.FC<GasReadingsScreenProps> = ({
  headerSlot,
  onOpenAnalysis,
}) => {
  const route = useRoute<RouteProp<any, 'GasReadings'>>();
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * F6 (GAS-11): podrazumijevani filter je bio „zadnja sedmica", pa je ekran
   * čije je ime „Očitanja" otvarao PRAZNU listu svakom korisniku koji mjeri
   * brojilo jednom mjesečno — a prazno stanje nije ni nudilo akciju. Očitanja
   * plina su po prirodi rijetka (mjesečno), pa je jedini pošten default „Sve":
   * korisnik odmah vidi svoje podatke, a period sužava svjesno.
   */
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'year' | 'all' | 'custom'>(
    'all'
  );
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  // F4 (UX-19): izbor akcije za sliku brojila ide kroz sheet, ne kroz sistemski dijalog.
  const [meterImageReading, setMeterImageReading] = useState<GasReading | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { showError } = useErrorHandler();
  const { t } = useTranslation();
  const { t: tokens } = useTokens();

  // Handle deep link to open add modal
  React.useEffect(() => {
    if (route.params?.openAddModal) {
      setShowAddModal(true);
    }
  }, [route.params?.openAddModal]);

  /**
   * MO2-16 (MO-020): čišćenje preuzetih dokumenata pri ulasku na ekran.
   *
   * Prije ove izmjene fakture i slike brojila su se preuzimale u
   * `${cacheDirectory}downloads/` i tamo ostajale TRAJNO — `openLocalFile` je
   * bio zadnja operacija, `deleteAsync` se nije pojavljivao nigdje u fajlu.
   *
   * NAMJERNO se ne briše odmah nakon otvaranja: `startActivityAsync` se
   * rezolvira čim se vanjski preglednik POKRENE, ne kad završi s čitanjem, pa bi
   * trenutno brisanje korisniku slomilo pregled dokumenta. Čišćenje pri mountu
   * daje isti sigurnosni rezultat (ništa ne preživi sesiju) bez te utrke.
   *
   * Greška se namjerno guta: čišćenje cachea je održavanje, a ne funkcionalnost,
   * pa neuspjeh ne smije spriječiti prikazivanje očitavanja.
   */
  React.useEffect(() => {
    purgeDownloadsDirectory().catch(() => {
      /* best-effort */
    });
  }, []);

  /**
   * F7 (GAS-FILTER): opcije filtera na jednom mjestu — troše ih i meni i
   * sažetak iznad liste. Ranije su bile duplirane (pet pilula + pet `if`
   * grana u sažetku), pa se labela mogla razići između dva mjesta.
   */
  const filterOptions = [
    { value: 'week' as const, label: t('gas.filterLastWeek') },
    { value: 'month' as const, label: t('gas.filterMonth') },
    { value: 'year' as const, label: t('gas.filterYear') },
    { value: 'all' as const, label: t('gas.filterAll') },
    { value: 'custom' as const, label: t('gas.filterCustom') },
  ];

  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'dark.700');
  const filterBg = useColorModeValue('gray.200', 'gray.700');

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
      showError(queryError, t('gas.loadError'));
    }
  }, [queryError, showError, t]);

  const addMutation = useMutation({
    mutationFn: (data: {
      counterValue: number;
      readingDate: string;
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
              {t('gas.addedSuccess')}
            </Text>
          </Box>
        ),
        duration: 2000,
        placement: 'top',
      });
    },
    onError: (error: any) => {
      showError(error, t('gas.addError'));
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
              {t('gas.deleteSuccess')}
            </Text>
          </Box>
        ),
        duration: 2000,
        placement: 'top',
      });
    },
    onError: (error: any) => {
      showError(error, t('gas.deleteError'));
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
      showError(error, t('gas.referenceError'));
    },
  });

  const meterImageUploadMutation = useMutation({
    mutationFn: (payload: {
      id: number;
      meterImage: { uri: string; name?: string; type?: string };
    }) => apiClient.uploadGasMeterImage(payload.id, payload.meterImage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      toast.show({
        render: () => (
          <Box bg="green.500" px={3} py={2} rounded="md" mb={2}>
            <Text color="white" fontSize="sm">
              {t('gas.meterImageUploaded')}
            </Text>
          </Box>
        ),
        duration: 2000,
        placement: 'top',
      });
    },
    onError: (error: any) => {
      showError(error, t('gas.meterImageUploadError'));
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
              {t('gas.invoiceUploaded')}
            </Text>
          </Box>
        ),
        duration: 2000,
        placement: 'top',
      });
    },
    onError: (error: any) => {
      showError(error, t('gas.invoiceUploadError'));
    },
  });

  const invoiceDeleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteGasInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
    onError: (error: any) => {
      showError(error, t('gas.invoiceDeleteError'));
    },
  });

  const sanitizeFileName = (name: string) =>
    name.replace(/[^a-zA-Z0-9._-]/g, '_');

  const sanitizeBaseName = (name: string) => {
    const cleaned = sanitizeFileName(name);
    const dotIndex = cleaned.lastIndexOf('.');
    if (dotIndex <= 0) {
      return cleaned;
    }
    return cleaned.slice(0, dotIndex);
  };

  const getHeaderValue = (
    headers: Record<string, string> | undefined,
    headerName: string,
  ) => {
    if (!headers) return undefined;
    const entry = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === headerName.toLowerCase(),
    );
    return entry?.[1];
  };

  const extensionFromMime = (mimeType?: string) => {
    if (!mimeType) return '';
    const normalized = mimeType.split(';')[0].trim().toLowerCase();
    if (normalized === 'image/jpeg') return '.jpg';
    if (normalized === 'image/png') return '.png';
    if (normalized === 'image/webp') return '.webp';
    if (normalized === 'application/pdf') return '.pdf';
    return '';
  };

  const isSupportedFileMime = (mimeType?: string) => {
    if (!mimeType) return false;
    const normalized = mimeType.split(';')[0].trim().toLowerCase();
    return (
      normalized === 'image/jpeg' ||
      normalized === 'image/png' ||
      normalized === 'image/webp' ||
      normalized === 'application/pdf'
    );
  };

  const mimeFromExtension = (extension?: string) => {
    if (!extension) return undefined;
    const normalized = extension.toLowerCase();
    if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
    if (normalized === '.png') return 'image/png';
    if (normalized === '.webp') return 'image/webp';
    if (normalized === '.pdf') return 'application/pdf';
    return undefined;
  };

  const extensionFromContentDisposition = (contentDisposition?: string) => {
    if (!contentDisposition) return '';
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    const fileName = match?.[1];
    if (!fileName) return '';
    const extMatch = fileName.match(/(\.[a-zA-Z0-9]+)$/);
    return extMatch?.[1]?.toLowerCase();
  };

  const extensionFromFileName = (fileName?: string) => {
    if (!fileName) return '';
    const safeName = sanitizeFileName(fileName);
    const extMatch = safeName.match(/(\.[a-zA-Z0-9]+)$/);
    return extMatch?.[1]?.toLowerCase();
  };

  const openLocalFile = async (fileUri: string, mimeType?: string) => {
    if (Platform.OS === 'android') {
      const contentUri = await FileSystemLegacy.getContentUriAsync(fileUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: mimeType || undefined,
        flags: 1,
      });
      return;
    }

    await Linking.openURL(fileUri);
  };

  const openProtectedFile = async (url: string, fallbackName: string) => {
    const token = await SecureStorage.getToken();
    if (!token) {
      throw new Error('Authentication token missing');
    }

    // MO2-16 (MO-020): putanja dolazi iz dijeljenog servisa, a ne sastavlja se
    // ovdje. Da je svako mjesto gradi samo, „Clear cache" u postavkama bi mogao
    // brisati drugi direktorij nego što ovaj ekran puni.
    const downloadsDirectory = await getDownloadsDirectory();
    if (!downloadsDirectory) {
      throw new Error('No local storage directory available for downloads');
    }
    const directoryInfo = await FileSystemLegacy.getInfoAsync(downloadsDirectory);
    if (!directoryInfo.exists) {
      await FileSystemLegacy.makeDirectoryAsync(downloadsDirectory, {
        intermediates: true,
      });
    }

    const fallbackBase = sanitizeBaseName(fallbackName);
    const fallbackExtension = extensionFromFileName(fallbackName);
    const prefix = `${Date.now()}-${fallbackBase}`;
    const tempFileUri = `${downloadsDirectory}${prefix}.download`;

    const downloaded = await FileSystemLegacy.downloadAsync(url, tempFileUri, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (downloaded.status < 200 || downloaded.status >= 300) {
      throw new Error(`Download failed with status ${downloaded.status}`);
    }

    const contentDisposition = getHeaderValue(
      downloaded.headers,
      'content-disposition',
    );
    const contentType = getHeaderValue(downloaded.headers, 'content-type');
    const resolvedExtension =
      extensionFromContentDisposition(contentDisposition) ||
      extensionFromMime(contentType) ||
      fallbackExtension;
    const resolvedMimeType =
      (isSupportedFileMime(contentType) ? contentType : undefined) ||
      mimeFromExtension(resolvedExtension);
    if (!resolvedMimeType) {
      throw new Error(
        `Unexpected downloaded content type: ${contentType}`,
      );
    }
    const finalFileUri = `${downloadsDirectory}${prefix}${resolvedExtension}`;

    if (finalFileUri !== downloaded.uri) {
      await FileSystemLegacy.moveAsync({
        from: downloaded.uri,
        to: finalFileUri,
      });
    }

    await openLocalFile(finalFileUri, resolvedMimeType);
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
          name: asset.name,
          type: asset.mimeType,
        },
      });
    } catch (error: any) {
      showError(error, t('gas.invoiceUploadError'));
    }
  };

  const handleOpenMeterImage = async (reading: GasReading) => {
    try {
      await openProtectedFile(
        apiClient.getGasMeterImageEndpoint(reading.id),
        `meter-${reading.id}`,
      );
    } catch (error: any) {
      showError(error, t('gas.meterImageOpenError'));
    }
  };

  const handleOpenInvoice = async (reading: GasReading) => {
    try {
      await openProtectedFile(
        apiClient.getGasInvoiceEndpoint(reading.id),
        `invoice-${reading.id}.pdf`,
      );
    } catch (error: any) {
      showError(error, t('gas.invoiceOpenError'));
    }
  };

  const toUploadMeterImage = (asset: ImagePicker.ImagePickerAsset) => {
    const fallbackExtension = asset.mimeType?.startsWith('image/')
      ? asset.mimeType.replace('image/', '')
      : 'jpg';

    return {
      uri: asset.uri,
      name: asset.fileName || `meter-${Date.now()}.${fallbackExtension}`,
      type: asset.mimeType,
    };
  };

  const pickMeterImageFromGallery = async (reading: GasReading) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(t('gas.imagePermissionDenied'));
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    await meterImageUploadMutation.mutateAsync({
      id: reading.id,
      meterImage: toUploadMeterImage(result.assets[0]),
    });
  };

  const captureMeterImage = async (reading: GasReading) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error(t('gas.cameraPermissionDenied'));
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    await meterImageUploadMutation.mutateAsync({
      id: reading.id,
      meterImage: toUploadMeterImage(result.assets[0]),
    });
  };

  /**
   * F4 (UX-19): jedini sistemski dijalog u aplikaciji zamijenjen je istim
   * `Sheet`-om koji nose sve ostale potvrde — ista vizuelna gramatika, isti
   * jezik i ista a11y pravila.
   */
  const handleUploadMeterImage = (reading: GasReading) => {
    setMeterImageReading(reading);
  };

  const handlePickFromGallery = () => {
    const reading = meterImageReading;
    setMeterImageReading(null);
    if (!reading) return;
    void pickMeterImageFromGallery(reading).catch((error) =>
      showError(error, t('gas.meterImageUploadError')),
    );
  };

  const handleTakePhoto = () => {
    const reading = meterImageReading;
    setMeterImageReading(null);
    if (!reading) return;
    void captureMeterImage(reading).catch((error) =>
      showError(error, t('gas.meterImageUploadError')),
    );
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

  // MO2-13: virtualized list item renderer with stable keys.
  const renderReadingItem = ({ item, index }: { item: GasReading; index: number }) => (
    <GasReadingCard
      reading={item}
      previousReading={index > 0 ? filteredReadings[index - 1] : undefined}
      onDelete={() => deleteMutation.mutate(item.id)}
      onToggleReference={(reading, isReference) =>
        referenceMutation.mutate({ id: reading.id, isReference })
      }
      onUploadMeterImage={handleUploadMeterImage}
      onUploadInvoice={handleUploadInvoice}
      onDeleteInvoice={(reading) => invoiceDeleteMutation.mutate(reading.id)}
      onOpenMeterImage={handleOpenMeterImage}
      onOpenInvoice={handleOpenInvoice}
      isDeleting={deleteMutation.isPending && deleteMutation.variables === item.id}
      isMutating={
        referenceMutation.isPending ||
        meterImageUploadMutation.isPending ||
        invoiceUploadMutation.isPending ||
        invoiceDeleteMutation.isPending
      }
    />
  );

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader
          title={t('gas.title')}
          action={
            onOpenAnalysis
              ? {
                  icon: 'stats-chart-outline',
                  label: t('navigation.analysis'),
                  onPress: onOpenAnalysis,
                }
              : undefined
          }
          testID="gas-readings-header"
        />
        {/* F4 (UX-07): skeleton u footprintu liste, umjesto ekrana koji nestane. */}
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md }}>
          <SkeletonRows count={5} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('gas.title')}
        subtitle={t('gas.subtitle')}
        action={{
          icon: 'add',
          label: t('gas.addReading'),
          onPress: () => setShowAddModal(true),
        }}
        testID="gas-readings-header"
      />
      <FlatList
        style={{ flex: 1 }}
        data={filteredReadings}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderReadingItem}
        ListHeaderComponent={
          <VStack space={4} mb={4} px={4} pt={2}>
            {/* F1: sekcijska traka (Očitanja | Analiza) iz GasScreen-a */}
            {headerSlot}

            {/* Sažetak iznad liste (prototip §04): mjesec, potrošnja, broj zapisa */}
            <Panel variant="flush" padded={false} testID="gas-summary">
              <PanelRow divider={false}>
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <MonoLabel>
                      {dateFilter === 'week'
                        ? t('gas.filterLastWeek')
                        : dateFilter === 'month'
                          ? t('gas.summaryMonth')
                          : dateFilter === 'year'
                            ? t('gas.filterYear')
                            : dateFilter === 'custom'
                              ? t('gas.filterCustom')
                              : t('gas.filterAll')}
                    </MonoLabel>
                    <Readout
                      value={formatNumber(periodConsumption)}
                      unit="m³"
                      size="md"
                      tone="ink"
                      testID="gas-period-consumption"
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <MonoLabel>{t('gas.totalReadings')}</MonoLabel>
                    <Readout
                      value={formatInteger(filteredReadings.length)}
                      size="md"
                      tone="muted"
                      testID="gas-readings-count"
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <MonoLabel>{t('gas.lastReading')}</MonoLabel>
                    <MonoMeta>
                      {filteredReadings.length > 0
                        ? formatShortDate(filteredReadings[0].readingDate)
                        : '—'}
                    </MonoMeta>
                  </View>
                </View>
              </PanelRow>
            </Panel>

            {/*
              F7 (GAS-FILTER): pet pilula je zamijenjeno jednim menijem.
              Razlozi su u `ui/FilterMenu.tsx`: pilule su izgledale kao drugi
              red tabova, tražile su ~150 px visine prije prvog očitanja i
              nijedna nije izgledala kao kontrola koja otvara listu. Sada red
              kaže IZABRANI period („Period: Sve ⌄") i otvara `Sheet` sa radio
              listom. „Raspon" je i dalje opcija u listi i otvara birač datuma.
            */}
            <FilterMenuTrigger
              label={t('gas.period')}
              value={dateFilter}
              options={filterOptions}
              onPress={() => setShowFilterMenu(true)}
              testID="gas-filter-menu"
            />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <MonoLabel>{t('gas.readings')}</MonoLabel>
              <MonoMeta>{t('gas.readingCount', { count: filteredReadings.length })}</MonoMeta>
            </View>
          </VStack>
        }
        /*
          F6 (GAS-10): prazno stanje je samo TEKST — „nema očitanja u periodu,
          probaj drugi period" — bez ijedne akcije. Korisnik koji je došao prvi
          put nema pojma gdje se dodaje očitanje, a jedini put iz stanja je
          pogađanje. Sada nudi stvarnu akciju: „Dodaj očitanje" (otvara sheet
          koji već postoji), a kad zapisa ima ali filter ništa ne vraća, nudi
          povratak na „Sve".
        */
        ListEmptyComponent={
          readings.length === 0 ? (
            <EmptyState
              icon="document-outline"
              title={t('gas.noReadings')}
              message={t('gas.noReadingsBody')}
              action={{ label: t('gas.addReading'), onPress: () => setShowAddModal(true) }}
              style={{ paddingVertical: space.xl }}
            />
          ) : (
            <EmptyState
              icon="funnel-outline"
              title={t('gas.noReadingsInPeriod')}
              message={t('gas.tryOtherPeriod')}
              action={{ label: t('gas.filterAll'), onPress: () => setDateFilter('all') }}
              style={{ paddingVertical: space.xl }}
            />
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing || isFetching} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={undefined}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/*
        F7 (GAS-FILTER): lista filtera kao `Sheet` — isti primitiv kao svaka
        druga odluka u aplikaciji, sa 48 px visokim radio redovima.
      */}
      <Sheet
        isOpen={showFilterMenu}
        onClose={() => setShowFilterMenu(false)}
        title={t('gas.period')}
        closeLabel={t('common.close')}
        snapPoints={['45%', '70%']}
        scrollable
        testID="gas-filter-sheet"
      >
        <FilterMenuOptions
          value={dateFilter}
          options={filterOptions}
          onSelect={(next) => {
            setShowFilterMenu(false);
            if (next === 'custom') {
              setDateFilter('custom');
              setShowDateRangePicker(true);
              return;
            }
            setDateFilter(next);
          }}
        />
      </Sheet>

      {/* Add Reading Modal */}
      {/* F4 (UX-14): isti `Sheet` primitiv kao na Početnoj — naslov u zaglavlju,
          animirano zatvaranje i X sa labelom iz `t()`. */}
      <Sheet
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('gas.addReading')}
        closeLabel={t('common.close')}
        snapPoints={['75%', '95%']}
        scrollable
        testID="gas-add-sheet"
      >
        <GasForm
          onSubmit={addMutation.mutateAsync}
          isLoading={addMutation.isPending}
          onCancel={() => setShowAddModal(false)}
          existingReadings={readings}
        />
      </Sheet>

      {/* F4 (UX-19): akcije za sliku brojila — sheet umjesto sistemskog dijaloga. */}
      <Sheet
        isOpen={meterImageReading !== null}
        onClose={() => setMeterImageReading(null)}
        title={t('gas.meterImageActionTitle')}
        closeLabel={t('common.close')}
        snapPoints={['40%']}
        testID="gas-meter-image-sheet"
      >
        <VStack space={3}>
          <Text fontSize="sm" color={textColor}>
            {t('gas.meterImageActionPrompt')}
          </Text>
          <Button label={t('gas.selectImage')} block onPress={handlePickFromGallery} />
          <Button
            label={t('gas.takePhoto')}
            variant="secondary"
            block
            onPress={handleTakePhoto}
          />
          <Button
            label={t('common.cancel')}
            variant="ghost"
            block
            onPress={() => setMeterImageReading(null)}
          />
        </VStack>
      </Sheet>

      {/* Date Range Picker Modal */}
      <Sheet
        isOpen={showDateRangePicker}
        onClose={() => setShowDateRangePicker(false)}
        title={t('gas.dateRange.title')}
        closeLabel={t('common.close')}
        snapPoints={['60%', '85%']}
        scrollable
        testID="gas-date-range-sheet"
      >
        <VStack space={4}>
          <VStack space={4}>
            {/* Start Date */}
            <Box>
              <Text fontSize="sm" fontWeight="600" color={textColor} mb={2}>
                {t('gas.dateRange.startDate')}
              </Text>
              <Pressable
                onPress={() => setShowStartPicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`${t('gas.dateRange.startDate')}: ${
                  customStartDate
                    ? formatDate(customStartDate)
                    : t('gas.dateRange.selectStart')
                }`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                      ? formatDate(customStartDate)
                      : t('gas.dateRange.selectStart')}
                  </Text>
                  <Icon as={Ionicons} name="calendar" size={5} color={subtextColor} />
                </HStack>
              </Pressable>
            </Box>

            {/* End Date */}
            <Box>
              <Text fontSize="sm" fontWeight="600" color={textColor} mb={2}>
                {t('gas.dateRange.endDate')}
              </Text>
              <Pressable
                onPress={() => setShowEndPicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`${t('gas.dateRange.endDate')}: ${
                  customEndDate ? formatDate(customEndDate) : t('gas.dateRange.selectEnd')
                }`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                      ? formatDate(customEndDate)
                      : t('gas.dateRange.selectEnd')}
                  </Text>
                  <Icon as={Ionicons} name="calendar" size={5} color={subtextColor} />
                </HStack>
              </Pressable>
            </Box>

            {/* Quick Presets */}
            <VStack space={2}>
              <Text fontSize="xs" fontWeight="600" color={mutedColor} mb={1}>
                {t('gas.dateRange.quickPresets')}
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
                    accessibilityRole="button"
                    accessibilityLabel={t('gas.dateRange.last30')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text fontSize="xs" color={textColor} textAlign="center">
                      {t('gas.dateRange.last30')}
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
                    accessibilityRole="button"
                    accessibilityLabel={t('gas.dateRange.last60')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text fontSize="xs" color={textColor} textAlign="center">
                      {t('gas.dateRange.last60')}
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
                  accessibilityRole="button"
                  accessibilityLabel={t('gas.dateRange.last90')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text fontSize="xs" color={textColor} textAlign="center">
                    {t('gas.dateRange.last90')}
                  </Text>
                </Pressable>
              </VStack>
            </VStack>
          </VStack>

          {/* Button group for date range modal */}
          <HStack space={3} w="full" mt={4}>
            <Pressable
              flex={1}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setShowDateRangePicker(false)}
              bg={tokens.signal}
              py={3}
              rounded="lg"
              alignItems="center"
            >
              <Text fontSize="sm" fontWeight="600" color={tokens.onSignal}>
                {t('common.save')}
              </Text>
            </Pressable>
          </HStack>
        </VStack>
      </Sheet>

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
    </Screen>
  );
};

export const GasReadingsScreen = GasReadingsScreenContent;
