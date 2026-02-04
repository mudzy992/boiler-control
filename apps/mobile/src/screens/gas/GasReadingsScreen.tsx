import React, { useEffect } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  useColorModeValue,
  Spinner,
  ScrollView,
  Pressable,
  Modal,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/client';
import { GasReadingCard } from '../../components/gas/GasReadingCard';
import { GasForm } from '../../components/gas/GasForm';

interface GasReading {
  id: number;
  userId: number;
  counterValue: number;
  readingDate: string;
  createdAt: string;
}

export const GasReadingsScreen: React.FC = () => {
  const route = useRoute<RouteProp<any, 'GasReadings'>>();
  const [showAddModal, setShowAddModal] = React.useState(false);
  const queryClient = useQueryClient();

  // Handle deep link to open add modal
  useEffect(() => {
    if (route.params?.openAddModal) {
      setShowAddModal(true);
    }
  }, [route.params?.openAddModal]);

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const fabBg = useColorModeValue('brand.500', 'brand.600');

  const { data: readings, isLoading } = useQuery({
    queryKey: ['gas-readings'],
    queryFn: () => apiClient.getGasReadings() as Promise<GasReading[]>,
  });

  const addMutation = useMutation({
    mutationFn: (data: { counterValue: number; readingDate: string }) =>
      apiClient.addGasReadingPayload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
      setShowAddModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteGasReading(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
  });

  if (isLoading) {
    return (
      <Box flex={1} bg={bgColor} safeArea alignItems="center" justifyContent="center">
        <Spinner size="lg" color={useColorModeValue('brand.500', 'brand.400')} />
        <Text mt={3} color={subtextColor}>
          Loading readings...
        </Text>
      </Box>
    );
  }

  const sortedReadings = [...(readings || [])].sort(
    (a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime()
  );

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
        {/* Header */}
        <VStack space={4} pb={8}>
          <Box>
            <Text fontSize="xl" fontWeight="bold" color={textColor}>
              Gas Readings
            </Text>
            <Text fontSize="sm" color={subtextColor} mt={1}>
              {sortedReadings.length} readings recorded
            </Text>
          </Box>

          {sortedReadings.length === 0 ? (
            <Box
              bg={cardBg}
              rounded="lg"
              borderWidth={1}
              borderColor={borderColor}
              p={6}
              alignItems="center"
            >
              <Icon as={Ionicons} name="documents-outline" size={12} color={subtextColor} mb={3} />
              <Text color={subtextColor} textAlign="center">
                No gas readings yet. Add your first reading to get started.
              </Text>
            </Box>
          ) : (
            <VStack space={3}>
              {sortedReadings.map((reading, idx) => (
                <GasReadingCard
                  key={reading.id}
                  reading={reading}
                  nextReading={
                    idx < sortedReadings.length - 1 ? sortedReadings[idx + 1] : undefined
                  }
                  onDelete={() => deleteMutation.mutate(reading.id)}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === reading.id}
                />
              ))}
            </VStack>
          )}
        </VStack>
      </ScrollView>

      {/* Floating Action Button - Material Design Style */}
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
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} size="full">
        <Modal.Content bg={cardBg} safeAreaTop>
          <Modal.Header borderBottomWidth={1} borderBottomColor={borderColor}>
            <HStack justifyContent="space-between" w="full" alignItems="center">
              <Text fontSize="lg" fontWeight="bold" color={textColor}>
                Add Gas Reading
              </Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Icon as={Ionicons} name="close" size={6} color={textColor} />
              </Pressable>
            </HStack>
          </Modal.Header>
          <Modal.Body p={0}>
            <ScrollView w="full" p={4} bounces={false}>
              <GasForm
                onSubmit={addMutation.mutateAsync}
                isLoading={addMutation.isPending}
                onCancel={() => setShowAddModal(false)}
              />
            </ScrollView>
          </Modal.Body>
        </Modal.Content>
      </Modal>
    </Box>
  );
};
