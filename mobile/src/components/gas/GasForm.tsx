import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

import { useTranslation } from '../../hooks/useTranslation';
import { Button, InlineBanner, Panel, PanelRow, Text, useTokens } from '../../ui';
import { space } from '../../theme/tokens';
import { formatDate, formatTime } from '../../utils/format';
import { GasNumberField } from './GasNumberField';

interface GasFormProps {
  onSubmit: (data: {
    counterValue: number;
    readingDate: string;
    meterImage?: { uri: string; name?: string; type?: string };
  }) => Promise<void>;
  isLoading?: boolean;
  onCancel?: () => void;
  existingReadings?: Array<{ id: number; readingDate: string }>;
}

/**
 * Forma za novo očitanje plina.
 *
 * F9 (GAS-REFACTOR): forma je bila jedini ekran koji je ostao na STAROM sloju
 * (`components/ui/nativewind`: `FormControl`, `Switch`, `Spinner`, `Box`,
 * `useColorModeValue`). Zbog toga je izgledala kao druga aplikacija: drugi
 * radijusi, druge boje (`brand.*` umjesto semantičkih tokena), a na dark temi
 * `gray.50`/`white` podloge su bile svjetlije od svega oko njih. Sada je ista
 * gramatika kao ostatak Plina: `Panel`/`PanelRow`, `Button`, `InlineBanner`,
 * `GasNumberField` (jedno polje za brojilo sa validacijom u toku kucanja).
 *
 * Ponašanje je namjerno isto, uključujući i pravila koja su bila dobra:
 *  - „sada" je podrazumijevano, datum/vrijeme se biraju samo ako se isključe;
 *  - duplikat na isti dan se odbija PRIJE mrežnog poziva, sa objašnjenjem;
 *  - greška backenda se prikazuje u formi (ne samo kao toast), da ne nestane.
 */
export const GasForm: React.FC<GasFormProps> = ({
  onSubmit,
  isLoading,
  onCancel,
  existingReadings = [],
}) => {
  const { t } = useTranslation();
  const { t: tokens } = useTokens();

  const [counterValue, setCounterValue] = useState('');
  const [useCurrentDateTime, setUseCurrentDateTime] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [meterImage, setMeterImage] = useState<{
    uri: string;
    name?: string;
    type?: string;
  } | null>(null);
  const [error, setError] = useState('');

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

  const updateMeterImageFromAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const fallbackExtension =
      asset.mimeType?.startsWith('image/') ? asset.mimeType.replace('image/', '') : 'jpg';
    setMeterImage({
      uri: asset.uri,
      name: asset.fileName || `meter-${Date.now()}.${fallbackExtension}`,
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const pickMeterImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('gas.imagePermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      updateMeterImageFromAsset(result.assets[0]);
    }
  };

  const takeMeterPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError(t('gas.cameraPermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
      cameraType: ImagePicker.CameraType.back,
    });

    if (!result.canceled && result.assets[0]) {
      updateMeterImageFromAsset(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    setError('');

    const value = parseFloat(counterValue.replace(',', '.'));
    if (!counterValue || Number.isNaN(value) || value < 0) {
      setError(t('gas.invalidValue'));
      return;
    }

    const readingDate = useCurrentDateTime
      ? new Date()
      : combineDateTime(selectedDate, selectedTime);

    // Duplikat se provjerava prije mreže: backend bi ga odbio, ali korisnik
    // tada čeka cijeli krug da bi saznao isto što se moglo reći odmah.
    const readingDateString = readingDate.toDateString();
    const hasSameDayReading = existingReadings.some(
      (reading) => new Date(reading.readingDate).toDateString() === readingDateString,
    );

    if (hasSameDayReading) {
      setError(t('gas.duplicateDate'));
      return;
    }

    try {
      await onSubmit({
        counterValue: value,
        readingDate: readingDate.toISOString(),
        meterImage: meterImage ?? undefined,
      });

      setCounterValue('');
      setUseCurrentDateTime(true);
      setSelectedDate(new Date());
      setSelectedTime(new Date());
      setMeterImage(null);
    } catch (submitError) {
      // Backend poruka je konkretnija od generičke, pa ima prednost; forma je
      // prikazuje iznad polja, da ne nestane sa toastom.
      const message =
        (submitError as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        (submitError as Error)?.message ||
        t('common.error');
      setError(message);
    }
  };

  const dateLabel = formatDate(useCurrentDateTime ? new Date() : combineDateTime(selectedDate, selectedTime));
  const timeLabel = formatTime(useCurrentDateTime ? new Date() : combineDateTime(selectedDate, selectedTime));

  return (
    <View style={{ gap: space.lg }}>
      {error ? <InlineBanner tone="fault" title={error} testID="gas-form-error" /> : null}

      <GasNumberField
        value={counterValue}
        onChangeText={setCounterValue}
        label={t('gas.counterValueLabel')}
        placeholder={t('gas.counterValuePlaceholder')}
        editable={!isLoading}
      />

      {/*
        Datum i vrijeme su jedno pitanje („kada je očitano?"), pa su jedan red:
        prekidač „sada" i, kad je isključen, dva dugmeta koja otvaraju birače.
        Prije su to bila dva odvojena `FormControl` bloka sa svojim labelama.
      */}
      <Panel variant="flush" padded={false}>
        <PanelRow divider={false}>
          <View style={{ gap: space.sm, flex: 1 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text size="bodyLg" weight="medium">
                  {t('gas.useCurrentDateTime')}
                </Text>
                <Text size="body" tone="muted">
                  {`${dateLabel} · ${timeLabel}`}
                </Text>
              </View>
              <Button
                label={useCurrentDateTime ? t('gas.useCurrentDateTimeOn') : t('gas.useCurrentDateTimeOff')}
                variant={useCurrentDateTime ? 'primary' : 'secondary'}
                onPress={() => setUseCurrentDateTime((previous) => !previous)}
                disabled={isLoading}
                testID="gas-form-now-toggle"
              />
            </View>

            {!useCurrentDateTime ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Button
                    label={`${t('gas.readingDate')}: ${dateLabel}`}
                    variant="secondary"
                    block
                    onPress={() =>
                      Platform.OS === 'android' ? openAndroidDatePicker() : setShowDatePicker(true)
                    }
                    disabled={isLoading}
                    testID="gas-form-date"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Button
                    label={`${t('gas.readingTime')}: ${timeLabel}`}
                    variant="secondary"
                    block
                    onPress={() =>
                      Platform.OS === 'android' ? openAndroidTimePicker() : setShowTimePicker(true)
                    }
                    disabled={isLoading}
                    testID="gas-form-time"
                  />
                </View>
              </View>
            ) : null}
          </View>
        </PanelRow>
      </Panel>

      <View style={{ gap: space.sm }}>
        <Text size="bodyLg" weight="medium">
          {t('gas.meterImage')}
        </Text>
        {/*
          F9 (GAS-FORM-LAYOUT): na snimci su „Odaberi sliku" i „Uslikaj" stajali
          kao goli tekst jedan uz drugi — bez okvira, bez visine. Uzrok je isti
          kao kod `Pressable` primitiva (vidi `ui/Pressable.tsx`, PRESS-01):
          `style={{ flex: 1 }}` na `Button` je prolazio kroz NativeWind omotač.
          Sada širinu nosi `View` sa `flex: 1` (običan raspored), a dugme je
          `block` — dakle okvir i visina dolaze iz primitiva, ne iz fleksa.
        */}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Button
              label={t('gas.selectImage')}
              variant="secondary"
              block
              onPress={() => void pickMeterImage()}
              disabled={isLoading}
              testID="gas-form-pick-image"
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Button
              label={t('gas.takePhoto')}
              variant="secondary"
              block
              onPress={() => void takeMeterPhoto()}
              disabled={isLoading}
              testID="gas-form-take-photo"
            />
          </View>
        </View>
        {meterImage ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text size="body" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
              {meterImage.name || meterImage.uri}
            </Text>
            <Button
              label={t('common.clear')}
              variant="ghost"
              onPress={() => setMeterImage(null)}
              disabled={isLoading}
            />
          </View>
        ) : null}
      </View>

      {Platform.OS === 'ios' && showDatePicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          themeVariant={tokens.canvas === '#05070b' ? 'dark' : 'light'}
          onChange={handleDateChange}
        />
      ) : null}

      {Platform.OS === 'ios' && showTimePicker ? (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          display="spinner"
          themeVariant={tokens.canvas === '#05070b' ? 'dark' : 'light'}
          onChange={handleTimeChange}
        />
      ) : null}

      {/*
        F9 (GAS-FORM-CTA): na snimci u sheetu NIJE bilo dugmeta „Dodaj očitanje"
        — samo „Otkaži" kao goli tekst. Glavna akcija forme mora biti vidljiva i
        iznad preklopljene tastature, pa je sada puna širina, 52 px, primarna
        boja, i stoji iznad „Otkaži" (a ne pored njega u tesnom redu).
      */}
      <View style={{ gap: space.sm }}>
        <Button
          label={t('gas.addReading')}
          variant="primary"
          block
          onPress={() => void handleSubmit()}
          loading={isLoading}
          disabled={isLoading || !counterValue}
          style={{ minHeight: 52 }}
          testID="gas-form-submit"
        />
        {onCancel ? (
          <Button
            label={t('common.cancel')}
            variant="ghost"
            block
            onPress={onCancel}
            disabled={isLoading}
            testID="gas-form-cancel"
          />
        ) : null}
      </View>
    </View>
  );
};
