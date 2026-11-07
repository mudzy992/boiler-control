import { useState } from 'react';
import { RefreshControl } from 'react-native';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  useColorModeValue,
  Button,
  ScrollView,
  Icon,
  Pressable,
  Badge,
  Modal,
  FormControl,
  useToast,
  Select,
  CheckIcon,
  Checkbox,
  Slider,
} from '../../components/ui/nativewind';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homeProfileApi } from '../../services/api/homeProfile.api';
import { FormInput } from '../../components/FormInput';
import {
  InsulationType,
  WindowType,
  HeatingType,
  SeasonMode,
  INSULATION_TYPE_OPTIONS,
  WINDOW_TYPE_OPTIONS,
  HEATING_TYPE_OPTIONS,
  SEASON_MODE_OPTIONS,
} from '../../constants/homeProfileEnums';
import { AxiosError } from 'axios';
import { homeProfileToForm } from './homeProfileForm';
import { useTranslation } from '../../hooks/useTranslation';
import { Screen, ScreenHeader } from '../../ui';


/**
 * F1: prije su `*_TYPE_OPTIONS` nosili engleske labele direktno iz
 * `constants/homeProfileEnums.ts`. Enum vrijednosti su ugovor s backendom i ne
 * mijenjaju se — mijenja se samo prikaz, preko ključa u `homeProfile.*`.
 */
const INSULATION_LABEL_KEY: Record<string, string> = {
  STANDARD: 'standard',
  EPS: 'eps',
  MINERAL_WOOL: 'mineralWool',
  ADVANCED: 'advanced',
};

const WINDOW_LABEL_KEY: Record<string, string> = {
  SINGLE_GLAZED: 'singleGlazed',
  DOUBLE_GLAZED: 'doubleGlazed',
  TRIPLE_GLAZED: 'tripleGlazed',
};

const HEATING_LABEL_KEY: Record<string, string> = {
  RADIATOR: 'radiator',
  UNDERFLOOR: 'underfloor',
  MIXED: 'mixed',
};

const SEASON_LABEL_KEY: Record<string, string> = {
  WINTER: 'winter',
  SUMMER: 'summer',
  AUTO: 'summer',
};

interface HomeProfile {
  id: number;
  name?: string | null;
  location?: string | null;
  isActive: boolean;
  thermostats: number;
  createdAt: string;
}

// Move all hooks to top level BEFORE any state initialization
const useHomeManagementScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedHome, setSelectedHome] = useState<HomeProfile | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  const queryClient = useQueryClient();
  const toast = useToast();

  return {
    t,
    navigation,
    showAddModal,
    setShowAddModal,
    showEditModal,
    setShowEditModal,
    selectedHome,
    setSelectedHome,
    cardBg,
    borderColor,
    textColor,
    subtextColor,
    queryClient,
    toast,
  };
};

const HomeManagementScreenContent = () => {
  const {
    t,
    navigation,
    showAddModal,
    setShowAddModal,
    showEditModal,
    setShowEditModal,
    selectedHome,
    setSelectedHome,
    cardBg,
    borderColor,
    textColor,
    subtextColor,
    queryClient,
    toast,
  } = useHomeManagementScreen();

  const [formData, setFormData] = useState({
    homeName: '',
    location: '',
    floorArea: 100,
    ceilingHeight: 2.6,
    insulationType: InsulationType.STANDARD,
    insulationThickness: 12,
    windowType: WindowType.DOUBLE_GLAZED,
    heatingType: HeatingType.RADIATOR,
    constructionYear: new Date().getFullYear(),
    hasFloorHeating: false,
    targetMorningTemp: 22,
    targetDayTemp: 20,
    targetNightTemp: 18,
    numberOfResidents: 2,
    boilerModel: '',
    seasonMode: SeasonMode.WINTER,
  });

  const resetForm = () =>
    setFormData({
      homeName: '',
      location: '',
      floorArea: 100,
      ceilingHeight: 2.6,
      insulationType: InsulationType.STANDARD,
      insulationThickness: 12,
      windowType: WindowType.DOUBLE_GLAZED,
      heatingType: HeatingType.RADIATOR,
      constructionYear: new Date().getFullYear(),
      hasFloorHeating: false,
      targetMorningTemp: 22,
      targetDayTemp: 20,
      targetNightTemp: 18,
      numberOfResidents: 2,
      boilerModel: '',
      seasonMode: SeasonMode.WINTER,
    });

  const validateForm = () => {
    // F1: poruke su prije bile engleski literali; sada ključevi koje već ima
    // `homeProfile.form` blok u oba jezika.
    if (!formData.homeName.trim()) return t('homeProfile.form.homeNameRequired');
    if (formData.location && formData.location.length > 120)
      return t('homeProfile.form.locationTooLong');
    if (formData.floorArea < 10 || formData.floorArea > 2000)
      return t('homeProfile.form.floorAreaRange');
    if (formData.ceilingHeight < 1.8 || formData.ceilingHeight > 5)
      return t('homeProfile.form.ceilingHeightRange');
    if (formData.constructionYear < 1900 || formData.constructionYear > 2100)
      return t('homeProfile.form.constructionYearRange');
    if (formData.numberOfResidents < 1 || formData.numberOfResidents > 20)
      return t('homeProfile.form.residentsRange');
    if (formData.insulationThickness < 5 || formData.insulationThickness > 30)
      return t('homeProfile.form.insulationThicknessRange');
    const temps = [formData.targetMorningTemp, formData.targetDayTemp, formData.targetNightTemp];
    if (temps.some((v) => v < 5 || v > 30)) return t('homeProfile.form.temperatureRange');
    return null;
  };

  const getErrorMessage = (err: unknown) => {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as AxiosError<any>;
      const msg = axiosErr.response?.data?.message;
      if (Array.isArray(msg)) return msg.join(', ');
      if (typeof msg === 'string') return msg;
    }
    if (err instanceof Error) return err.message;
    return t('homeManagement.genericError');
  };

  // Fetch home profiles
  const {
    data: homes = [],
    isLoading,
    isRefetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['homeProfiles'],
    queryFn: homeProfileApi.getAllHomeProfiles,
  });

  // Switch active home
  const switchHomeMutation = useMutation({
    mutationFn: (homeId: number) => homeProfileApi.switchActiveHome(homeId),
    onMutate: async (homeId: number) => {
      await queryClient.cancelQueries({ queryKey: ['homeProfiles'] });
      const previousHomes = queryClient.getQueryData<HomeProfile[]>(['homeProfiles']);
      if (previousHomes) {
        queryClient.setQueryData<HomeProfile[]>(
          ['homeProfiles'],
          previousHomes.map((h) => ({ ...h, isActive: h.id === homeId }))
        );
      }
      return { previousHomes };
    },
    onError: (err, _homeId, context) => {
      if (context?.previousHomes) {
        queryClient.setQueryData(['homeProfiles'], context.previousHomes);
      }
      toast.show({ description: getErrorMessage(err), placement: 'top' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['activeHomeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.show({
        description: t('homeManagement.homeSwitched'),
        placement: 'top',
      });
    },
  });

  // Create home
  const createHomeMutation = useMutation({
    mutationFn: homeProfileApi.createHomeProfile,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['homeProfiles'] });
      const previousHomes = queryClient.getQueryData<HomeProfile[]>(['homeProfiles']);
      const optimisticId = Date.now() * -1;
      const optimisticHome: HomeProfile = {
        id: optimisticId,
        name: data.homeName,
        location: data.location || '',
        isActive: previousHomes?.some((h) => h.isActive) ? false : true,
        thermostats: 0,
        createdAt: new Date().toISOString(),
      } as HomeProfile;

      if (previousHomes) {
        queryClient.setQueryData<HomeProfile[]>(
          ['homeProfiles'],
          [...previousHomes, optimisticHome]
        );
      }

      return { previousHomes };
    },
    onError: (err, _data, context) => {
      if (context?.previousHomes) {
        queryClient.setQueryData(['homeProfiles'], context.previousHomes);
      }
      toast.show({ description: getErrorMessage(err), placement: 'top' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['activeHomeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowAddModal(false);
      resetForm();
      toast.show({
        description: t('homeManagement.homeAdded'),
        placement: 'top',
      });
    },
  });

  // Update home
  const updateHomeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      homeProfileApi.updateHomeProfile(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['homeProfiles'] });
      const previousHomes = queryClient.getQueryData<HomeProfile[]>(['homeProfiles']);
      if (previousHomes) {
        queryClient.setQueryData<HomeProfile[]>(
          ['homeProfiles'],
          previousHomes.map((h) =>
            h.id === id
              ? {
                  ...h,
                  ...data,
                  name: data.homeName ?? h.name,
                  location: data.location ?? h.location,
                }
              : h
          )
        );
      }
      return { previousHomes };
    },
    onError: (err, _payload, context) => {
      if (context?.previousHomes) {
        queryClient.setQueryData(['homeProfiles'], context.previousHomes);
      }
      toast.show({ description: getErrorMessage(err), placement: 'top' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['activeHomeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowEditModal(false);
      setSelectedHome(null);
      resetForm();
      toast.show({
        description: t('homeManagement.homeUpdated'),
        placement: 'top',
      });
    },
  });

  // Delete home
  const deleteHomeMutation = useMutation({
    mutationFn: (homeId: number) => homeProfileApi.deleteHomeProfile(homeId),
    onMutate: async (homeId: number) => {
      await queryClient.cancelQueries({ queryKey: ['homeProfiles'] });
      const previousHomes = queryClient.getQueryData<HomeProfile[]>(['homeProfiles']);
      if (previousHomes) {
        queryClient.setQueryData<HomeProfile[]>(
          ['homeProfiles'],
          previousHomes.filter((h) => h.id !== homeId)
        );
      }
      return { previousHomes };
    },
    onError: (err, _id, context) => {
      if (context?.previousHomes) {
        queryClient.setQueryData(['homeProfiles'], context.previousHomes);
      }
      toast.show({ description: getErrorMessage(err), placement: 'top' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['activeHomeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.show({
        description: t('homeManagement.homeDeleted'),
        placement: 'top',
      });
    },
  });

  const anyMutationPending =
    switchHomeMutation.isPending ||
    createHomeMutation.isPending ||
    updateHomeMutation.isPending ||
    deleteHomeMutation.isPending;

  const handleAddHome = () => {
    const validationError = validateForm();
    if (validationError) {
      toast.show({ description: validationError, placement: 'top' });
      return;
    }
    if (createHomeMutation.isPending) return;
    createHomeMutation.mutate(formData);
  };

  const handleEditHome = () => {
    if (!selectedHome) return;
    const validationError = validateForm();
    if (validationError) {
      toast.show({ description: validationError, placement: 'top' });
      return;
    }
    if (updateHomeMutation.isPending) return;
    updateHomeMutation.mutate({ id: selectedHome.id, data: formData });
  };

  const handleDeleteHome = (home: HomeProfile) => {
    if (home.isActive) {
      toast.show({
        description: t('homeManagement.cannotDeleteActive'),
        placement: 'top',
      });
      return;
    }
    if (deleteHomeMutation.isPending) return;
    deleteHomeMutation.mutate(home.id);
  };

  const openEditModal = (home: any) => {
    setSelectedHome(home);
    // MO2-20: preserve 0/false/empty-string values; only null/undefined use defaults.
    setFormData(homeProfileToForm(home));
    setShowEditModal(true);
  };

  const HomeCard = ({ home }: { home: HomeProfile }) => (
    <Pressable
      isDisabled={anyMutationPending}
      onPress={() => {
        if (anyMutationPending) return;
        if (!home.isActive) switchHomeMutation.mutate(home.id);
      }}
      _pressed={{ opacity: 0.7 }}
    >
      <Box
        bg={cardBg}
        rounded="xl"
        p={4}
        borderWidth={1}
        borderColor={home.isActive ? 'brand.500' : borderColor}
      >
        <HStack justifyContent="space-between" alignItems="flex-start">
          <VStack flex={1} space={1}>
            <HStack alignItems="center" space={2}>
              <Heading size="md" color={textColor}>
                {home.name ?? ''}
              </Heading>
              {home.isActive && (
                <Badge colorScheme="success" variant="solid">
                  {t('homeManagement.active')}
                </Badge>
              )}
            </HStack>
            <HStack alignItems="center" space={1}>
              <Icon as={Ionicons} name="location-outline" size={4} color={subtextColor} />
              <Text fontSize="sm" color={subtextColor}>
                {home.location ?? ''}
              </Text>
            </HStack>
            <HStack alignItems="center" space={1} mt={1}>
              <Icon as={Ionicons} name="thermometer-outline" size={4} color={subtextColor} />
              <Text fontSize="sm" color={subtextColor}>
                {t('homeManagement.thermostatCount', { count: home.thermostats })}
              </Text>
            </HStack>
          </VStack>

          <HStack space={2}>
            <Pressable
              onPress={() => openEditModal(home)}
              accessibilityRole="button"
              accessibilityLabel={`${t('homeManagement.edit')}: ${home.name ?? ''}`}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon as={Ionicons} name="create-outline" size={6} color="blue.500" />
            </Pressable>
            {!home.isActive && (
              <Pressable
                isDisabled={anyMutationPending}
                onPress={() => handleDeleteHome(home)}
                accessibilityRole="button"
                accessibilityLabel={`${t('homeManagement.delete')}: ${home.name ?? ''}`}
                accessibilityState={{ disabled: Boolean(anyMutationPending) }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon as={Ionicons} name="trash-outline" size={6} color="red.500" />
              </Pressable>
            )}
          </HStack>
        </HStack>
      </Box>
    </Pressable>
  );

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('homeManagement.title')}
        subtitle={t('homeManagement.subtitle')}
        onBack={() => (navigation as any).goBack()}
        backLabel={t('common.back')}
        testID="home-management-header"
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={Boolean(isRefetching)}
            // RN 0.88: `onRefresh` mora vratiti `void | Promise<void>`, a
            // React Query `refetch()` vraca rezultat — namjerno se odbacuje.
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      >
        <VStack px={4} py={4} space={4}>
          <HStack justifyContent="flex-end" alignItems="center">
            <Button
              onPress={() => setShowAddModal(true)}
              leftIcon={<Icon as={Ionicons} name="add-circle-outline" />}
              size="sm"
              isDisabled={anyMutationPending}
              isLoading={isRefetching}
            >
              {t('homeManagement.addHome')}
            </Button>
          </HStack>

          {isLoading ? (
            <Text color={subtextColor}>{t('homeManagement.loading')}</Text>
          ) : isError ? (
            <Box bg={cardBg} rounded="xl" p={6} alignItems="center" justifyContent="center">
              <Icon as={Ionicons} name="alert-circle-outline" size={10} color="red.500" mb={2} />
              <Text fontSize="md" color={textColor} textAlign="center" mb={1}>
                {t('homeManagement.loadErrorTitle')}
              </Text>
              <Text fontSize="sm" color={subtextColor} textAlign="center" mb={3}>
                {error instanceof Error ? error.message : t('homeManagement.loadErrorBody')}
              </Text>
              <Button onPress={() => refetch()} size="sm" variant="outline">
                {t('homeManagement.retry')}
              </Button>
            </Box>
          ) : (
            <VStack space={3}>
              {homes && homes.length > 0 ? (
                (homes as unknown as HomeProfile[]).map((home: HomeProfile) => (
                  <HomeCard key={home.id} home={home} />
                ))
              ) : (
                <Box bg={cardBg} rounded="xl" p={8} alignItems="center" justifyContent="center">
                  <Icon as={Ionicons} name="home-outline" size={16} color={subtextColor} mb={2} />
                  <Text fontSize="md" color={textColor} textAlign="center">
                    {t('homeManagement.noHomesTitle')}
                  </Text>
                  <Text fontSize="sm" color={subtextColor} textAlign="center" mt={1}>
                    {t('homeManagement.noHomesBody')}
                  </Text>
                </Box>
              )}
            </VStack>
          )}
        </VStack>
      </ScrollView>

      {/* Add Home Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} size="full">
        <Modal.Content maxHeight="90%">
          <Modal.CloseButton />
          <Modal.Header>{t('homeManagement.addTitle')}</Modal.Header>
          <Modal.Body>
            <ScrollView>
              <VStack space={4} pb={4}>
                {/* Basic Information */}
                <Heading size="sm" color={textColor}>
                  {t('homeManagement.sectionBasic')}
                </Heading>

                <FormControl>
                  <FormControl.Label>{t('homeManagement.fieldHomeName')}</FormControl.Label>
                  <FormInput
                    placeholder={t('homeProfile.form.homeName')}
                    value={formData.homeName}
                    onChangeText={(text) => setFormData({ ...formData, homeName: text })}
                  />
                </FormControl>

                <FormControl>
                  <FormControl.Label>{t('homeManagement.fieldLocation')}</FormControl.Label>
                  <FormInput
                    placeholder={t('homeProfile.form.location')}
                    value={formData.location}
                    onChangeText={(text) => setFormData({ ...formData, location: text })}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldFloorArea')}</FormControl.Label>
                  <FormInput
                    keyboardType="numeric"
                    placeholder="100"
                    value={String(formData.floorArea)}
                    onChangeText={(text) =>
                      setFormData({ ...formData, floorArea: parseFloat(text) || 0 })
                    }
                  />
                </FormControl>

                <HStack space={2}>
                  <FormControl flex={1}>
                    <FormControl.Label>{t('homeManagement.fieldCeilingHeight')}</FormControl.Label>
                    <FormInput
                      keyboardType="decimal-pad"
                      placeholder="2.6"
                      value={String(formData.ceilingHeight)}
                      onChangeText={(text) =>
                        setFormData({ ...formData, ceilingHeight: parseFloat(text) || 2.6 })
                      }
                    />
                  </FormControl>

                  <FormControl flex={1}>
                    <FormControl.Label>{t('homeManagement.fieldResidents')}</FormControl.Label>
                    <FormInput
                      keyboardType="numeric"
                      placeholder="2"
                      value={String(formData.numberOfResidents)}
                      onChangeText={(text) =>
                        setFormData({ ...formData, numberOfResidents: parseInt(text) || 0 })
                      }
                    />
                  </FormControl>

                  <FormControl flex={1}>
                    <FormControl.Label>{t('homeManagement.fieldBuiltYear')}</FormControl.Label>
                    <FormInput
                      keyboardType="numeric"
                      placeholder="2020"
                      value={String(formData.constructionYear)}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          constructionYear: parseInt(text) || new Date().getFullYear(),
                        })
                      }
                    />
                  </FormControl>
                </HStack>

                {/* Insulation & Structure */}
                <Heading size="sm" color={textColor} mt={2}>
                  Insulation & Windows
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldInsulationType')}</FormControl.Label>
                  <Select
                    selectedValue={formData.insulationType}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, insulationType: value as InsulationType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {INSULATION_TYPE_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        label={t(`homeProfile.insulation.${INSULATION_LABEL_KEY[option.value]}`)}
                        value={option.value}
                      />
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldInsulationThickness')}</FormControl.Label>
                  <Select
                    selectedValue={String(formData.insulationThickness)}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, insulationThickness: parseInt(value) })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    <Select.Item label="10 cm" value="10" />
                    <Select.Item label="12 cm" value="12" />
                    <Select.Item label="15 cm" value="15" />
                    <Select.Item label="20 cm" value="20" />
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldWindowType')}</FormControl.Label>
                  <Select
                    selectedValue={formData.windowType}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, windowType: value as WindowType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {WINDOW_TYPE_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        label={t(`homeProfile.window.${WINDOW_LABEL_KEY[option.value]}`)}
                        value={option.value}
                      />
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldSeasonMode')}</FormControl.Label>
                  <Select
                    selectedValue={formData.seasonMode}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, seasonMode: value as SeasonMode })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {SEASON_MODE_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        label={t(`homeProfile.seasonMode.${SEASON_LABEL_KEY[option.value]}`)}
                        value={option.value}
                      />
                    ))}
                  </Select>
                </FormControl>

                {/* Heating System */}
                <Heading size="sm" color={textColor} mt={2}>
                  {t('homeManagement.sectionHeating')}
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldHeatingType')}</FormControl.Label>
                  <Select
                    selectedValue={formData.heatingType}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, heatingType: value as HeatingType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {HEATING_TYPE_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        label={t(`homeProfile.heatingType.${HEATING_LABEL_KEY[option.value]}`)}
                        value={option.value}
                      />
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <Checkbox
                    value="hasFloorHeating"
                    isChecked={formData.hasFloorHeating}
                    onChange={(value: boolean) => setFormData({ ...formData, hasFloorHeating: value })}
                  >
                    {t('homeManagement.floorHeating')}
                  </Checkbox>
                </FormControl>

                <FormControl>
                  <FormControl.Label>{t('homeManagement.fieldBoilerModel')}</FormControl.Label>
                  <FormInput
                    placeholder={t('homeManagement.boilerModelPlaceholder')}
                    value={formData.boilerModel ?? ''}
                    onChangeText={(text) => setFormData({ ...formData, boilerModel: text })}
                  />
                </FormControl>

                {/* Temperature Preferences */}
                <Heading size="sm" color={textColor} mt={2}>
                  {t('homeManagement.sectionTemperatures')}
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>
                    {t('homeManagement.tempMorning')}: {formData.targetMorningTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetMorningTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value: number) => setFormData({ ...formData, targetMorningTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>
                    {t('homeManagement.tempDay')}: {formData.targetDayTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetDayTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value: number) => setFormData({ ...formData, targetDayTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>
                    {t('homeManagement.tempNight')}: {formData.targetNightTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetNightTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value: number) => setFormData({ ...formData, targetNightTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>
              </VStack>
            </ScrollView>
          </Modal.Body>
          <Modal.Footer>
            <Button.Group space={2}>
              <Button
                variant="ghost"
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                {t('homeManagement.cancel')}
              </Button>
              <Button
                onPress={handleAddHome}
                isLoading={createHomeMutation.isPending}
                isDisabled={createHomeMutation.isPending}
              >
                {t('homeManagement.addHome')}
              </Button>
            </Button.Group>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      {/* Edit Home Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} size="full">
        <Modal.Content maxHeight="90%">
          <Modal.CloseButton />
          <Modal.Header>{t('homeManagement.editTitle')}</Modal.Header>
          <Modal.Body>
            <ScrollView>
              <VStack space={4} pb={4}>
                {/* Basic Information */}
                <Heading size="sm" color={textColor}>
                  {t('homeManagement.sectionBasic')}
                </Heading>

                <FormControl>
                  <FormControl.Label>{t('homeManagement.fieldHomeName')}</FormControl.Label>
                  <FormInput
                    placeholder={t('homeProfile.form.homeName')}
                    value={formData.homeName}
                    onChangeText={(text) => setFormData({ ...formData, homeName: text })}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldFloorArea')}</FormControl.Label>
                  <FormInput
                    keyboardType="numeric"
                    placeholder="100"
                    value={String(formData.floorArea)}
                    onChangeText={(text) =>
                      setFormData({ ...formData, floorArea: parseFloat(text) || 0 })
                    }
                  />
                </FormControl>

                <HStack space={2}>
                  <FormControl flex={1}>
                    <FormControl.Label>{t('homeManagement.fieldCeilingHeight')}</FormControl.Label>
                    <FormInput
                      keyboardType="decimal-pad"
                      placeholder="2.6"
                      value={String(formData.ceilingHeight)}
                      onChangeText={(text) =>
                        setFormData({ ...formData, ceilingHeight: parseFloat(text) || 2.6 })
                      }
                    />
                  </FormControl>

                  <FormControl flex={1}>
                    <FormControl.Label>{t('homeManagement.fieldResidents')}</FormControl.Label>
                    <FormInput
                      keyboardType="numeric"
                      placeholder="2"
                      value={String(formData.numberOfResidents)}
                      onChangeText={(text) =>
                        setFormData({ ...formData, numberOfResidents: parseInt(text) || 0 })
                      }
                    />
                  </FormControl>

                  <FormControl flex={1}>
                    <FormControl.Label>{t('homeManagement.fieldBuiltYear')}</FormControl.Label>
                    <FormInput
                      keyboardType="numeric"
                      placeholder="2020"
                      value={String(formData.constructionYear)}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          constructionYear: parseInt(text) || new Date().getFullYear(),
                        })
                      }
                    />
                  </FormControl>
                </HStack>

                {/* Insulation & Structure */}
                <Heading size="sm" color={textColor} mt={2}>
                  Insulation & Windows
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldInsulationType')}</FormControl.Label>
                  <Select
                    selectedValue={formData.insulationType}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, insulationType: value as InsulationType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {INSULATION_TYPE_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        label={t(`homeProfile.insulation.${INSULATION_LABEL_KEY[option.value]}`)}
                        value={option.value}
                      />
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldInsulationThickness')}</FormControl.Label>
                  <Select
                    selectedValue={String(formData.insulationThickness)}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, insulationThickness: parseInt(value) })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    <Select.Item label="10 cm" value="10" />
                    <Select.Item label="12 cm" value="12" />
                    <Select.Item label="15 cm" value="15" />
                    <Select.Item label="20 cm" value="20" />
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldWindowType')}</FormControl.Label>
                  <Select
                    selectedValue={formData.windowType}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, windowType: value as WindowType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {WINDOW_TYPE_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        label={t(`homeProfile.window.${WINDOW_LABEL_KEY[option.value]}`)}
                        value={option.value}
                      />
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldSeasonMode')}</FormControl.Label>
                  <Select
                    selectedValue={formData.seasonMode}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, seasonMode: value as SeasonMode })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {SEASON_MODE_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        label={t(`homeProfile.seasonMode.${SEASON_LABEL_KEY[option.value]}`)}
                        value={option.value}
                      />
                    ))}
                  </Select>
                </FormControl>

                {/* Heating System */}
                <Heading size="sm" color={textColor} mt={2}>
                  {t('homeManagement.sectionHeating')}
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>{t('homeManagement.fieldHeatingType')}</FormControl.Label>
                  <Select
                    selectedValue={formData.heatingType}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, heatingType: value as HeatingType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {HEATING_TYPE_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        label={t(`homeProfile.heatingType.${HEATING_LABEL_KEY[option.value]}`)}
                        value={option.value}
                      />
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <Checkbox
                    value="hasFloorHeating"
                    isChecked={formData.hasFloorHeating}
                    onChange={(value: boolean) => setFormData({ ...formData, hasFloorHeating: value })}
                  >
                    {t('homeManagement.floorHeating')}
                  </Checkbox>
                </FormControl>

                <FormControl>
                  <FormControl.Label>{t('homeManagement.fieldBoilerModel')}</FormControl.Label>
                  <FormInput
                    placeholder={t('homeManagement.boilerModelPlaceholder')}
                    value={formData.boilerModel ?? ''}
                    onChangeText={(text) => setFormData({ ...formData, boilerModel: text })}
                  />
                </FormControl>

                {/* Temperature Preferences */}
                <Heading size="sm" color={textColor} mt={2}>
                  {t('homeManagement.sectionTemperatures')}
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>
                    {t('homeManagement.tempMorning')}: {formData.targetMorningTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetMorningTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value: number) => setFormData({ ...formData, targetMorningTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>
                    {t('homeManagement.tempDay')}: {formData.targetDayTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetDayTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value: number) => setFormData({ ...formData, targetDayTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>
                    {t('homeManagement.tempNight')}: {formData.targetNightTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetNightTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value: number) => setFormData({ ...formData, targetNightTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>
              </VStack>
            </ScrollView>
          </Modal.Body>
          <Modal.Footer>
            <Button.Group space={2}>
              <Button
                variant="ghost"
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedHome(null);
                  resetForm();
                }}
              >
                {t('homeManagement.cancel')}
              </Button>
              <Button
                onPress={handleEditHome}
                isLoading={updateHomeMutation.isPending}
                isDisabled={updateHomeMutation.isPending}
              >
                {t('homeManagement.save')}
              </Button>
            </Button.Group>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </Screen>
  );
};

export const HomeManagementScreen = HomeManagementScreenContent;
