import React, { useState } from 'react';
import {
  Box,
  VStack,
  FormControl,
  Button,
  useColorModeValue,
  Text,
  Pressable,
  HStack,
  Icon,
  Spinner,
  Switch,
  useToast,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { FormInput } from '../FormInput';
import { useTranslation } from '../../hooks/useTranslation';
import { AxiosError } from 'axios';

interface GasFormProps {
  onSubmit: (data: {
    counterValue: number;
    readingDate: string;
    markAsReference?: boolean;
    meterImage?: { uri: string; name?: string; type?: string };
  }) => Promise<void>;
  isLoading?: boolean;
  onCancel?: () => void;
  existingReadings?: Array<{ id: number; readingDate: string }>;
}

export const GasForm: React.FC<GasFormProps> = ({
  onSubmit,
  isLoading,
  onCancel,
  existingReadings = [],
}) => {
  const [counterValue, setCounterValue] = useState('');
  const [useCurrentDateTime, setUseCurrentDateTime] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [markAsReference, setMarkAsReference] = useState(false);
  const [meterImage, setMeterImage] = useState<{
    uri: string;
    name?: string;
    type?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const toast = useToast();
  const { t } = useTranslation();

  const textColor = useColorModeValue('gray.800', 'gray.100');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const errorBg = useColorModeValue('red.50', 'red.900');
  const errorBorder = useColorModeValue('red.200', 'red.700');
  const errorText = useColorModeValue('red.700', 'red.200');
  const switchTrackColor = useColorModeValue('brand.300', 'brand.500');

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) {
      setSelectedDate(date);
    }
    setShowDatePicker(false);
  };

  const handleTimeChange = (event: DateTimePickerEvent, time?: Date) => {
    if (event.type === 'set' && time) {
      setSelectedTime(time);
    }
    setShowTimePicker(false);
  };

  const openAndroidDatePicker = () => {
    DateTimePickerAndroid.open({
      value: selectedDate,
      mode: 'date',
      is24Hour: true,
      onChange: handleDateChange,
    });
  };

  const openAndroidTimePicker = () => {
    DateTimePickerAndroid.open({
      value: selectedTime,
      mode: 'time',
      is24Hour: true,
      onChange: handleTimeChange,
    });
  };

  const combineDateTime = (date: Date, time: Date): Date => {
    const combined = new Date(date);
    combined.setHours(time.getHours());
    combined.setMinutes(time.getMinutes());
    combined.setSeconds(time.getSeconds());
    return combined;
  };

  const pickMeterImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      const errorMsg = t('gas.imagePermissionDenied') || 'Image permission denied';
      setError(errorMsg);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMeterImage({
        uri: asset.uri,
        name: asset.fileName || `meter-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const handleSubmit = async () => {
    setError('');

    const value = parseFloat(counterValue);
    if (!counterValue || isNaN(value) || value < 0) {
      setError(t('gas.invalidValue'));
      return;
    }

    const readingDate = useCurrentDateTime
      ? new Date()
      : combineDateTime(selectedDate, selectedTime);

    // Check if a reading already exists for this date
    const readingDateString = readingDate.toDateString();
    const hasTodayReading = existingReadings.some((reading) => {
      const existingDate = new Date(reading.readingDate).toDateString();
      return existingDate === readingDateString;
    });

    if (hasTodayReading) {
      const errorMsg = t('gas.duplicateDate');
      setError(errorMsg);
      toast.show({
        title: t('gas.duplicateEntry'),
        description: errorMsg,
        duration: 5000,
        placement: 'top',
        bg: 'orange.500',
      });
      return;
    }

    try {
      await onSubmit({
        counterValue: value,
        readingDate: readingDate.toISOString(),
        markAsReference,
        meterImage: meterImage ?? undefined,
      });

      // Reset form on success
      setCounterValue('');
      setUseCurrentDateTime(true);
      setSelectedDate(new Date());
      setSelectedTime(new Date());
      setMarkAsReference(false);
      setMeterImage(null);
    } catch (err: any) {
      // Extract backend validation message
      const backendMessage = (err as AxiosError<{ message: string }>)?.response?.data?.message;

      const errorMessage = backendMessage || err.message || t('common.error');

      // Display in both toast and form error
      setError(errorMessage);
      toast.show({
        title: t('gas.error'),
        description: errorMessage,
        duration: 5000,
        placement: 'top',
        bg: 'red.500',
      });
    }
  };

  return (
    <VStack space={4} flex={1}>
      {error && (
        <Box bg={errorBg} borderWidth={1} borderColor={errorBorder} rounded="lg" p={3}>
          <HStack space={2} alignItems="center">
            <Icon as={Ionicons} name="alert-circle" size={5} color={errorText} />
            <Text fontSize="sm" color={errorText} flex={1}>
              {error}
            </Text>
          </HStack>
        </Box>
      )}

      <FormControl isRequired>
        <FormControl.Label _text={{ fontSize: 'sm', fontWeight: '600', color: textColor }}>
          {t('gas.counterValueLabel')}
        </FormControl.Label>
        <FormInput
          placeholder={t('gas.counterValuePlaceholder')}
          keyboardType="decimal-pad"
          value={counterValue}
          onChangeText={setCounterValue}
          isDisabled={isLoading}
        />
      </FormControl>

      {/* Toggle for current date/time */}
      <FormControl>
        <HStack
          justifyContent="space-between"
          alignItems="center"
          bg={useColorModeValue('gray.50', 'dark.700')}
          p={3}
          rounded="md"
        >
          <HStack space={2} alignItems="center">
            <Icon as={Ionicons} name="time-outline" size={5} color="brand.500" />
            <Text fontSize="sm" fontWeight="500" color={textColor}>
              {t('gas.useCurrentDateTime')}
            </Text>
          </HStack>
          <Switch
            size="sm"
            isChecked={useCurrentDateTime}
            onToggle={setUseCurrentDateTime}
            onTrackColor={switchTrackColor}
            isDisabled={isLoading}
          />
        </HStack>
      </FormControl>

      {/* Manual date & time selection */}
      {!useCurrentDateTime && (
        <>
          <FormControl isRequired>
            <FormControl.Label _text={{ fontSize: 'sm', fontWeight: '600', color: textColor }}>
              {t('gas.readingDate')}
            </FormControl.Label>
            <Pressable
              onPress={() =>
                Platform.OS === 'android' ? openAndroidDatePicker() : setShowDatePicker(true)
              }
              disabled={isLoading}
            >
              <Box
                borderWidth={1}
                borderColor={borderColor}
                rounded="md"
                px={3}
                py={2}
                bg={useColorModeValue('white', 'dark.700')}
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color={textColor}>{dayjs(selectedDate).format('DD.MM.YYYY')}</Text>
                  <Icon as={Ionicons} name="calendar-outline" size={5} color="brand.500" />
                </HStack>
              </Box>
            </Pressable>
          </FormControl>

          <FormControl isRequired>
            <FormControl.Label _text={{ fontSize: 'sm', fontWeight: '600', color: textColor }}>
              {t('gas.readingTime')}
            </FormControl.Label>
            <Pressable
              onPress={() =>
                Platform.OS === 'android' ? openAndroidTimePicker() : setShowTimePicker(true)
              }
              disabled={isLoading}
            >
              <Box
                borderWidth={1}
                borderColor={borderColor}
                rounded="md"
                px={3}
                py={2}
                bg={useColorModeValue('white', 'dark.700')}
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color={textColor}>{dayjs(selectedTime).format('HH:mm')}</Text>
                  <Icon as={Ionicons} name="time-outline" size={5} color="brand.500" />
                </HStack>
              </Box>
            </Pressable>
          </FormControl>
        </>
      )}

      <FormControl>
        <HStack
          justifyContent="space-between"
          alignItems="center"
          bg={useColorModeValue('gray.50', 'dark.700')}
          p={3}
          rounded="md"
        >
          <HStack space={2} alignItems="center">
            <Icon as={Ionicons} name="receipt-outline" size={5} color="orange.500" />
            <Text fontSize="sm" fontWeight="500" color={textColor}>
              {t('gas.markAsReference') || 'Mark as monthly invoice reference'}
            </Text>
          </HStack>
          <Switch
            size="sm"
            isChecked={markAsReference}
            onToggle={setMarkAsReference}
            onTrackColor={switchTrackColor}
            isDisabled={isLoading}
          />
        </HStack>
      </FormControl>

      <FormControl>
        <FormControl.Label _text={{ fontSize: 'sm', fontWeight: '600', color: textColor }}>
          {t('gas.meterImage') || 'Meter Image (optional)'}
        </FormControl.Label>
        <HStack space={2}>
          <Button
            flex={1}
            variant="outline"
            onPress={pickMeterImage}
            isDisabled={isLoading}
            leftIcon={<Icon as={Ionicons} name="image-outline" size={4} color="brand.500" />}
          >
            {meterImage ? (t('gas.changeImage') || 'Change Image') : (t('gas.selectImage') || 'Select Image')}
          </Button>
          {meterImage && (
            <Button
              variant="ghost"
              colorScheme="red"
              onPress={() => setMeterImage(null)}
              isDisabled={isLoading}
            >
              {t('common.clear')}
            </Button>
          )}
        </HStack>
        {meterImage && (
          <Text mt={2} fontSize="xs" color={textColor}>
            {meterImage.name || meterImage.uri}
          </Text>
        )}
      </FormControl>

      {/* iOS Date Picker */}
      {Platform.OS === 'ios' && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          onChange={handleDateChange}
        />
      )}

      {/* iOS Time Picker */}
      {Platform.OS === 'ios' && showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          display="spinner"
          onChange={handleTimeChange}
        />
      )}

      <HStack space={2} mt={4}>
        {onCancel && (
          <Button
            flex={1}
            variant="outline"
            _text={{ color: 'gray.600' }}
            onPress={onCancel}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
        )}
        <Button
          flex={1}
          backgroundColor="brand.500"
          onPress={handleSubmit}
          isDisabled={isLoading || !counterValue}
          _text={{ fontWeight: 'bold' }}
        >
          {isLoading ? <Spinner size="sm" color="white" /> : t('gas.addReading')}
        </Button>
      </HStack>
    </VStack>
  );
};
