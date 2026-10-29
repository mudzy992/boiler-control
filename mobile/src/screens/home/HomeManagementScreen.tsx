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
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
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

interface HomeProfile {
  id: number;
  name: string;
  location: string;
  isActive: boolean;
  thermostats: number;
  createdAt: string;
}

// Move all hooks to top level BEFORE any state initialization
const useHomeManagementScreen = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedHome, setSelectedHome] = useState<HomeProfile | null>(null);

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  const queryClient = useQueryClient();
  const toast = useToast();

  return {
    showAddModal,
    setShowAddModal,
    showEditModal,
    setShowEditModal,
    selectedHome,
    setSelectedHome,
    bgColor,
    cardBg,
    textColor,
    subtextColor,
    queryClient,
    toast,
  };
};

export const HomeManagementScreen = () => {
  const {
    showAddModal,
    setShowAddModal,
    showEditModal,
    setShowEditModal,
    selectedHome,
    setSelectedHome,
    bgColor,
    cardBg,
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
    if (!formData.homeName.trim()) return 'Home name is required';
    if (formData.location && formData.location.length > 120)
      return 'Location should be 120 characters or fewer';
    if (formData.floorArea < 10 || formData.floorArea > 2000)
      return 'Floor area must be between 10 and 2000 m²';
    if (formData.ceilingHeight < 1.8 || formData.ceilingHeight > 5)
      return 'Ceiling height must be between 1.8 m and 5 m';
    if (formData.constructionYear < 1900 || formData.constructionYear > 2100)
      return 'Built year must be between 1900 and 2100';
    if (formData.numberOfResidents < 1 || formData.numberOfResidents > 20)
      return 'Residents must be between 1 and 20';
    if (formData.insulationThickness < 5 || formData.insulationThickness > 30)
      return 'Insulation thickness must be between 5 and 30 cm';
    const temps = [formData.targetMorningTemp, formData.targetDayTemp, formData.targetNightTemp];
    if (temps.some((t) => t < 5 || t > 30)) return 'Temperatures must be between 5°C and 30°C';
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
    return 'Something went wrong. Please try again.';
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
        description: 'Home switched successfully',
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
        description: 'Home added successfully',
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
        description: 'Home updated successfully',
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
        description: 'Home deleted successfully',
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
        description: 'Cannot delete the active home. Switch to another home first.',
        placement: 'top',
      });
      return;
    }
    if (deleteHomeMutation.isPending) return;
    deleteHomeMutation.mutate(home.id);
  };

  const openEditModal = (home: any) => {
    setSelectedHome(home);
    setFormData({
      homeName: home.homeName || home.name || '',
      location: home.location || '',
      floorArea: home.floorArea || 100,
      ceilingHeight: home.ceilingHeight || 2.6,
      insulationType: home.insulationType || InsulationType.STANDARD,
      insulationThickness: home.insulationThickness || 12,
      windowType: home.windowType || WindowType.DOUBLE_GLAZED,
      heatingType: home.heatingType || HeatingType.RADIATOR,
      constructionYear: home.constructionYear || new Date().getFullYear(),
      hasFloorHeating: home.hasFloorHeating || false,
      targetMorningTemp: home.targetMorningTemp || 22,
      targetDayTemp: home.targetDayTemp || 20,
      targetNightTemp: home.targetNightTemp || 18,
      numberOfResidents: home.numberOfResidents || 2,
      boilerModel: home.boilerModel || '',
      seasonMode: home.seasonMode || SeasonMode.WINTER,
    });
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
        shadow={2}
        p={4}
        borderWidth={home.isActive ? 2 : 0}
        borderColor="blue.500"
      >
        <HStack justifyContent="space-between" alignItems="flex-start">
          <VStack flex={1} space={1}>
            <HStack alignItems="center" space={2}>
              <Heading size="md" color={textColor}>
                {home.name}
              </Heading>
              {home.isActive && (
                <Badge colorScheme="success" variant="solid">
                  Active
                </Badge>
              )}
            </HStack>
            <HStack alignItems="center" space={1}>
              <Icon as={Ionicons} name="location-outline" size={4} color={subtextColor} />
              <Text fontSize="sm" color={subtextColor}>
                {home.location}
              </Text>
            </HStack>
            <HStack alignItems="center" space={1} mt={1}>
              <Icon as={Ionicons} name="thermometer-outline" size={4} color={subtextColor} />
              <Text fontSize="sm" color={subtextColor}>
                {home.thermostats} thermostat{home.thermostats !== 1 ? 's' : ''}
              </Text>
            </HStack>
          </VStack>

          <HStack space={2}>
            <Pressable onPress={() => openEditModal(home)}>
              <Icon as={Ionicons} name="create-outline" size={6} color="blue.500" />
            </Pressable>
            {!home.isActive && (
              <Pressable isDisabled={anyMutationPending} onPress={() => handleDeleteHome(home)}>
                <Icon as={Ionicons} name="trash-outline" size={6} color="red.500" />
              </Pressable>
            )}
          </HStack>
        </HStack>
      </Box>
    </Pressable>
  );

  return (
    <Box flex={1} bg={bgColor} safeArea>
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
        <VStack px={4} py={6} space={4}>
          <HStack justifyContent="space-between" alignItems="center">
            <Heading size="xl" color={textColor}>
              My Homes
            </Heading>
            <Button
              onPress={() => setShowAddModal(true)}
              leftIcon={<Icon as={Ionicons} name="add-circle-outline" />}
              size="sm"
              isDisabled={anyMutationPending}
              isLoading={isRefetching}
            >
              Add Home
            </Button>
          </HStack>

          <Text fontSize="sm" color={subtextColor}>
            Manage your home profiles. Tap a home to make it active.
          </Text>

          {isLoading ? (
            <Text color={subtextColor}>Loading homes...</Text>
          ) : isError ? (
            <Box bg={cardBg} rounded="xl" p={6} alignItems="center" justifyContent="center">
              <Icon as={Ionicons} name="alert-circle-outline" size={10} color="red.500" mb={2} />
              <Text fontSize="md" color={textColor} textAlign="center" mb={1}>
                Failed to load homes
              </Text>
              <Text fontSize="sm" color={subtextColor} textAlign="center" mb={3}>
                {error instanceof Error ? error.message : 'Please pull to refresh or try again.'}
              </Text>
              <Button onPress={() => refetch()} size="sm" variant="outline">
                Retry
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
                    No homes yet
                  </Text>
                  <Text fontSize="sm" color={subtextColor} textAlign="center" mt={1}>
                    Add your first home to get started
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
          <Modal.Header>Add New Home</Modal.Header>
          <Modal.Body>
            <ScrollView>
              <VStack space={4} pb={4}>
                {/* Basic Information */}
                <Heading size="sm" color={textColor}>
                  Basic Information
                </Heading>

                <FormControl>
                  <FormControl.Label>Home Name</FormControl.Label>
                  <FormInput
                    placeholder="e.g., Main House"
                    value={formData.homeName}
                    onChangeText={(text) => setFormData({ ...formData, homeName: text })}
                  />
                </FormControl>

                <FormControl>
                  <FormControl.Label>Location</FormControl.Label>
                  <FormInput
                    placeholder="e.g., Sarajevo"
                    value={formData.location}
                    onChangeText={(text) => setFormData({ ...formData, location: text })}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>Floor Area (m²)</FormControl.Label>
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
                    <FormControl.Label>Ceiling Height (m)</FormControl.Label>
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
                    <FormControl.Label>Residents</FormControl.Label>
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
                    <FormControl.Label>Built Year</FormControl.Label>
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
                  <FormControl.Label>Insulation Type</FormControl.Label>
                  <Select
                    selectedValue={formData.insulationType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, insulationType: value as InsulationType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {INSULATION_TYPE_OPTIONS.map((option) => (
                      <Select.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>Insulation Thickness (cm)</FormControl.Label>
                  <Select
                    selectedValue={String(formData.insulationThickness)}
                    onValueChange={(value) =>
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
                  <FormControl.Label>Window Type</FormControl.Label>
                  <Select
                    selectedValue={formData.windowType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, windowType: value as WindowType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {WINDOW_TYPE_OPTIONS.map((option) => (
                      <Select.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>Season Mode</FormControl.Label>
                  <Select
                    selectedValue={formData.seasonMode}
                    onValueChange={(value) =>
                      setFormData({ ...formData, seasonMode: value as SeasonMode })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {SEASON_MODE_OPTIONS.map((option) => (
                      <Select.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Select>
                </FormControl>

                {/* Heating System */}
                <Heading size="sm" color={textColor} mt={2}>
                  Heating System
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>Heating Type</FormControl.Label>
                  <Select
                    selectedValue={formData.heatingType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, heatingType: value as HeatingType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {HEATING_TYPE_OPTIONS.map((option) => (
                      <Select.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <Checkbox
                    value="hasFloorHeating"
                    isChecked={formData.hasFloorHeating}
                    onChange={(value) => setFormData({ ...formData, hasFloorHeating: value })}
                  >
                    Has underfloor heating zones
                  </Checkbox>
                </FormControl>

                <FormControl>
                  <FormControl.Label>Boiler Model (Optional)</FormControl.Label>
                  <FormInput
                    placeholder="e.g., Viessmann Vitodens 100"
                    value={formData.boilerModel ?? ''}
                    onChangeText={(text) => setFormData({ ...formData, boilerModel: text })}
                  />
                </FormControl>

                {/* Temperature Preferences */}
                <Heading size="sm" color={textColor} mt={2}>
                  Temperature Preferences
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>
                    Morning Target (6:00-10:00): {formData.targetMorningTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetMorningTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value) => setFormData({ ...formData, targetMorningTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>
                    Day Target (10:00-18:00): {formData.targetDayTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetDayTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value) => setFormData({ ...formData, targetDayTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>
                    Night Target (22:00-6:00): {formData.targetNightTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetNightTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value) => setFormData({ ...formData, targetNightTemp: value })}
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
                Cancel
              </Button>
              <Button
                onPress={handleAddHome}
                isLoading={createHomeMutation.isPending}
                isDisabled={createHomeMutation.isPending}
              >
                Add Home
              </Button>
            </Button.Group>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      {/* Edit Home Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} size="full">
        <Modal.Content maxHeight="90%">
          <Modal.CloseButton />
          <Modal.Header>Edit Home</Modal.Header>
          <Modal.Body>
            <ScrollView>
              <VStack space={4} pb={4}>
                {/* Basic Information */}
                <Heading size="sm" color={textColor}>
                  Basic Information
                </Heading>

                <FormControl>
                  <FormControl.Label>Home Name</FormControl.Label>
                  <FormInput
                    placeholder="e.g., Main House"
                    value={formData.homeName}
                    onChangeText={(text) => setFormData({ ...formData, homeName: text })}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>Floor Area (m²)</FormControl.Label>
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
                    <FormControl.Label>Ceiling Height (m)</FormControl.Label>
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
                    <FormControl.Label>Residents</FormControl.Label>
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
                    <FormControl.Label>Built Year</FormControl.Label>
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
                  <FormControl.Label>Insulation Type</FormControl.Label>
                  <Select
                    selectedValue={formData.insulationType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, insulationType: value as InsulationType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {INSULATION_TYPE_OPTIONS.map((option) => (
                      <Select.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>Insulation Thickness (cm)</FormControl.Label>
                  <Select
                    selectedValue={String(formData.insulationThickness)}
                    onValueChange={(value) =>
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
                  <FormControl.Label>Window Type</FormControl.Label>
                  <Select
                    selectedValue={formData.windowType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, windowType: value as WindowType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {WINDOW_TYPE_OPTIONS.map((option) => (
                      <Select.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>Season Mode</FormControl.Label>
                  <Select
                    selectedValue={formData.seasonMode}
                    onValueChange={(value) =>
                      setFormData({ ...formData, seasonMode: value as SeasonMode })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {SEASON_MODE_OPTIONS.map((option) => (
                      <Select.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Select>
                </FormControl>

                {/* Heating System */}
                <Heading size="sm" color={textColor} mt={2}>
                  Heating System
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>Heating Type</FormControl.Label>
                  <Select
                    selectedValue={formData.heatingType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, heatingType: value as HeatingType })
                    }
                    _selectedItem={{
                      bg: 'blue.500',
                      endIcon: <CheckIcon size={5} />,
                    }}
                  >
                    {HEATING_TYPE_OPTIONS.map((option) => (
                      <Select.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <Checkbox
                    value="hasFloorHeating"
                    isChecked={formData.hasFloorHeating}
                    onChange={(value) => setFormData({ ...formData, hasFloorHeating: value })}
                  >
                    Has underfloor heating zones
                  </Checkbox>
                </FormControl>

                <FormControl>
                  <FormControl.Label>Boiler Model (Optional)</FormControl.Label>
                  <FormInput
                    placeholder="e.g., Viessmann Vitodens 100"
                    value={formData.boilerModel ?? ''}
                    onChangeText={(text) => setFormData({ ...formData, boilerModel: text })}
                  />
                </FormControl>

                {/* Temperature Preferences */}
                <Heading size="sm" color={textColor} mt={2}>
                  Temperature Preferences
                </Heading>

                <FormControl isRequired>
                  <FormControl.Label>
                    Morning Target (6:00-10:00): {formData.targetMorningTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetMorningTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value) => setFormData({ ...formData, targetMorningTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>
                    Day Target (10:00-18:00): {formData.targetDayTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetDayTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value) => setFormData({ ...formData, targetDayTemp: value })}
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                </FormControl>

                <FormControl isRequired>
                  <FormControl.Label>
                    Night Target (22:00-6:00): {formData.targetNightTemp}°C
                  </FormControl.Label>
                  <Slider
                    value={Number(formData.targetNightTemp)}
                    minValue={5}
                    maxValue={30}
                    step={0.5}
                    onChange={(value) => setFormData({ ...formData, targetNightTemp: value })}
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
                Cancel
              </Button>
              <Button
                onPress={handleEditHome}
                isLoading={updateHomeMutation.isPending}
                isDisabled={updateHomeMutation.isPending}
              >
                Save Changes
              </Button>
            </Button.Group>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </Box>
  );
};
